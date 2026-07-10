package com.pulsesdk.demo

import android.content.Context

/**
 * Tracks whether the demo app itself has a user "logged in", purely for
 * deciding which screen to show. This is separate from anything PulseSDK
 * persists internally.
 */
object DemoSession {

    private const val PREFS_NAME = "demo_session"
    private const val KEY_USER_ID = "user_id"

    fun setUserId(context: Context, userId: String) {
        prefs(context).edit().putString(KEY_USER_ID, userId).apply()
    }

    fun getUserId(context: Context): String? {
        return prefs(context).getString(KEY_USER_ID, null)
    }

    fun clear(context: Context) {
        prefs(context).edit().remove(KEY_USER_ID).apply()
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
