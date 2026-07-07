package com.pulsesdk.network

import com.pulsesdk.network.requests.*
import com.pulsesdk.network.responses.*
import retrofit2.http.*

internal interface PulseApiService {

    @GET("experiments")
    suspend fun getExperiments(): List<ExperimentResponse>

    @POST("feedback")
    suspend fun submitFeedback(@Body body: FeedbackRequest): FeedbackResponse

    @POST("devices/register")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): DeviceResponse

    @POST("devices/identify")
    suspend fun identifyUser(@Body body: IdentifyRequest): DeviceResponse

    @POST("devices/clear")
    suspend fun clearUser(@Body body: ClearUserRequest)

    @POST("devices/refresh-token")
    suspend fun refreshToken(@Body body: RefreshTokenRequest)
}