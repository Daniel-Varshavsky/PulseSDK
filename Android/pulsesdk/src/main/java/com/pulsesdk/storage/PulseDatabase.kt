package com.pulsesdk.storage

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [PendingEvent::class, PendingCrash::class], version = 2, exportSchema = false)
internal abstract class PulseDatabase : RoomDatabase() {

    abstract fun pendingEventDao(): PendingEventDao
    abstract fun pendingCrashDao(): PendingCrashDao

    companion object {
        @Volatile
        private var instance: PulseDatabase? = null

        fun getInstance(context: Context): PulseDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PulseDatabase::class.java,
                    "pulse_db"
                )
                    // This is a transient local queue, not a system of record —
                    // losing unsent events across an app-version upgrade that
                    // changes the schema is an acceptable trade-off against
                    // hand-writing Room migrations for a cache table.
                    .fallbackToDestructiveMigration()
                    // A crash can happen on the main thread, and the crash
                    // handler needs the write to complete before the process
                    // dies — no dispatcher hop it can safely wait on. Scoped to
                    // this one blocking DAO call (PendingCrashDao.insertBlocking);
                    // every other access in the SDK stays off the main thread.
                    .allowMainThreadQueries()
                    .build().also { instance = it }
            }
        }
    }
}