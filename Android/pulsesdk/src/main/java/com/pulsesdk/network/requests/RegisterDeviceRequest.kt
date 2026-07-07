package com.pulsesdk.network.requests

internal data class RegisterDeviceRequest(
    val fcmToken: String,
    val externalUserId: String? = null,
)
