package com.pulsesdk.network.requests

internal data class IdentifyRequest(
    val externalUserId: String,
    val fcmToken: String,
)