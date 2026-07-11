package com.pulsesdk.demo.model

/**
 * Purely a demo-app trick to show a variant can change how the whole app
 * looks, not a PulseSDK feature — these colors are hardcoded here, not
 * fetched from anywhere. Shared between MainActivity and FeedbackActivity
 * so both screens agree on the same app-wide theme.
 */
data class DemoPalette(
    val bgBase: String,
    val bgSurface: String,
    val textPrimary: String,
    val textSecondary: String,
    val accent: String,
    val accentTextOn: String,
)
