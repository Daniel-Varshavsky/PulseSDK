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
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.pulsesdk.PulseMessagingService
import com.pulsesdk.PulseSDK
import com.pulsesdk.VariantResult

/**
 * One page of the main-screen carousel — either a live experiment (with its
 * assigned variant) or the trailing general-info page. The set of
 * experiment names isn't hardcoded anywhere: PulseSDK.getActiveVariants()
 * reports whatever's currently active in the Portal, and the app just
 * builds one card per result.
 */
private sealed class DemoCard {
    data class Experiment(val variant: VariantResult) : DemoCard()
    object General : DemoCard()
}

/**
 * Purely a demo-app trick to show two variants can look genuinely
 * different, not a PulseSDK feature — these colors are hardcoded here,
 * not fetched from anywhere.
 */
private data class DemoPalette(
    val bgBase: String,
    val bgSurface: String,
    val textPrimary: String,
    val textSecondary: String,
    val accent: String,
    val accentTextOn: String,
)

private val LIGHT_PALETTE = DemoPalette(
    bgBase = "#F8FAFC",
    bgSurface = "#FFFFFF",
    textPrimary = "#111827",
    textSecondary = "#4B5563",
    accent = "#0D9488",
    accentTextOn = "#FFFFFF",
)

private val BLUE_DARK_PALETTE = DemoPalette(
    bgBase = "#0F172A",
    bgSurface = "#1E293B",
    textPrimary = "#F1F5F9",
    textSecondary = "#CBD5E1",
    accent = "#3B82F6",
    accentTextOn = "#FFFFFF",
)

class MainActivity : AppCompatActivity() {

    private var cards: List<DemoCard> = emptyList()
    private var currentCardIndex = 0
    private var currentVariant: VariantResult? = null

    private var ratingBarWidget: RatingBar? = null
    private var thumbsUpButton: MaterialButton? = null
    private var thumbsDownButton: MaterialButton? = null
    private var thumbsSelected: Boolean? = null
    private var choiceRadioGroup: RadioGroup? = null
    private var commentInput: EditText? = null

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

        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        findViewById<View>(R.id.prevExperimentButton).setOnClickListener {
            if (cards.isNotEmpty()) showCard((currentCardIndex - 1 + cards.size) % cards.size)
        }
        findViewById<View>(R.id.nextExperimentButton).setOnClickListener {
            if (cards.isNotEmpty()) showCard((currentCardIndex + 1) % cards.size)
        }

        showLoadingCard()
        refreshCards()

        ctaButton.setOnClickListener {
            Toast.makeText(this, ctaButton.text, Toast.LENGTH_SHORT).show()
        }

        submitFeedbackButton.setOnClickListener { submitFeedback() }

