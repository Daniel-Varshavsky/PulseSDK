package com.pulsesdk.demo

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.pulsesdk.PulseSDK
import com.pulsesdk.demo.util.DemoSession

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val userIdLayout = findViewById<TextInputLayout>(R.id.userIdLayout)
        val userIdInput = findViewById<TextInputEditText>(R.id.userIdInput)

        findViewById<View>(R.id.continueButton).setOnClickListener {
            val userId = userIdInput.text?.toString()?.trim().orEmpty()
            if (userId.isEmpty()) {
                userIdLayout.error = getString(R.string.login_error_blank)
                return@setOnClickListener
            }
            userIdLayout.error = null

            PulseSDK.identify(userId)
            DemoSession.setUserId(this, userId)

            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
