package com.pulsesdk

import android.content.Context
import android.content.SharedPreferences
import androidx.work.*
import com.google.gson.Gson
import com.pulsesdk.network.PulseApiClient
import com.pulsesdk.network.requests.*
import com.pulsesdk.network.responses.ExperimentResponse
import com.pulsesdk.storage.PendingCrash
import com.pulsesdk.storage.PendingEvent
import com.pulsesdk.storage.PulseDatabase
import com.pulsesdk.util.VariantAssigner
import com.pulsesdk.worker.PulseUploadWorker
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

object PulseSDK {

    private lateinit var appContext: Context
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // In-memory cache of the active experiment list, shared by getVariant(),
    // getExperimentVariants() and overrideVariant() so that checking several
    // experiments costs one network call instead of one per experiment.
    // Lives only as long as the process — a fresh launch starts empty, which
    // is also when a paused/completed/reassigned experiment should next
    // take effect.
    private var cachedExperiments: List<ExperimentResponse>? = null
    private val experimentsCacheMutex = Mutex()

    // Variants already logged as "shown" this process — getVariant() can be
    // called many times per session (every screen that checks it), but an
    // exposure should be counted once per (user, variant) per launch, not
    // once per call. ConcurrentHashMap-backed set for thread safety without
    // a full mutex, since this is checked on every getVariant() call.
    private val loggedExposures = ConcurrentHashMap.newKeySet<String>()

    private var cooldownDays: Long = 7

    private var previousCrashHandler: Thread.UncaughtExceptionHandler? = null

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

        // Variant assignments are cached per-process, not indefinitely — clear
        // them on every fresh launch so a paused/completed experiment (or a
        // reassignment, or a leftover overrideVariant()) takes effect on next
        // launch instead of being stuck behind a cache that never expires.
        clearAllVariantCache()

        installCrashHandler()

