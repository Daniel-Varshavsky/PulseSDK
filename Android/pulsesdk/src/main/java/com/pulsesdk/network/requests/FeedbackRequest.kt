package com.pulsesdk.network.requests

internal data class FeedbackRequest(
    val userId: String,
    val variantId: String?,
    val type: String,
    val value: Any,
    val comment: String? = null,
    val screenId: String? = null,
    val appVersion: String? = null,
)