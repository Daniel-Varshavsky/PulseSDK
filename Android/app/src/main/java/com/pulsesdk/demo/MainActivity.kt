package com.pulsesdk.demo

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.RatingBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.pulsesdk.PulseMessagingService
import com.pulsesdk.PulseSDK
import com.pulsesdk.VariantResult
import com.pulsesdk.demo.model.DemoPalette
import com.pulsesdk.demo.util.AppTheme
import com.pulsesdk.demo.util.DemoSession

class MainActivity : AppCompatActivity() {

    /**
     * One page of the main-screen carousel — either a live experiment
     * (with its assigned variant) or the trailing general-info page. The
     * set of experiment names isn't hardcoded anywhere:
     * PulseSDK.getActiveVariants() reports whatever's currently active in
     * the Portal, and the app just builds one card per result. Nested
     * here rather than top-level since it's only ever used by this class.
     */
    private sealed class DemoCard {
        data class Experiment(val variant: VariantResult) : DemoCard()
        object General : DemoCard()
    }

    private var cards: List<DemoCard> = emptyList()
    private var currentCardIndex = 0
    private var currentVariant: VariantResult? = null

    // Resolved once per refreshCards() call from whatever's currently
    // active — see AppTheme.resolveAppPalette(). Defaults to light until
    // the first fetch resolves.
    private var appPalette: DemoPalette = AppTheme.LIGHT_PALETTE

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
            val palette = AppTheme.resolveAppPalette(variants)
            runOnUiThread {
                appPalette = palette
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
        applyMetadataFeatures(null)
        applyMetadataSelect(null, Color.parseColor(appPalette.textPrimary))

        clearFeedbackWidgetState()
        applyTheme(appPalette)
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
        applyMetadataFeatures(null)
        applyMetadataSelect(null, Color.parseColor(appPalette.textPrimary))

        clearFeedbackWidgetState()
        applyTheme(appPalette)
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

        // The CTA copy still varies per-variant, derived from the variant's
        // stable ID rather than its name (a name-based check like
        // endsWith("B") breaks the moment a developer names variants
        // anything else) — this is independent of the app-wide color
        // theme below, so experiments that don't drive appTheme can still
        // visibly differ between their own variants.
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
        applyMetadataFeatures(variant.metadata)
        applyMetadataSelect(variant.metadata, Color.parseColor(appPalette.textPrimary))

        applyTheme(appPalette)
    }

    /**
     * Demonstrates a variant actually changing what the app does, not just
     * how it looks: when a variant's metadata sets a numeric "itemLimit",
     * show that many items from a small local suggestion list. Variants
     * without it (or with a non-numeric/zero value) show nothing here,
     * same as before metadata existed — this is additive, not required.
     */
    private fun applyMetadataFeatures(metadata: Map<String, String>?) {
        val container = findViewById<View>(R.id.metadataFeaturesContainer)
        val list = findViewById<LinearLayout>(R.id.metadataFeaturesList)
        list.removeAllViews()

        val limit = metadata?.get("itemLimit")?.toIntOrNull()
        if (limit == null || limit <= 0) {
            container.visibility = View.GONE
            return
        }

        resources.getStringArray(R.array.main_feature_suggestions).take(limit).forEach { suggestion ->
            list.addView(TextView(this).apply {
                text = "•  $suggestion"
                textSize = 13f
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { topMargin = (2 * resources.displayMetrics.density).toInt() }
            })
        }
        container.visibility = View.VISIBLE
    }

