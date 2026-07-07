package com.pulsesdk

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val textView = TextView(this).apply {
            text = "PulseSDK Test Harness\nCheck Logcat for output"
            textSize = 18f
            setPadding(48, 96, 48, 48)
        }
        setContentView(textView)

        CoroutineScope(Dispatchers.IO).launch {
            // Development fallback for emulator — FCM doesn't work without Google Play Services
            if (android.os.Build.FINGERPRINT.contains("generic") ||
                android.os.Build.FINGERPRINT.contains("unknown")) {
                PulseSDK.setTestFcmToken("test-fcm-token-android-emulator")
            }
            PulseSDK.identify("test-user-android")
            delay(2000)

            Log.d("PulseSDK", "About to fetch variant...")
            val variant = PulseSDK.getVariant("Playlist Sort UI")
            Log.d("PulseSDK", "Variant: $variant")

            if (variant != null) {
                PulseSDK.submitStarRating(
                    variantId = variant.variantId,
                    rating = 5,
                    comment = "Great from Android!",
                    screenId = "main-screen",
                )
                Log.d("PulseSDK", "Star rating submitted")
            }

            PulseSDK.submitText(
                text = "This is a test from the Android SDK",
                screenId = "main-screen",
            )
            Log.d("PulseSDK", "Standalone text submitted")
        }
    }
}