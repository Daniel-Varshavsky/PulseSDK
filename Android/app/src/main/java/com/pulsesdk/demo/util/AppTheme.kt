package com.pulsesdk.demo.util

import com.pulsesdk.VariantResult
import com.pulsesdk.demo.model.DemoPalette

object AppTheme {
    val LIGHT_PALETTE = DemoPalette(
        bgBase = "#F8FAFC",
        bgSurface = "#FFFFFF",
        textPrimary = "#111827",
        textSecondary = "#4B5563",
        accent = "#0D9488",
        accentTextOn = "#FFFFFF",
    )

    val BLUE_DARK_PALETTE = DemoPalette(
        bgBase = "#0F172A",
        bgSurface = "#1E293B",
        textPrimary = "#F1F5F9",
        textSecondary = "#CBD5E1",
        accent = "#3B82F6",
        accentTextOn = "#FFFFFF",
    )

    /**
     * Resolves the app-wide theme from whatever's currently active: any
     * variant can opt in by setting metadata key "appTheme" to "light" or
     * "dark". This is intentionally app-wide rather than per-card — the
     * first active variant (in getActiveVariants() order) that sets it
     * wins, and it applies everywhere (MainActivity's chrome and every
     * card, plus FeedbackActivity), not just to its own experiment's
     * card. No matching variant anywhere falls back to light.
     *
     * This is a separate concern from a variant's own CTA copy — see
     * MainActivity's useAlternateStyle — which still varies per-card so
     * that experiments not driving the app theme can still visibly
     * differ between their own variants.
     */
    fun resolveAppPalette(variants: List<VariantResult>): DemoPalette {
        val theme = variants.firstNotNullOfOrNull { it.metadata?.get("appTheme") }
        return if (theme?.lowercase() == "dark") BLUE_DARK_PALETTE else LIGHT_PALETTE
    }
}
