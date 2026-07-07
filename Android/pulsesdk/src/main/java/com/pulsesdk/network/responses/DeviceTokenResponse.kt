package com.pulsesdk.network.responses

internal data class DeviceTokenResponse(
    val id: String,
    val fcmToken: String,
)