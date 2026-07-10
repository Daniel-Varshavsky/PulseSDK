package com.pulsesdk

data class VariantResult(
    val experimentId: String,
    val experimentName: String,
    val variantId: String,
    val variantName: String,
    val choices: List<String>?,
    val feedbackType: String,
    /**
     * Arbitrary key/value data attached to this variant in the Portal.
     * The SDK doesn't interpret this — it's opaque, app-defined config
     * (e.g. colors, copy, layout flags) you can act on however you like.
     */
    val metadata: Map<String, String>?,
)
