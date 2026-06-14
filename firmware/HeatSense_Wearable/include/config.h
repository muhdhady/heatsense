// Auto-generated from HeatSense_Final_SingleModel.ipynb
// Do not edit by hand — rerun notebook to update.
#pragma once

// Model input
#define WINDOW_SIZE       30       // rows per inference
#define N_FEATURES        14       // columns per row
#define FORECAST_HORIZON  5        // prediction is for Tcore this many minutes ahead

// Feature order (input tensor columns — MUST match Python DYNAMIC_FEATURES)
// ['HR', 'SkinTemp_UpperArm', 'time_in_session', 'cumulative_HR', 'HR_slope_5m', 'SkinTemp_slope_5m', 'Perceptual_TC', 'Env_WetBulb', 'HR_above_baseline', 'SkinTemp_above_baseline', 'HR_mean_60m', 'HR_zone4_60m', 'SkinTemp_mean_60m', 'SkinTemp_change_60m']
const char* ssid = "El-Kady";
const char* password = "!AWfha100805!";
const char* serverUrl = "https://heatsense.vercel.app/api/ingest"; // Update with your actual URL
const char* apiKey = "super-secure-iot-secret";
const String deviceId = "HS-001";

// Per-feature standardization: feat_scaled = (feat_raw - mean) / std
static const float FEATURE_MEAN[N_FEATURES] = { 125.159581f, 36.464155f, 57.412767f, 2780.027016f, 3.491797f, 0.159740f, 13.949346f, 23.778099f, 52.496470f, 2.705732f, 112.272217f, 6.844546f, 35.958827f, 0.102012f };
static const float FEATURE_STD [N_FEATURES] = { 29.571886f, 1.379666f, 34.341507f, 2155.182477f, 15.750537f, 0.558390f, 4.296398f, 5.357877f, 29.049180f, 1.563028f, 23.291890f, 11.711115f, 1.309230f, 1.063048f };

// Target denormalization
#define Y_MEAN            37.874903f
#define Y_STD             0.567159f

// Uncertainty-aware alerting
#define K_SIGMA           0.500f

// Alert thresholds (°C on the denormalized alert_val)
#define RED_THRESHOLD     38.30f
#define RED_SUSTAIN       2

// --- Firmware post-processing (pseudocode) ---------------------------------
//   float mu_std, lv_std;                     // raw model outputs (dequantized from INT8)
//   float mu_C      = mu_std * Y_STD + Y_MEAN;
//   float sigma_C   = expf(0.5f * lv_std) * Y_STD;
//   float alert_val = mu_C + K_SIGMA * sigma_C;
//
//   if  sustained(alert_val >= RED_THRESHOLD,   RED_SUSTAIN)    -> RED
//   elif sustained(alert_val >= YELLOW_THRESHOLD, YELLOW_SUSTAIN) -> YELLOW
//   else                                                          -> NORMAL
