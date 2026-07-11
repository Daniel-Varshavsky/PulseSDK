package com.pulsesdk.demo

import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.pulsesdk.PulseMessagingService
import com.pulsesdk.PulseSDK
import com.pulsesdk.demo.model.DemoPalette
import com.pulsesdk.demo.util.AppTheme

class FeedbackActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_feedback)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.apply {
            title = getString(R.string.feedback_title)
            setDisplayHomeAsUpEnabled(true)
        }

        if (intent.getBooleanExtra(PulseMessagingService.EXTRA_FROM_NOTIFICATION, false)) {
            findViewById<View>(R.id.notificationBanner).visibility = View.VISIBLE
        }

        val feedbackLayout = findViewById<TextInputLayout>(R.id.feedbackLayout)
        val feedbackInput = findViewById<TextInputEditText>(R.id.feedbackInput)

        findViewById<View>(R.id.submitFeedbackButton).setOnClickListener {
            val text = feedbackInput.text?.toString()?.trim().orEmpty()
            if (text.isEmpty()) {
                feedbackLayout.error = getString(R.string.feedback_error_blank)
                return@setOnClickListener
            }
            feedbackLayout.error = null

            // Not tied to any experiment variant — this screen is always
            // app-wide feedback, regardless of which experiment card the
            // user was looking at on the main screen.
            PulseSDK.submitText(text = text, screenId = "feedback-screen")
            Toast.makeText(this, R.string.feedback_thanks, Toast.LENGTH_SHORT).show()
            feedbackInput.setText("")
        }

        // The app-wide theme (see AppTheme.kt) applies here too, not just
        // on the main screen — matches whatever the currently active
        // appTheme-controlling variant, if any, picked. Applied once
        // resolved rather than blocking onCreate on a network call.
        Thread {
            val palette = AppTheme.resolveAppPalette(PulseSDK.getActiveVariants())
            runOnUiThread { applyTheme(palette) }
        }.start()
    }

    private fun applyTheme(palette: DemoPalette) {
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        val content = findViewById<View>(R.id.feedbackContent)
        val feedbackLayout = findViewById<TextInputLayout>(R.id.feedbackLayout)
        val feedbackInput = findViewById<TextInputEditText>(R.id.feedbackInput)
        val submitButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        val accent = Color.parseColor(palette.accent)
        val accentColors = ColorStateList.valueOf(accent)
        val accentTextOn = Color.parseColor(palette.accentTextOn)
        val textPrimary = Color.parseColor(palette.textPrimary)
        val textSecondary = Color.parseColor(palette.textSecondary)

        toolbar.setBackgroundColor(accent)
        content.setBackgroundColor(Color.parseColor(palette.bgBase))
        // TextInputLayout's default FilledBox style keeps its own fixed
        // light background regardless of app theme — without setting this
        // explicitly, dark-palette text (light-colored) sits on that same
        // fixed light box and becomes unreadable.
        feedbackLayout.boxBackgroundColor = Color.parseColor(palette.bgSurface)
        feedbackLayout.boxStrokeColor = accent
        feedbackLayout.defaultHintTextColor = ColorStateList.valueOf(textSecondary)
        feedbackInput.setTextColor(textPrimary)
        submitButton.backgroundTintList = accentColors
        submitButton.setTextColor(accentTextOn)
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
