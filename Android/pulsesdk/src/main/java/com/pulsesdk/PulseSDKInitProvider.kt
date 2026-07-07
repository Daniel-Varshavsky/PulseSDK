package com.pulsesdk

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Bundle

internal class PulseSDKInitProvider : ContentProvider() {

    override fun onCreate(): Boolean {
        val ctx = context ?: return false

        try {
            val appInfo = ctx.packageManager.getApplicationInfo(
                ctx.packageName,
                PackageManager.GET_META_DATA,
            )
            val meta: Bundle = appInfo.metaData ?: return false

            val apiKey = meta.getString("com.pulsesdk.API_KEY") ?: return false
            val serverUrl = meta.getString("com.pulsesdk.SERVER_URL")

            PulseSDK.initInternal(ctx, apiKey, serverUrl)
        } catch (e: Exception) {
            // Auto-init failed silently — the developer can still call PulseSDK.init() manually.
            // We intentionally swallow this so a misconfigured SDK never crashes the host app.
        }

        return true
    }

    override fun query(uri: Uri, projection: Array<String>?, selection: String?, selectionArgs: Array<String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<String>?): Int = 0
}