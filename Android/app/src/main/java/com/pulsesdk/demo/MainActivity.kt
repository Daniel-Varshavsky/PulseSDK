package com.pulsesdk.demo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.RatingBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.pulsesdk.PulseMessagingService
import com.pulsesdk.PulseSDK
import com.pulsesdk.VariantResult

private const val EXPERIMENT_NAME = "Homepage CTA"

class MainActivity : AppCompatActivity() {

    private var currentVariant: VariantResult? = null

    private var ratingBarWidget: RatingBar? = null
    private var thumbsUpButton: MaterialButton? = null
    private var thumbsDownButton: MaterialButton? = null
    private var thumbsSelected: Boolean? = null
    private var choiceRadioGroup: RadioGroup? = null
    private var textFeedbackInput: EditText? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val userId = DemoSession.getUserId(this)
        if (userId == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
        }

        if (intent.getBooleanExtra(PulseMessagingService.EXTRA_FROM_NOTIFICATION, false)) {
            startActivity(Intent(this, FeedbackActivity::class.java).apply {
                putExtra(PulseMessagingService.EXTRA_FROM_NOTIFICATION, true)
            })
        }

        val experimentDescription = findViewById<TextView>(R.id.experimentDescription)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val feedbackWidgetContainer = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        experimentDescription.text = getString(R.string.main_experiment_none, EXPERIMENT_NAME)
        feedbackPrompt.visibility = View.GONE
        feedbackWidgetContainer.visibility = View.GONE
        submitFeedbackButton.visibility = View.GONE

        Thread {
            val variant = PulseSDK.getVariant(EXPERIMENT_NAME)
            runOnUiThread { onVariantLoaded(variant) }
        }.start()

        ctaButton.setOnClickListener {
            Toast.makeText(this, ctaButton.text, Toast.LENGTH_SHORT).show()
        }

        submitFeedbackButton.setOnClickListener { submitFeedback() }

