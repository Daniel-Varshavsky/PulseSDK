package com.pulsesdk.network

import com.pulsesdk.network.requests.*
import com.pulsesdk.network.responses.*
import retrofit2.http.*

internal interface PulseApiService {

    // The SDK only ever acts on running experiments, so scope the request
    // server-side instead of shipping paused/draft/completed experiments
    // to the device just to filter them out locally. appVersion lets the
    // server also exclude experiments this device doesn't qualify for
    // (minAppVersion targeting) before they're ever sent down.
    @GET("experiments")
    suspend fun getExperiments(
        @Query("status") status: String = "ACTIVE",
        @Query("appVersion") appVersion: String? = null,
    ): List<ExperimentResponse>

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

    @POST("exposure")
    suspend fun logExposure(@Body body: ExposureRequest)

    @POST("crashes")
    suspend fun submitCrash(@Body body: CrashReportRequest)
}