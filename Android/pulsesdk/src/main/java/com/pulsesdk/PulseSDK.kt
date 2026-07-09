package com.pulsesdk

import android.content.Context
import android.content.SharedPreferences
import androidx.work.*
import com.google.gson.Gson
import com.pulsesdk.network.PulseApiClient
import com.pulsesdk.network.requests.*
import com.pulsesdk.storage.PendingEvent
import com.pulsesdk.storage.PulseDatabase
import com.pulsesdk.util.VariantAssigner
import com.pulsesdk.worker.PulseUploadWorker
import kotlinx.coroutines.*

object PulseSDK {

    private lateinit var appContext: Context
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ── Initialization ────────────────────────────────────────────

    /**
     * Called automatically by PulseSDKInitProvider if API key is in AndroidManifest.
     * Can also be called manually by the developer.
     */
    fun init(context: Context, apiKey: String, serverUrl: String? = null) {
        initInternal(context, apiKey, serverUrl)
    }

    internal fun initInternal(context: Context, apiKey: String, serverUrl: String?) {
        if (PulseConfig.isInitialized) return

        appContext = context.applicationContext
        prefs = appContext.getSharedPreferences("pulse_prefs", Context.MODE_PRIVATE)

        PulseConfig.apiKey = apiKey
        if (serverUrl != null) PulseConfig.serverUrl = serverUrl
        PulseConfig.isInitialized = true

        // Restore saved user ID if available
        PulseConfig.userId = prefs.getString("pulse_user_id", null)
        PulseConfig.deviceUserId = prefs.getString("pulse_device_user_id", null)

        // Register device in background
        scope.launch { registerDevice() }
    }

    // ── Device & User Identity ────────────────────────────────────

    private suspend fun registerDevice() {
        try {
            val token = fetchFcmToken() ?: return
            prefs.edit().putString("pulse_fcm_token", token).apply()

            val service = PulseApiClient.getService()
            val response = service.registerDevice(
                RegisterDeviceRequest(
                    fcmToken = token,
                    externalUserId = PulseConfig.deviceUserId,
                )
            )
            saveUserId(response.userId)
        } catch (e: Exception) {
            android.util.Log.e("PulseSDK", "registerDevice failed", e)
        }
    }

    private suspend fun fetchFcmToken(): String? {
        return try {
            com.google.android.gms.tasks.Tasks.await(
                com.google.firebase.messaging.FirebaseMessaging.getInstance().token
            )
        } catch (e: Exception) {
            android.util.Log.w("PulseSDK", "FCM token unavailable (emulator?), using saved token")
            // Fall back to saved token — works on emulator for development
            prefs.getString("pulse_fcm_token", null)
        }
    }

    /**
     * Sets a test FCM token for development on emulators where FCM is unavailable.
     * Do not call this in production code.
     */
    fun setTestFcmToken(token: String) {
        prefs.edit().putString("pulse_fcm_token", token).apply()
    }

    /**
     * Links the SDK user to the developer's own user identity.
     * Call this after the user logs in to your app.
     */
    fun identify(externalUserId: String) {
        PulseConfig.deviceUserId = externalUserId
        prefs.edit().putString("pulse_device_user_id", externalUserId).apply()

        scope.launch {
            try {
                val token = fetchFcmToken() ?: return@launch
                prefs.edit().putString("pulse_fcm_token", token).apply()
                val service = PulseApiClient.getService()
                val response = service.identifyUser(
                    IdentifyRequest(
                        externalUserId = externalUserId,
                        fcmToken = token,
                    )
                )
                saveUserId(response.userId)
                android.util.Log.d("PulseSDK", "identify() success — userId = ${response.userId}")
            } catch (e: Exception) {
                android.util.Log.e("PulseSDK", "identify() failed", e)
            }
        }
    }

    /**
     * Unlinks the user identity. Call this when the user logs out.
     */
    fun clearUser() {
        scope.launch {
            try {
                val fcmToken = getSavedFcmToken() ?: return@launch
                PulseApiClient.getService().clearUser(ClearUserRequest(fcmToken))
            } catch (e: Exception) {
                // Ignore
            } finally {
                PulseConfig.userId = null
                PulseConfig.deviceUserId = null
                prefs.edit()
                    .remove("pulse_user_id")
                    .remove("pulse_device_user_id")
                    .apply()
            }
        }
    }

