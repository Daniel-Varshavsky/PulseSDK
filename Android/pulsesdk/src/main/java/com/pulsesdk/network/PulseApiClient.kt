package com.pulsesdk.network

import com.pulsesdk.PulseConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

internal object PulseApiClient {

    private var retrofit: Retrofit? = null

    fun getService(): PulseApiService {
        if (retrofit == null || retrofit!!.baseUrl().toString() != PulseConfig.serverUrl + "/") {
            retrofit = buildRetrofit()
        }
        return retrofit!!.create(PulseApiService::class.java)
    }

    private fun buildRetrofit(): Retrofit {
        val apiKeyInterceptor = Interceptor { chain ->
            val request = chain.request().newBuilder()
                .addHeader("x-api-key", PulseConfig.apiKey)
                .build()
            chain.proceed(request)
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(apiKeyInterceptor)
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(PulseConfig.serverUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}