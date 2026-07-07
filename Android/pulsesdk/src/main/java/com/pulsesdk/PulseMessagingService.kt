package com.pulsesdk

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
     * Called when a push notification is received while the app is in the foreground.
     * Developers can override this in their own MessagingService if they need
     * custom handling — for now we just let the system handle it.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
    }
}