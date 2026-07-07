package com.pulsesdk.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pulsesdk.network.PulseApiClient
import com.pulsesdk.network.requests.FeedbackRequest
import com.pulsesdk.storage.PulseDatabase
import com.google.gson.Gson

internal class PulseUploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    private val gson = Gson()

    override suspend fun doWork(): Result {
        val db = PulseDatabase.getInstance(applicationContext)
        val dao = db.pendingEventDao()
        val service = PulseApiClient.getService()

        val events = dao.getAll()

        if (events.isEmpty()) return Result.success()

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

        return if (allSucceeded) Result.success() else Result.retry()
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