package com.pulsesdk

data class VariantResult(
    val experimentId: String,
    val variantId: String,
    val variantName: String,
    val choices: List<String>?,
)