package com.pulsesdk.demo

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.pulsesdk.PulseMessagingService
import com.pulsesdk.PulseSDK

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
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
