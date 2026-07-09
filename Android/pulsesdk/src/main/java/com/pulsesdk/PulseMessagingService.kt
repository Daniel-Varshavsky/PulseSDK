package com.pulsesdk

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class PulseMessagingService : FirebaseMessagingService() {

    /**
     * Called by Firebase when a new FCM token is issued —
     * on first app launch, or when the token is rotated.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PulseSDK.refreshFcmToken(token)
    }

    /**
     * FCM only auto-displays notification-type messages when the app is backgrounded
     * or killed — while the app is in the foreground they're delivered here instead,
     * so we have to build and show them ourselves or they're silently dropped.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val notification = message.notification ?: return
        showNotification(notification.title, notification.body)
    }

    private fun showNotification(title: String?, body: String?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Notifications", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?.putExtra(EXTRA_FROM_NOTIFICATION, true)
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(applicationInfo.icon)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        /**
         * Set to true on the launch Intent when the app is opened by tapping a
         * PulseSDK push notification. Check this in your launcher Activity's
         * intent (e.g. `intent.getBooleanExtra(PulseMessagingService.EXTRA_FROM_NOTIFICATION, false)`)
         * to route the user somewhere specific.
         */
        const val EXTRA_FROM_NOTIFICATION = "com.pulsesdk.FROM_NOTIFICATION"

        private const val CHANNEL_ID = "pulsesdk_notifications"
    }
}
