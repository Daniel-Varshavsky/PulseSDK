package com.pulsesdk.storage

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_events")
internal data class PendingEvent(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: String,
    val variantId: String?,
    val type: String,
    val value: String,
    val comment: String?,
    val screenId: String?,
    val appVersion: String?,
    val createdAt: Long = System.currentTimeMillis(),
)