        findViewById<View>(R.id.sendFeedbackButton).setOnClickListener {
            startActivity(Intent(this, FeedbackActivity::class.java))
        }
    }

    private fun onVariantLoaded(variant: VariantResult?) {
        currentVariant = variant
        if (variant == null) return

        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val experimentDescription = findViewById<TextView>(R.id.experimentDescription)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val feedbackWidgetContainer = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        variantLabel.text = getString(R.string.main_variant_label, variant.variantName)
        variantLabel.visibility = View.VISIBLE

        val isVariantB = variant.variantName.endsWith("B", ignoreCase = true)
        ctaButton.text = if (isVariantB) getString(R.string.main_cta_variant_b) else getString(R.string.main_cta_default)
        experimentDescription.text = getString(
            R.string.main_experiment_active,
            variant.variantName,
            EXPERIMENT_NAME,
        )

        buildFeedbackWidget(variant.feedbackType, variant.choices)
        feedbackPrompt.visibility = View.VISIBLE
        feedbackWidgetContainer.visibility = View.VISIBLE
        submitFeedbackButton.visibility = View.VISIBLE

        variant.metadata?.let { applyTheme(it) }
    }

    /**
     * The experiment's feedbackType decides which widget shows up here — set
     * once, server-side, when the experiment is created. The app never ships
     * a fixed "rate with stars" UI; it renders whatever the experiment asks for.
     */
    private fun buildFeedbackWidget(feedbackType: String, choices: List<String>?) {
        val container = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        container.removeAllViews()
        ratingBarWidget = null
        thumbsUpButton = null
        thumbsDownButton = null
        thumbsSelected = null
        choiceRadioGroup = null
        textFeedbackInput = null

        when (feedbackType) {
            "STAR_RATING" -> {
                val bar = RatingBar(this, null, android.R.attr.ratingBarStyle).apply {
                    numStars = 5
                    stepSize = 1f
                }
                container.addView(bar)
                ratingBarWidget = bar
            }
            "THUMBS" -> {
                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                val up = MaterialButton(this).apply {
                    text = "👍"
                    alpha = 0.5f
                    setOnClickListener {
                        thumbsSelected = true
                        updateThumbsSelection()
                    }
                }
                val down = MaterialButton(this).apply {
                    text = "👎"
                    alpha = 0.5f
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply { marginStart = (16 * resources.displayMetrics.density).toInt() }
                    setOnClickListener {
                        thumbsSelected = false
                        updateThumbsSelection()
                    }
                }
                row.addView(up)
                row.addView(down)
                container.addView(row)
                thumbsUpButton = up
                thumbsDownButton = down
            }
            "MULTIPLE_CHOICE" -> {
                val group = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
                choices?.forEach { choice ->
                    group.addView(RadioButton(this).apply {
                        text = choice
                        id = View.generateViewId()
                    })
                }
                container.addView(group)
                choiceRadioGroup = group
            }
            "TEXT" -> {
                val input = EditText(this).apply {
                    hint = getString(R.string.feedback_hint)
                    minLines = 3
                    inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    )
                }
                container.addView(input)
                textFeedbackInput = input
            }
        }
    }

    private fun updateThumbsSelection() {
        thumbsUpButton?.alpha = if (thumbsSelected == true) 1f else 0.5f
        thumbsDownButton?.alpha = if (thumbsSelected == false) 1f else 0.5f
    }

    private fun submitFeedback() {
        val variant = currentVariant ?: return

        when (variant.feedbackType) {
            "STAR_RATING" -> {
                val rating = ratingBarWidget?.rating?.toInt() ?: 0
                if (rating < 1) return
                PulseSDK.submitStarRating(variantId = variant.variantId, rating = rating, screenId = "main-screen")
            }
            "THUMBS" -> {
                val positive = thumbsSelected ?: return
                PulseSDK.submitThumbs(variantId = variant.variantId, positive = positive, screenId = "main-screen")
            }
            "MULTIPLE_CHOICE" -> {
                val group = choiceRadioGroup ?: return
                val checkedId = group.checkedRadioButtonId
                if (checkedId == View.NO_ID) return
                val index = (0 until group.childCount).indexOfFirst { group.getChildAt(it).id == checkedId }
                if (index < 0) return
                PulseSDK.submitMultipleChoice(variantId = variant.variantId, index = index, screenId = "main-screen")
            }
            "TEXT" -> {
                val text = textFeedbackInput?.text?.toString()?.trim().orEmpty()
                if (text.isEmpty()) return
                PulseSDK.submitText(text = text, variantId = variant.variantId, screenId = "main-screen")
                textFeedbackInput?.setText("")
            }
            else -> return
        }

        Toast.makeText(this, R.string.main_rating_thanks, Toast.LENGTH_SHORT).show()
    }

    /**
     * This demo app chooses to treat specific keys in a variant's metadata
     * as theme colors — that interpretation lives here, not in the SDK.
     * Any key can be missing or malformed since metadata is arbitrary,
     * app-defined data; each color is applied only if it parses.
     */
    private fun applyTheme(metadata: Map<String, String>) {
        fun colorOf(key: String): Int? =
            metadata[key]?.let { runCatching { Color.parseColor(it) }.getOrNull() }

        val page = findViewById<View>(R.id.pageContent)
        val card = findViewById<MaterialCardView>(R.id.experimentCard)
        val title = findViewById<TextView>(R.id.experimentTitle)
        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val description = findViewById<TextView>(R.id.experimentDescription)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val submitButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        colorOf("bgBase")?.let { page.setBackgroundColor(it) }
        colorOf("bgSurface")?.let { card.setCardBackgroundColor(it) }
        colorOf("textPrimary")?.let { title.setTextColor(it) }
        colorOf("textSecondary")?.let {
            description.setTextColor(it)
            feedbackPrompt.setTextColor(it)
        }

        colorOf("accent")?.let { accent ->
            variantLabel.setTextColor(accent)
            ctaButton.backgroundTintList = ColorStateList.valueOf(accent)
            submitButton.setTextColor(accent)
            submitButton.strokeColor = ColorStateList.valueOf(accent)
        }
        colorOf("accentTextOn")?.let { ctaButton.setTextColor(it) }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_logout) {
            PulseSDK.clearUser()
            DemoSession.clear(this)
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return true
        }
        return super.onOptionsItemSelected(item)
    }
}