        // Register device in background, then flush anything the write-ahead
        // queues collected while the process wasn't running — feedback/exposure
        // events from a connection that dropped, and any crash report written
        // by installCrashHandler() during a previous, now-dead process.
        scope.launch { registerDevice() }
        scheduleUpload()
    }

    /**
     * Returns the app's active experiments, fetching once per process and
     * reusing the result for every subsequent call.
     */
    private suspend fun fetchActiveExperiments(): List<ExperimentResponse> {
        cachedExperiments?.let { return it }
        return experimentsCacheMutex.withLock {
            cachedExperiments?.let { return@withLock it }
            val experiments = PulseApiClient.getService().getExperiments(appVersion = getAppVersion())
            cachedExperiments = experiments
            experiments
        }
    }

    private fun clearAllVariantCache() {
        val staleKeys = prefs.all.keys.filter { it.startsWith("variant_") }
        if (staleKeys.isEmpty()) return
        val editor = prefs.edit()
        staleKeys.forEach { editor.remove(it) }
        editor.apply()
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
        val cacheKey = variantCacheKey(experimentName)
        val cached = prefs.getString(cacheKey, null)
        if (cached != null) {
            val result = gson.fromJson(cached, VariantResult::class.java)
            maybeLogExposure(userId, result.variantId)
            return result
        }

        // Fetch experiments and assign synchronously
        return runBlocking {
            try {
                val experiments = fetchActiveExperiments()
                val experiment = experiments.find { it.name == experimentName }
                    ?: return@runBlocking null
                val result = assignVariant(userId, experiment) ?: return@runBlocking null

                // Cache the assignment
                prefs.edit().putString(cacheKey, gson.toJson(result)).apply()
                maybeLogExposure(userId, result.variantId)

                result
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Returns the assigned variant for every currently active experiment —
     * useful for UI that shouldn't need to hardcode experiment names up
     * front (e.g. a screen that shows one card per running experiment).
     * Returns an empty list if there are no active experiments or the user
     * isn't identified yet.
     */
    fun getActiveVariants(): List<VariantResult> {
        checkInitialized()
        val userId = PulseConfig.userId ?: return emptyList()

        return runBlocking {
            try {
                val experiments = fetchActiveExperiments()
                experiments.mapNotNull { experiment ->
                    val cacheKey = variantCacheKey(experiment.name)
                    val cached = prefs.getString(cacheKey, null)
                    val result = if (cached != null) {
                        gson.fromJson(cached, VariantResult::class.java)
                    } else {
                        assignVariant(userId, experiment)?.also {
                            prefs.edit().putString(cacheKey, gson.toJson(it)).apply()
                        }
                    }
                    result?.also { maybeLogExposure(userId, it.variantId) }
                }
            } catch (e: Exception) {
                emptyList()
            }
        }
    }

    private fun assignVariant(userId: String, experiment: ExperimentResponse): VariantResult? {
        val variantPairs = experiment.variants.map { it.id to it.weight }
        val assignedId = VariantAssigner.assign(userId, experiment.id, variantPairs) ?: return null
        val assignedVariant = experiment.variants.find { it.id == assignedId } ?: return null

        return VariantResult(
            experimentId = experiment.id,
            experimentName = experiment.name,
            variantId = assignedVariant.id,
            variantName = assignedVariant.name,
            choices = assignedVariant.choices,
            feedbackType = experiment.feedbackType,
            metadata = assignedVariant.metadata,
        )
    }

    /**
     * Lists every variant of an experiment, regardless of assignment. Most
     * apps don't need this — getVariant() is what real users go through.
     * It exists to build testing/QA tooling (e.g. a "preview other variants"
     * switcher) on top of overrideVariant().
     */
    fun getExperimentVariants(experimentName: String): List<ExperimentVariantSummary>? {
        checkInitialized()
        return runBlocking {
            try {
                val experiments = fetchActiveExperiments()
                val experiment = experiments.find { it.name == experimentName }
                    ?: return@runBlocking null
                experiment.variants.map { ExperimentVariantSummary(it.id, it.name) }
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * Forces the locally cached variant assignment for this experiment to a
     * specific variant, bypassing the normal deterministic assignment.
     * For local testing/QA only — this doesn't change anything server-side,
     * it's a client-side override that persists until cleared. Real user
     * traffic should never call this.
     */
    fun overrideVariant(experimentName: String, variantId: String) {
        checkInitialized()
        runBlocking {
            try {
                val experiments = fetchActiveExperiments()
                val experiment = experiments.find { it.name == experimentName }
                    ?: return@runBlocking
                val variant = experiment.variants.find { it.id == variantId } ?: return@runBlocking

                val result = VariantResult(
                    experimentId = experiment.id,
                    experimentName = experiment.name,
                    variantId = variant.id,
                    variantName = variant.name,
                    choices = variant.choices,
                    feedbackType = experiment.feedbackType,
                    metadata = variant.metadata,
                )

                prefs.edit().putString(variantCacheKey(experimentName), gson.toJson(result)).apply()
            } catch (e: Exception) {
                // Override simply won't take effect
            }
        }
    }

    /**
     * Clears a local overrideVariant() call, so the next getVariant() call
     * re-resolves the real deterministic assignment.
     */
    fun clearVariantOverride(experimentName: String) {
        checkInitialized()
        prefs.edit().remove(variantCacheKey(experimentName)).apply()
    }

    private fun variantCacheKey(experimentName: String) = "variant_$experimentName"

    // ── Exposure Logging ──────────────────────────────────────────

    /**
     * Fire-and-forget: logs that [userId] was shown [variantId], once per
     * (user, variant) per process. This is what lets the Portal compute a
     * real response rate instead of a raw response count with no
     * denominator. Unlike feedback submission, exposures aren't offline-
     * queued — losing an occasional exposure log to a dropped connection
     * doesn't matter the way losing a user's actual feedback would, so this
     * skips the Room write-ahead queue in favor of a plain best-effort call.
     */
    private fun maybeLogExposure(userId: String, variantId: String) {
        if (!loggedExposures.add("$userId:$variantId")) return
        scope.launch {
            try {
                PulseApiClient.getService().logExposure(ExposureRequest(userId, variantId))
            } catch (e: Exception) {
                // Best-effort — a missed exposure log just slightly undercounts
                // the response rate, it isn't user-visible.
            }
        }
    }

    // ── Rate Limiting ──────────────────────────────────────────────

    /**
     * Overrides the default 7-day cooldown used by [shouldPrompt]. Call once,
     * typically at init time.
     */
    fun setCooldownDays(days: Int) {
        require(days >= 0) { "days must be >= 0" }
        cooldownDays = days.toLong()
    }

    /**
     * Whether it's been at least [setCooldownDays] (default 7) since the app
     * last called [markPrompted] for this [screenId]. Use this to decide
     * whether to show *any* in-app prompt — a feedback dialog, an experiment
     * prompt, a rating request — without hand-rolling a SharedPreferences
     * timestamp check per screen.
     */
    fun shouldPrompt(screenId: String): Boolean {
        checkInitialized()
        val last = prefs.getLong(lastPromptKey(screenId), 0L)
        return System.currentTimeMillis() - last >= TimeUnit.DAYS.toMillis(cooldownDays)
    }

    /**
     * Records that a prompt was just shown for [screenId], starting the
     * cooldown window [shouldPrompt] checks against.
     */
    fun markPrompted(screenId: String) {
        checkInitialized()
        prefs.edit().putLong(lastPromptKey(screenId), System.currentTimeMillis()).apply()
    }

    private fun lastPromptKey(screenId: String) = "last_prompt_$screenId"

    // ── Crash Reporting ────────────────────────────────────────────

    /**
     * Wraps whatever uncaught-exception handler was already installed (the
     * platform default, or another crash reporter like Crashlytics) so
     * PulseSDK captures a copy without suppressing anyone else's handling.
     * The write happens synchronously on the crashing thread — by the time
     * an uncaught exception reaches here the process may terminate within
     * milliseconds, so this can't wait for a coroutine dispatcher hop.
     */
    private fun installCrashHandler() {
        val existing = Thread.getDefaultUncaughtExceptionHandler()
        if (existing is PulseCrashHandler) return // already installed (re-entrant init() call)
        previousCrashHandler = existing
        Thread.setDefaultUncaughtExceptionHandler(PulseCrashHandler())
    }

    private inner class PulseCrashHandler : Thread.UncaughtExceptionHandler {
        override fun uncaughtException(thread: Thread, throwable: Throwable) {
            try {
                recordCrashBlocking(throwable)
            } catch (e: Exception) {
                // Don't let a failure here block the real crash handling below
            } finally {
                previousCrashHandler?.uncaughtException(thread, throwable)
            }
        }
    }

    private fun recordCrashBlocking(throwable: Throwable) {
        // Can't attribute a crash to nobody — if registerDevice() hasn't
        // completed yet (e.g. a crash in the first seconds after install),
        // there's no userId to report it under.
        val userId = PulseConfig.userId ?: return

        PulseDatabase.getInstance(appContext).pendingCrashDao().insertBlocking(
            PendingCrash(
                userId = userId,
                message = throwable.message ?: throwable.toString(),
                stackTrace = android.util.Log.getStackTraceString(throwable),
                appVersion = getAppVersion(),
                occurredAt = System.currentTimeMillis(),
            )
        )
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
                    appVersion = getAppVersion(),
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

    private fun getAppVersion(): String? = try {
        appContext.packageManager
            .getPackageInfo(appContext.packageName, 0)
            .versionName
    } catch (e: Exception) { null }

    private fun checkInitialized() {
        check(PulseConfig.isInitialized) {
            "PulseSDK is not initialized. Add your API key to AndroidManifest.xml or call PulseSDK.init()."
        }
    }
}