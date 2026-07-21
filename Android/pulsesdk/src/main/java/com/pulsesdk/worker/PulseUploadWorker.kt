package com.pulsesdk.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pulsesdk.network.PulseApiClient
import com.pulsesdk.network.requests.CrashReportRequest
import com.pulsesdk.network.requests.FeedbackRequest
import com.pulsesdk.storage.PulseDatabase
import com.google.gson.Gson

internal class PulseUploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    private val gson = Gson()

    override suspend fun doWork(): Result {
        val eventsSucceeded = flushEvents()
        val crashesSucceeded = flushCrashes()
        return if (eventsSucceeded && crashesSucceeded) Result.success() else Result.retry()
    }

    private suspend fun flushEvents(): Boolean {
        val db = PulseDatabase.getInstance(applicationContext)
        val dao = db.pendingEventDao()
        val service = PulseApiClient.getService()

        val events = dao.getAll()
        if (events.isEmpty()) return true

        var allSucceeded = true

        for (event in events) {
            try {
                val value = deserializeValue(event.value)

                service.submitFeedback(
                    FeedbackRequest(
                        userId = event.userId,
                        variantId = event.variantId,
                        type = event.type,
                        value = value,
                        comment = event.comment,
                        screenId = event.screenId,
                        appVersion = event.appVersion,
                    )
                )

                dao.deleteById(event.id)
            } catch (e: Exception) {
                allSucceeded = false
            }
        }

        return allSucceeded
    }

    // Same write-ahead-log flush as feedback events, for crash reports
    // recorded synchronously by PulseSDK's uncaught-exception handler while
    // the process had no safe way to upload them itself.
    private suspend fun flushCrashes(): Boolean {
        val db = PulseDatabase.getInstance(applicationContext)
        val dao = db.pendingCrashDao()
        val service = PulseApiClient.getService()

        val crashes = dao.getAll()
        if (crashes.isEmpty()) return true

        var allSucceeded = true

        for (crash in crashes) {
            try {
                service.submitCrash(
                    CrashReportRequest(
                        userId = crash.userId,
                        message = crash.message,
                        stackTrace = crash.stackTrace,
                        appVersion = crash.appVersion,
                        occurredAt = crash.occurredAt,
                    )
                )

                dao.deleteById(crash.id)
            } catch (e: Exception) {
                allSucceeded = false
            }
        }

        return allSucceeded
    }

    private fun deserializeValue(raw: String): Any {
        return when {
            raw == "true" -> true
            raw == "false" -> false
            raw.toIntOrNull() != null -> raw.toInt()
            raw.toDoubleOrNull() != null -> raw.toDouble()
            raw.startsWith("[") -> gson.fromJson(raw, List::class.java)
            else -> raw
        }
    }
}