package com.pulsesdk.network.responses

internal data class VariantThemeResponse(
    val themeName: String,
    val bgBase: String,
    val bgSurface: String,
    val textPrimary: String,
    val textSecondary: String,
    val accent: String,
    val accentTextOn: String,
    val border: String,
)