        // Not tied to any single experiment card — it's app-wide feedback,
        // regardless of which experiment happens to be showing.
        findViewById<View>(R.id.sendFeedbackButton).setOnClickListener {
            startActivity(Intent(this, FeedbackActivity::class.java))
        }
    }

    /**
     * Fetches every active experiment's assigned variant and rebuilds the
     * card list from it — one card per active experiment, plus a trailing
     * general-info card. [preserveIndex], when given, keeps the carousel on
     * the same position after the refresh (e.g. after overriding a variant)
     * instead of resetting to the first card.
     */
    private fun refreshCards(preserveIndex: Int? = null) {
        Thread {
            val variants = PulseSDK.getActiveVariants()
            runOnUiThread {
                cards = variants.map { DemoCard.Experiment(it) } + DemoCard.General
                val target = (preserveIndex ?: 0).coerceIn(0, cards.size - 1)
                showCard(target)
            }
        }.start()
    }

    private fun showCard(index: Int) {
        currentCardIndex = index
        updateNavControls()
        when (val card = cards[index]) {
            is DemoCard.Experiment -> showExperimentCard(card.variant)
            DemoCard.General -> showGeneralCard()
        }
    }

    private fun updateNavControls() {
        val pagingVisible = if (cards.size > 1) View.VISIBLE else View.GONE
        findViewById<View>(R.id.prevExperimentButton).visibility = pagingVisible
        findViewById<View>(R.id.nextExperimentButton).visibility = pagingVisible

        val indicator = findViewById<TextView>(R.id.experimentPageIndicator)
        if (cards.size > 1) {
            indicator.visibility = View.VISIBLE
            indicator.text = getString(R.string.main_experiment_page, currentCardIndex + 1, cards.size)
        } else {
            indicator.visibility = View.GONE
        }
    }

    private fun showLoadingCard() {
        currentVariant = null

        val experimentTitle = findViewById<TextView>(R.id.experimentTitle)
        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val experimentDescription = findViewById<TextView>(R.id.experimentDescription)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val feedbackWidgetContainer = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)
        val indicator = findViewById<TextView>(R.id.experimentPageIndicator)

        experimentTitle.text = getString(R.string.main_loading_title)
        variantLabel.visibility = View.GONE
        experimentDescription.text = getString(R.string.main_loading_message)
        findViewById<View>(R.id.generalCardInstructions).visibility = View.GONE
        ctaButton.visibility = View.GONE
        feedbackPrompt.visibility = View.GONE
        feedbackWidgetContainer.visibility = View.GONE
        submitFeedbackButton.visibility = View.GONE
        findViewById<View>(R.id.prevExperimentButton).visibility = View.GONE
        findViewById<View>(R.id.nextExperimentButton).visibility = View.GONE
        indicator.visibility = View.GONE

        clearFeedbackWidgetState()
        applyTheme(LIGHT_PALETTE)
    }

    private fun showGeneralCard() {
        currentVariant = null

        val experimentTitle = findViewById<TextView>(R.id.experimentTitle)
        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val experimentDescription = findViewById<TextView>(R.id.experimentDescription)
        val generalCardInstructions = findViewById<TextView>(R.id.generalCardInstructions)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val feedbackWidgetContainer = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        experimentTitle.text = getString(R.string.main_general_card_title)
        variantLabel.visibility = View.GONE
        experimentDescription.text = getString(R.string.main_general_card_message)
        generalCardInstructions.text = getString(R.string.main_general_card_instructions)
        generalCardInstructions.visibility = View.VISIBLE
        ctaButton.visibility = View.GONE
        feedbackPrompt.visibility = View.GONE
        feedbackWidgetContainer.visibility = View.GONE
        submitFeedbackButton.visibility = View.GONE

        clearFeedbackWidgetState()
        applyTheme(LIGHT_PALETTE)
    }

    private fun showExperimentCard(variant: VariantResult) {
        currentVariant = variant

        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val experimentTitle = findViewById<TextView>(R.id.experimentTitle)
        val experimentDescription = findViewById<TextView>(R.id.experimentDescription)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val feedbackWidgetContainer = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)
        val submitFeedbackButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)

        findViewById<View>(R.id.generalCardInstructions).visibility = View.GONE
        experimentTitle.text = variant.experimentName
        variantLabel.text = getString(R.string.main_variant_label, variant.variantName)
        variantLabel.visibility = View.VISIBLE

        // Which visual treatment a variant gets is derived from its stable
        // ID, not its name — a name-based check (e.g. endsWith("B")) breaks
        // the moment a developer names variants anything else.
        val useAlternateStyle = variant.variantId.hashCode() and 1 != 0
        ctaButton.text = if (useAlternateStyle) getString(R.string.main_cta_variant_b) else getString(R.string.main_cta_default)
        ctaButton.visibility = View.VISIBLE
        experimentDescription.text = getString(
            R.string.main_experiment_active,
            variant.variantName,
            variant.experimentName,
        )

        buildFeedbackWidget(variant.feedbackType, variant.choices)
        feedbackPrompt.visibility = View.VISIBLE
        feedbackWidgetContainer.visibility = View.VISIBLE
        submitFeedbackButton.visibility = View.VISIBLE

        applyTheme(if (useAlternateStyle) BLUE_DARK_PALETTE else LIGHT_PALETTE)
    }

    /**
     * The experiment's feedbackType decides which primary widget shows up
     * here — set once, server-side, when the experiment is created. Every
     * type also gets an optional comment field, since the SDK's submit
     * calls already accept one.
     */
    private fun buildFeedbackWidget(feedbackType: String, choices: List<String>?) {
        clearFeedbackWidgetState()
        val container = findViewById<LinearLayout>(R.id.feedbackWidgetContainer)

        when (feedbackType) {
            "STAR_RATING" -> {
                val bar = RatingBar(this, null, android.R.attr.ratingBarStyle).apply {
                    numStars = 5
                    stepSize = 1f
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    )
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
        }

        val comment = EditText(this).apply {
            hint = getString(R.string.main_comment_hint)
            minLines = 2
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = (12 * resources.displayMetrics.density).toInt() }
        }
        container.addView(comment)
        commentInput = comment
    }

    private fun clearFeedbackWidgetState() {
        findViewById<LinearLayout>(R.id.feedbackWidgetContainer).removeAllViews()
        ratingBarWidget = null
        thumbsUpButton = null
        thumbsDownButton = null
        thumbsSelected = null
        choiceRadioGroup = null
        commentInput = null
    }

    private fun updateThumbsSelection() {
        thumbsUpButton?.alpha = if (thumbsSelected == true) 1f else 0.5f
        thumbsDownButton?.alpha = if (thumbsSelected == false) 1f else 0.5f
    }

    private fun submitFeedback() {
        val variant = currentVariant ?: return
        val comment = commentInput?.text?.toString()?.trim()?.ifBlank { null }

        when (variant.feedbackType) {
            "STAR_RATING" -> {
                val rating = ratingBarWidget?.rating?.toInt() ?: 0
                if (rating < 1) return
                PulseSDK.submitStarRating(variantId = variant.variantId, rating = rating, comment = comment, screenId = "main-screen")
            }
            "THUMBS" -> {
                val positive = thumbsSelected ?: return
                PulseSDK.submitThumbs(variantId = variant.variantId, positive = positive, comment = comment, screenId = "main-screen")
            }
            "MULTIPLE_CHOICE" -> {
                val group = choiceRadioGroup ?: return
                val checkedId = group.checkedRadioButtonId
                if (checkedId == View.NO_ID) return
                val index = (0 until group.childCount).indexOfFirst { group.getChildAt(it).id == checkedId }
                if (index < 0) return
                PulseSDK.submitMultipleChoice(variantId = variant.variantId, index = index, comment = comment, screenId = "main-screen")
            }
            else -> return
        }

        commentInput?.setText("")
        Toast.makeText(this, R.string.main_rating_thanks, Toast.LENGTH_SHORT).show()
    }

    /**
     * Applies a hardcoded local palette to make the two variants look
     * visibly different. This is a demo-app-only trick, not something
     * driven by the SDK or the Portal. Covers the toolbar and every
     * feedback widget too, not just the card — otherwise switching themes
     * only half-applies and looks broken.
     */
    private fun applyTheme(palette: DemoPalette) {
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        // Color the ScrollView itself, not the content it wraps — the
        // content is only as tall as it needs to be (wrap_content), so
        // coloring it left a band of the default white background showing
        // below it on any screen taller than the content.
        val scrollRoot = findViewById<View>(R.id.scrollRoot)
        val card = findViewById<MaterialCardView>(R.id.experimentCard)
        val title = findViewById<TextView>(R.id.experimentTitle)
        val variantLabel = findViewById<TextView>(R.id.variantLabel)
        val description = findViewById<TextView>(R.id.experimentDescription)
        val generalCardInstructions = findViewById<TextView>(R.id.generalCardInstructions)
        val feedbackPrompt = findViewById<TextView>(R.id.feedbackPrompt)
        val ctaButton = findViewById<MaterialButton>(R.id.ctaButton)
        val submitButton = findViewById<MaterialButton>(R.id.submitFeedbackButton)
        val sendFeedbackButton = findViewById<MaterialButton>(R.id.sendFeedbackButton)
        val pageIndicator = findViewById<TextView>(R.id.experimentPageIndicator)
        val prevButton = findViewById<MaterialButton>(R.id.prevExperimentButton)
        val nextButton = findViewById<MaterialButton>(R.id.nextExperimentButton)

        val accent = Color.parseColor(palette.accent)
        val accentColors = ColorStateList.valueOf(accent)
        val accentTextOn = Color.parseColor(palette.accentTextOn)
        val textPrimary = Color.parseColor(palette.textPrimary)
        val textSecondary = Color.parseColor(palette.textSecondary)

        toolbar.setBackgroundColor(accent)
        scrollRoot.setBackgroundColor(Color.parseColor(palette.bgBase))
        card.setCardBackgroundColor(Color.parseColor(palette.bgSurface))
        title.setTextColor(textPrimary)
        variantLabel.setTextColor(accent)
        description.setTextColor(textSecondary)
        generalCardInstructions.setTextColor(textSecondary)
        feedbackPrompt.setTextColor(textSecondary)
        ctaButton.backgroundTintList = accentColors
        ctaButton.setTextColor(accentTextOn)
        submitButton.setTextColor(accent)
        submitButton.strokeColor = accentColors
        sendFeedbackButton.setTextColor(accent)
        // These three sit directly on scrollRoot's background, not inside
        // the themed card, so they need their own color or they'd default
        // to a near-black text that disappears against the dark palette.
        pageIndicator.setTextColor(textSecondary)
        prevButton.setTextColor(accent)
        nextButton.setTextColor(accent)

        // Whichever feedback widget is currently showing (only one of these
        // is non-null at a time, set up in buildFeedbackWidget)
        //
        // RatingBar draws its stars as three stacked layers (empty
        // background, secondary, filled progress). Tinting only
        // progressTintList leaves the other two layers on the platform's
        // default gold color, which peeks out around the edges of the
        // newly-tinted stars since the layers aren't pixel-aligned. Tint
        // all three so there's no mismatched color underneath.
        ratingBarWidget?.progressTintList = accentColors
        ratingBarWidget?.secondaryProgressTintList = accentColors
        ratingBarWidget?.progressBackgroundTintList = ColorStateList.valueOf(textSecondary)
        thumbsUpButton?.backgroundTintList = accentColors
        thumbsUpButton?.setTextColor(accentTextOn)
        thumbsDownButton?.backgroundTintList = accentColors
        thumbsDownButton?.setTextColor(accentTextOn)
        choiceRadioGroup?.let { group ->
            for (i in 0 until group.childCount) {
                (group.getChildAt(i) as? RadioButton)?.setTextColor(textPrimary)
            }
        }
        commentInput?.setTextColor(textPrimary)
        commentInput?.setHintTextColor(textSecondary)
        commentInput?.backgroundTintList = accentColors
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        when (item.itemId) {
            R.id.action_logout -> {
                PulseSDK.clearUser()
                DemoSession.clear(this)
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
                return true
            }
            R.id.action_switch_variant -> {
                showVariantSwitcher()
                return true
            }
        }
        return super.onOptionsItemSelected(item)
    }

    /**
     * Demo-app-only testing tool built on the SDK's overrideVariant() — lets
     * you preview any variant of the experiment without needing a different
     * test user for each one.
     */
    private fun showVariantSwitcher() {
        val index = currentCardIndex
        val name = (cards.getOrNull(index) as? DemoCard.Experiment)?.variant?.experimentName
        if (name == null) {
            // The general card has no experiment to switch variants on.
            Toast.makeText(this, R.string.main_switch_variant_none, Toast.LENGTH_SHORT).show()
            return
        }
        Thread {
            val variants = PulseSDK.getExperimentVariants(name)
            runOnUiThread {
                if (variants.isNullOrEmpty()) {
                    Toast.makeText(this, R.string.main_switch_variant_none, Toast.LENGTH_SHORT).show()
                    return@runOnUiThread
                }

                val options = listOf(getString(R.string.main_switch_variant_reset)) + variants.map { it.variantName }
                AlertDialog.Builder(this)
                    .setTitle(R.string.main_switch_variant_title)
                    .setItems(options.toTypedArray()) { _, choiceIndex ->
                        Thread {
                            if (choiceIndex == 0) {
                                PulseSDK.clearVariantOverride(name)
                            } else {
                                PulseSDK.overrideVariant(name, variants[choiceIndex - 1].variantId)
                            }
                            runOnUiThread { refreshCards(preserveIndex = index) }
                        }.start()
                    }
                    .show()
            }
        }.start()
    }
}
