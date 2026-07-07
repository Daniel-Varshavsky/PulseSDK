package com.pulsesdk.storage

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [PendingEvent::class], version = 1, exportSchema = false)
internal abstract class PulseDatabase : RoomDatabase() {

    abstract fun pendingEventDao(): PendingEventDao

    companion object {
        @Volatile
        private var instance: PulseDatabase? = null

        fun getInstance(context: Context): PulseDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PulseDatabase::class.java,
                    "pulse_db"
                ).build().also { instance = it }
            }
        }
    }
}