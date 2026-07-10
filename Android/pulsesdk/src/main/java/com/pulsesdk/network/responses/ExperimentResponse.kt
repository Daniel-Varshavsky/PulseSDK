package com.pulsesdk.network.responses

internal data class ExperimentResponse(
    val id: String,
    val name: String,
    val status: String,
    val feedbackType: String,
    val trafficSplit: List<TrafficSplitEntry>,
    val variants: List<VariantResponse>,
)