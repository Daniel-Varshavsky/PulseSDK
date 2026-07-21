package com.pulsesdk.network.requests

internal data class CrashReportRequest(
    val userId: String,
    val message: String,
    val stackTrace: String,
    val appVersion: String?,
    val occurredAt: Long,
)
