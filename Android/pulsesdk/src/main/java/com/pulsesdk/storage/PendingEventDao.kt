package com.pulsesdk.storage

import androidx.room.*

@Dao
internal interface PendingEventDao {

    @Insert
    suspend fun insert(event: PendingEvent): Long

    @Query("SELECT * FROM pending_events ORDER BY createdAt ASC")
    suspend fun getAll(): List<PendingEvent>

    @Delete
    suspend fun delete(event: PendingEvent)

    @Query("DELETE FROM pending_events WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("SELECT COUNT(*) FROM pending_events")
    suspend fun count(): Int
}