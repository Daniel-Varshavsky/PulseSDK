package com.pulsesdk.network.responses

internal data class VariantResponse(
    val id: String,
    val name: String,
    val weight: Int,
    val choices: List<String>?,
)
