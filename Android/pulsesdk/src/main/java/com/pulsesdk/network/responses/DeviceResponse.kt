package com.pulsesdk.network.responses

internal data class DeviceResponse(
    val userId: String,
    val deviceToken: DeviceTokenResponse,
)