    /**
     * A second, independent demonstration of metadata driving real app
     * behavior: a variant's metadata can set "selectOptions" as a
     * comma-separated list, which populates a dropdown here. Variants
     * without it show nothing, same as applyMetadataFeatures().
     *
     * [textColor] is passed in rather than read from applyTheme() because
     * this needs to run before applyTheme() applies the palette — the
     * Spinner's collapsed/inline view sits directly on the card, so its
     * text must match the card's forced palette rather than whatever the
     * system's real day/night mode happens to resolve to (the same class
     * of mismatch that broke the toolbar popup earlier). The dropdown
     * list itself is left un-tinted on purpose — it's a floating overlay
     * like the toolbar popup, not part of the card surface, so it should
     * follow the real system theme instead.
     */
    private fun applyMetadataSelect(metadata: Map<String, String>?, textColor: Int) {
        val container = findViewById<View>(R.id.metadataSelectContainer)
        val spinner = findViewById<Spinner>(R.id.metadataSelectSpinner)

        val options = metadata?.get("selectOptions")
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            .orEmpty()

        if (options.isEmpty()) {
            container.visibility = View.GONE
            spinner.adapter = null
            return
        }

        spinner.adapter = object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, options) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val view = super.getView(position, convertView, parent) as TextView
                view.setTextColor(textColor)
                return view
            }
        }.apply { setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }

        container.visibility = View.VISIBLE
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
                    icon = ContextCompat.getDrawable(this@MainActivity, R.drawable.round_thumb_up_24)
                    iconPadding = 0
                    iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
                    insetTop = 0
                    insetBottom = 0
                    alpha = 0.5f
                    setOnClickListener {
                        thumbsSelected = true
                        updateThumbsSelection()
                    }
                }
                val down = MaterialButton(this).apply {
                    icon = ContextCompat.getDrawable(this@MainActivity, R.drawable.round_thumb_down_24)
                    iconPadding = 0
                    iconGravity = MaterialButton.ICON_GRAVITY_TEXT_START
                    insetTop = 0
                    insetBottom = 0
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
     * Applies the app-wide palette (see AppTheme.resolveAppPalette()) to
     * this screen. This is a demo-app-only trick, not something driven by
     * the SDK or the Portal. Covers the toolbar and every feedback widget
     * too, not just the card — otherwise switching themes only
     * half-applies and looks broken.
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
        val metadataFeaturesTitle = findViewById<TextView>(R.id.metadataFeaturesTitle)
        val metadataFeaturesList = findViewById<LinearLayout>(R.id.metadataFeaturesList)
        val metadataSelectLabel = findViewById<TextView>(R.id.metadataSelectLabel)
        val metadataSelectSpinner = findViewById<Spinner>(R.id.metadataSelectSpinner)
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
        metadataFeaturesTitle.setTextColor(textPrimary)
        for (i in 0 until metadataFeaturesList.childCount) {
            (metadataFeaturesList.getChildAt(i) as? TextView)?.setTextColor(textSecondary)
        }
        metadataSelectLabel.setTextColor(textPrimary)
        // mutate() so re-tinting this drawable doesn't bleed into every
        // other view still sharing the un-mutated @drawable/spinner_background.
        // It's a layer-list: layer 0 is the outline shape, the arrow is
        // looked up by id since it's a separate layered-on drawable.
        (metadataSelectSpinner.background?.mutate() as? LayerDrawable)?.let { layers ->
            (layers.getDrawable(0) as? GradientDrawable)?.setStroke(
                (1 * resources.displayMetrics.density).toInt(),
                accent,
            )
            layers.findDrawableByLayerId(R.id.spinnerArrowLayer)?.setTint(accent)
        }
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
        val accentTextOnColors = ColorStateList.valueOf(accentTextOn)
        thumbsUpButton?.backgroundTintList = accentColors
        thumbsUpButton?.iconTint = accentTextOnColors
        thumbsDownButton?.backgroundTintList = accentColors
        thumbsDownButton?.iconTint = accentTextOnColors
        choiceRadioGroup?.let { group ->
            for (i in 0 until group.childCount) {
                (group.getChildAt(i) as? RadioButton)?.apply {
                    setTextColor(textPrimary)
                    // The radio circle itself is a separate tintable
                    // drawable from the label text — only theming the
                    // text left the circle stuck on the system default
                    // color regardless of palette.
                    buttonTintList = accentColors
                }
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
