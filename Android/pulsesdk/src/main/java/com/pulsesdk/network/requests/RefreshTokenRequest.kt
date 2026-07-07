package com.pulsesdk.network.requests

internal data class RefreshTokenRequest(
    val userId: String,
    val fcmToken: String,
)
