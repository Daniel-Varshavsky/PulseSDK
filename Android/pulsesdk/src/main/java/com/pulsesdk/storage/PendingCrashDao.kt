package com.pulsesdk.storage

import androidx.room.*

@Dao
internal interface PendingCrashDao {

    @Insert
    fun insertBlocking(crash: PendingCrash): Long

    @Query("SELECT * FROM pending_crashes ORDER BY occurredAt ASC")
    suspend fun getAll(): List<PendingCrash>

    @Query("DELETE FROM pending_crashes WHERE id = :id")
    suspend fun deleteById(id: Long)
}
