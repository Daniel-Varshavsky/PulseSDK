package com.pulsesdk.storage

import androidx.room.Entity
import androidx.room.PrimaryKey

// Written synchronously from the uncaught-exception handler, before the
// process dies — same write-ahead-log rationale as PendingEvent, but crash
// capture can't rely on a coroutine dispatcher getting a turn to run before
// the process is gone, so the insert happens with runBlocking on the
// crashing thread itself.
@Entity(tableName = "pending_crashes")
internal data class PendingCrash(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: String,
    val message: String,
    val stackTrace: String,
    val appVersion: String?,
    val occurredAt: Long,
)
