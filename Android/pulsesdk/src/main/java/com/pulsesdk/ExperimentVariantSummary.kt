package com.pulsesdk

/**
 * A lightweight summary of one variant of an experiment, independent of any
 * assignment. Returned by PulseSDK.getExperimentVariants() for building
 * testing/QA tooling on top of overrideVariant().
 */
data class ExperimentVariantSummary(
    val variantId: String,
    val variantName: String,
)