    /**
     * Updates the FCM token when Firebase issues a new one.
     * Call this from your FirebaseMessagingService.onNewToken().
     */
    fun refreshFcmToken(token: String) {
        prefs.edit().putString("pulse_fcm_token", token).apply()

        val userId = PulseConfig.userId ?: return
        scope.launch {
            try {
                PulseApiClient.getService().refreshToken(
                    RefreshTokenRequest(userId = userId, fcmToken = token)
                )
            } catch (e: Exception) {
                // Will use saved token on next launch
            }
        }
    }

    // ── Variant Assignment ────────────────────────────────────────

    /**
     * Returns the variant assigned to this user for the given experiment name.
     * Assignment is deterministic and cached — the same user always gets the same variant.
     * Returns null if the experiment is not found or not active.
     */
    fun getVariant(experimentName: String): VariantResult? {
        checkInitialized()
        val userId = PulseConfig.userId ?: return null

        // Check cache first
        val cacheKey = "variant_${experimentName}"
        val cached = prefs.getString(cacheKey, null)
        if (cached != null) {
            return gson.fromJson(cached, VariantResult::class.java)
        }

        // Fetch experiments and assign synchronously
        return runBlocking {
            try {
                val experiments = PulseApiClient.getService().getExperiments()
                val experiment = experiments.find {
                    it.name == experimentName && it.status == "ACTIVE"
                } ?: return@runBlocking null

                val variantPairs = experiment.variants.map { it.id to it.weight }
                val assignedId = VariantAssigner.assign(userId, experiment.id, variantPairs)
                    ?: return@runBlocking null

                val assignedVariant = experiment.variants.find { it.id == assignedId }
                    ?: return@runBlocking null

                val result = VariantResult(
                    experimentId = experiment.id,
                    variantId = assignedVariant.id,
                    variantName = assignedVariant.name,
                    choices = assignedVariant.choices,
                    feedbackType = experiment.feedbackType,
                    metadata = assignedVariant.metadata,
                )

                // Cache the assignment
                prefs.edit().putString(cacheKey, gson.toJson(result)).apply()

                result
            } catch (e: Exception) {
                null
            }
        }
    }

    // ── Feedback Submission ───────────────────────────────────────

    /**
     * Submits a star rating (1-5) for a variant.
     */
    fun submitStarRating(variantId: String, rating: Int, comment: String? = null, screenId: String? = null) {
        require(rating in 1..5) { "Rating must be between 1 and 5" }
        enqueue(variantId, "STAR_RATING", rating.toString(), comment, screenId)
    }

    /**
     * Submits a thumbs up/down response for a variant.
     */
    fun submitThumbs(variantId: String, positive: Boolean, comment: String? = null, screenId: String? = null) {
        enqueue(variantId, "THUMBS", positive.toString(), comment, screenId)
    }

    /**
     * Submits a multiple choice response. index is 0-based.
     */
    fun submitMultipleChoice(variantId: String, index: Int, comment: String? = null, screenId: String? = null) {
        enqueue(variantId, "MULTIPLE_CHOICE", index.toString(), comment, screenId)
    }

    /**
     * Submits open-ended text feedback.
     * Pass variantId = null for general app feedback not tied to any experiment.
     */
    fun submitText(text: String, variantId: String? = null, screenId: String? = null) {
        enqueue(variantId, "TEXT", text, null, screenId)
    }

    // ── Internal helpers ──────────────────────────────────────────

    private fun enqueue(
        variantId: String?,
        type: String,
        value: String,
        comment: String?,
        screenId: String?,
    ) {
        checkInitialized()
        val userId = PulseConfig.userId ?: return

        val appVersion = try {
            appContext.packageManager
                .getPackageInfo(appContext.packageName, 0)
                .versionName
        } catch (e: Exception) { null }

        scope.launch {
            val db = PulseDatabase.getInstance(appContext)
            db.pendingEventDao().insert(
                PendingEvent(
                    userId = userId,
                    variantId = variantId,
                    type = type,
                    value = value,
                    comment = comment,
                    screenId = screenId,
                    appVersion = appVersion,
                )
            )
            scheduleUpload()
        }
    }

    private fun scheduleUpload() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<PulseUploadWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(appContext).enqueue(request)
    }

    private fun saveUserId(id: String) {
        PulseConfig.userId = id
        prefs.edit().putString("pulse_user_id", id).apply()
    }

    private fun getSavedFcmToken(): String? {
        return prefs.getString("pulse_fcm_token", null)
    }

    private fun checkInitialized() {
        check(PulseConfig.isInitialized) {
            "PulseSDK is not initialized. Add your API key to AndroidManifest.xml or call PulseSDK.init()."
        }
    }
}