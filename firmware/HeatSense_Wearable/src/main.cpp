// ================================================================
// HeatSense - Core Body Temperature Prediction System
// ESP32 (Adafruit HUZZAH32) + EmotiBit FeatherWing
//
// State Machine:
//   WAITING_FOR_NFC → VALIDATING_BIOMETRICS → MONITORING → ALERT_ACTIVE
//
// ML Pipeline:
//   Raw PPG + Thermopile + Env sensors → 30-sample sliding window (1/min)
//   → TFLite Bayesian 1D-CNN (14 features) → Predicted Tcore (°C) + uncertainty
//   → Gaussian risk score → alert if ≥38.30°C for RED_SUSTAIN consecutive mins
//
// Model: heatsense_modelfinal_data (23,856 bytes, fully INT8)
// ================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <EmotiBit.h>
#include <EmotiBit_Si7013.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Adafruit_PN532.h>
#include <Adafruit_DRV2605.h>
#include <cmath>

#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"

#include "heatsense_modelfinal.h"
#include "config.h"


// ================================================================
// DEBUG & TEST FLAGS
// ================================================================
//#define TEST_I2C_BUS
//#define DEBUG_NFC_ID "HS-001"
#define DEBUG_POST_INTERVAL_MS  30000UL
//#define DEBUG_FORCE_SD_LOG
// ================================================================


// ================================================================
// BIOMETRIC VALIDITY THRESHOLDS
// ================================================================
#define HR_MIN    40.0f
#define HR_MAX   220.0f
#define TEMP_MIN  27.5f
#define TEMP_MAX  42.0f

#define SENSOR_DROPOUT_MAX_MS  300000UL

#define MAX_SESSION_MIN        240.0f
#define HR_ZONE4_BPM           150.0f
#define BASELINE_SAMPLES       5


// ================================================================
// ML CONFIGURATION
// ================================================================
static tflite::MicroErrorReporter micro_error_reporter;
static tflite::ErrorReporter* error_reporter = &micro_error_reporter;

constexpr int kArenaSize = 32 * 1024;
static uint8_t tensor_arena[kArenaSize];

static float sensor_buffer[WINDOW_SIZE][N_FEATURES];
static int buf_count = 0;
static int buf_idx   = 0;

static bool alert_ring[RED_SUSTAIN];
static int ring_idx = 0;

static const tflite::Model*        model       = nullptr;
static tflite::MicroInterpreter*   interpreter = nullptr;


// ================================================================
// HARDWARE CONFIGURATION
// ================================================================
#define PN532_IRQ   2
#define PN532_RESET 3
#define BUTTON_PIN  14

Adafruit_SH1107  display = Adafruit_SH1107(64, 128, &Wire);
Adafruit_PN532   nfc(PN532_IRQ, PN532_RESET);
Adafruit_DRV2605 haptic;
EmotiBit         emotibit;


// ================================================================
// SYSTEM STATE
// ================================================================
enum SystemState { WAITING_FOR_NFC, VALIDATING_BIOMETRICS, MONITORING, ALERT_ACTIVE };
SystemState currentState = WAITING_FOR_NFC;

static bool justClearedAlert = false;


// ================================================================
// SESSION VARIABLES
// ================================================================
String workerID      = "None";
float current_hr     = 0.0f;
float current_temp   = 0.0f;
float current_env_t  = 0.0f;
float current_rh     = 0.0f;
float last_mu_C      = 0.0f;
float cumulative_hr  = 0.0f;
unsigned long sessionStartTime = 0;

static unsigned long last_hr_time   = 0;
static unsigned long last_temp_time = 0;
static unsigned long last_env_time  = 0;
static unsigned long last_rh_time   = 0;

const int TC_LEVELS[] = {17, 5, 11};
int tc_idx    = 0;
int currentTC = 0;

static float baseline_hr         = 0.0f;
static float baseline_temp       = 0.0f;
static int   baseline_count      = 0;
static float baseline_hr_sum     = 0.0f;
static float baseline_temp_sum   = 0.0f;
static unsigned long lastHapticTime = 0;

#define BUF60_SIZE  60
static float buf60_hr[BUF60_SIZE];
static float buf60_temp[BUF60_SIZE];
static int   buf60_idx   = 0;
static int   buf60_count = 0;


// ================================================================
// HEART RATE PROCESSING
// ================================================================
#define PPG_FS            75.0f
#define PPG_BUF_SIZE      450
#define PPG_SLIDE         75
#define PPG_MIN_PEAK_DIST 45
#define HR_HISTORY_SIZE   5

static float ppg_buf[PPG_BUF_SIZE];
static int   ppg_buf_count = 0;
static float ppg_stableBPM = 0.0f;
static float hr_history[HR_HISTORY_SIZE];
static int   hr_hist_count = 0;
static float hr_hist_last  = 0.0f;


void applyBandpass(const float* in, float* out, int n) {
    const float hp_alpha = 0.850f;
    const float lp_alpha = 0.253f;
    float hp_prev_in  = in[0];
    float hp_prev_out = 0.0f;
    for (int i = 0; i < n; i++) {
        float hp = hp_alpha * (hp_prev_out + in[i] - hp_prev_in);
        hp_prev_in  = in[i];
        hp_prev_out = hp;
        out[i] = hp;
    }
    float lp_prev = out[0];
    for (int i = 0; i < n; i++) {
        lp_prev += lp_alpha * (out[i] - lp_prev);
        out[i]   = lp_prev;
    }
}

int findPeaks(const float* data, int n, int* peaks_out, int max_peaks,
              int min_dist, float prominence) {
    int count = 0;
    float sig_min = data[0], sig_max = data[0];
    for (int i = 1; i < n; i++) {
        if (data[i] < sig_min) sig_min = data[i];
        if (data[i] > sig_max) sig_max = data[i];
    }
    float threshold = (sig_max - sig_min) * prominence;
    for (int i = 1; i < n - 1 && count < max_peaks; i++) {
        if (data[i] <= data[i - 1] || data[i] <= data[i + 1]) continue;
        if (data[i] - sig_min < threshold)                     continue;
        if (count > 0 && (i - peaks_out[count - 1]) < min_dist) continue;
        peaks_out[count++] = i;
    }
    return count;
}

float medianOf(float* arr, int n) {
    float sorted[HR_HISTORY_SIZE];
    memcpy(sorted, arr, n * sizeof(float));
    for (int i = 1; i < n; i++) {
        float key = sorted[i];
        int j = i - 1;
        while (j >= 0 && sorted[j] > key) { sorted[j + 1] = sorted[j]; j--; }
        sorted[j + 1] = key;
    }
    return sorted[n / 2];
}

float getHeartRate() { return ppg_stableBPM; }

void updateHeartRate() {
    float raw[120];
    size_t n = emotibit.readData(EmotiBit::DataType::PPG_INFRARED, raw, 120);

    for (size_t i = 0; i < n; i++) {
        if (ppg_buf_count < PPG_BUF_SIZE) {
            ppg_buf[ppg_buf_count++] = raw[i];
        } else {
            memmove(ppg_buf, ppg_buf + PPG_SLIDE,
                    (PPG_BUF_SIZE - PPG_SLIDE) * sizeof(float));
            ppg_buf[PPG_BUF_SIZE - PPG_SLIDE] = raw[i];
        }
    }

    if (ppg_buf_count < PPG_BUF_SIZE) return;

    static float filtered[PPG_BUF_SIZE];
    applyBandpass(ppg_buf, filtered, PPG_BUF_SIZE);

    float f_min = filtered[0], f_max = filtered[0];
    for (int i = 1; i < PPG_BUF_SIZE; i++) {
        if (filtered[i] < f_min) f_min = filtered[i];
        if (filtered[i] > f_max) f_max = filtered[i];
    }
    float amplitude = f_max - f_min;
    if (amplitude < 1000.0f) {
        // logic in the 60s cycle can detect loss of signal
        ppg_stableBPM = 0.0f;
        hr_hist_count = 0;
        return;
    }

    int peaks[40];
    int peak_count = findPeaks(filtered, PPG_BUF_SIZE, peaks, 40,
                               PPG_MIN_PEAK_DIST, 0.4f);
    if (peak_count < 3) return;

    float interval_sum = 0;
    for (int i = 1; i < peak_count; i++)
        interval_sum += (peaks[i] - peaks[i - 1]);
    float mean_interval = interval_sum / (float)(peak_count - 1);
    float raw_bpm = (PPG_FS / mean_interval) * 60.0f;

    if (raw_bpm < 45.0f || raw_bpm > 160.0f) return;
    if (hr_hist_count > 0 && fabsf(raw_bpm - hr_hist_last) >= 15.0f) return;

    if (hr_hist_count < HR_HISTORY_SIZE) {
        hr_history[hr_hist_count++] = raw_bpm;
    } else {
        memmove(hr_history, hr_history + 1,
                (HR_HISTORY_SIZE - 1) * sizeof(float));
        hr_history[HR_HISTORY_SIZE - 1] = raw_bpm;
    }
    hr_hist_last  = raw_bpm;
    ppg_stableBPM = medianOf(hr_history, hr_hist_count);
}




// ================================================================
// SENSOR HELPERS
// ================================================================
float getAverageFromDevice(EmotiBit::DataType type) {
    float buf[64];
    size_t n = emotibit.readData(type, buf, 64);
    if (n > 0) {
        float sum = 0;
        for (size_t i = 0; i < n; i++) sum += buf[i];
        return sum / (float)n;
    }
    return 0.0f;
}

float getSkinTemp() { return getAverageFromDevice(EmotiBit::DataType::THERMOPILE);    }
float getEnvTemp()  { return getAverageFromDevice(EmotiBit::DataType::TEMPERATURE_0); }
float getHumidity() { return getAverageFromDevice(EmotiBit::DataType::HUMIDITY_0);    }

float stullWetBulb(float T, float RH) {
    return T * atanf(0.151977f * sqrtf(RH + 8.313659f))
           + atanf(T + RH)
           - atanf(RH - 1.676331f)
           + 0.00391838f * powf(RH, 1.5f) * atanf(0.023101f * RH)
           - 4.686035f;
}


// ================================================================
// BIOMETRIC VALIDATION
// ================================================================
bool isBiometricValid(float hr, float temp) {
    return (hr   >= HR_MIN && hr   <= HR_MAX) &&
           (temp >= TEMP_MIN && temp <= TEMP_MAX);
}

void resetSession() {
    buf_count         = 0;
    buf_idx           = 0;
    ring_idx          = 0;
    cumulative_hr     = 0.0f;
    last_mu_C         = 0.0f;
    current_hr        = 0.0f;
    current_temp      = 0.0f;
    current_env_t     = 0.0f;
    current_rh        = 0.0f;
    baseline_hr       = 0.0f;
    baseline_temp     = 0.0f;
    baseline_count    = 0;
    baseline_hr_sum   = 0.0f;
    baseline_temp_sum = 0.0f;
    buf60_idx         = 0;
    buf60_count       = 0;
    workerID          = "None";
    tc_idx            = 0;
    currentTC         = TC_LEVELS[0];
    ppg_buf_count     = 0;
    ppg_stableBPM     = 0.0f;
    hr_hist_count     = 0;
    hr_hist_last      = 0.0f;
    last_hr_time      = 0;
    last_temp_time    = 0;
    last_env_time     = 0;
    last_rh_time      = 0;
    for (int i = 0; i < RED_SUSTAIN; i++) alert_ring[i] = false;
    memset(buf60_hr,   0, sizeof(buf60_hr));
    memset(buf60_temp, 0, sizeof(buf60_temp));
    currentState = WAITING_FOR_NFC;
    Serial.println("Session ended.");
}


// ================================================================
// NFC
// ================================================================
bool isValidWorkerID(const String& id) {
    if (id.length() != 6)      return false;
    if (!id.startsWith("HS-")) return false;
    for (int i = 3; i < 6; i++) {
        if (!isDigit(id.charAt(i))) return false;
    }
    return true;
}

String readNFCText(uint8_t *uid, uint8_t uidLength) {
    // Try all common keys — order matters, default key first
    uint8_t keys[][6] = {
        { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF },  // Mifare default
        { 0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7 },  // NDEF app key
        { 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5 },  // common alt A
        { 0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5 },  // common alt B
    };
    uint8_t block[16];

    for (uint8_t blockNum = 4; blockNum <= 15; blockNum++) {
        if (blockNum == 7 || blockNum == 11 || blockNum == 15) continue;

        bool authed = false;
        for (auto& key : keys) {
            // Try key type A
            if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, blockNum, 0, key)) {
                authed = true; break;
            }
            // Try key type B
            if (nfc.mifareclassic_AuthenticateBlock(uid, uidLength, blockNum, 1, key)) {
                authed = true; break;
            }
        }
        if (!authed) continue;
        if (!nfc.mifareclassic_ReadDataBlock(blockNum, block)) continue;


        String raw = "";
        for (int i = 0; i < 16; i++) {
            if (block[i] >= 0x20 && block[i] <= 0x7E) raw += (char)block[i];
        }
        int idx = raw.indexOf("HS-");
        if (idx != -1 && idx + 6 <= (int)raw.length()) {
            return raw.substring(idx, idx + 6);
        }
    }
    return "";
}


// ================================================================
// CLOUD SYNC
// ================================================================
void logToSDCard(int alertStatus) {
    // Write header on first call if file does not exist
    File f = SD.open("/heatsense_log.csv", FILE_APPEND);
    if (!f) {
        Serial.println("SD log failed — card not available");
        return;
    }
    // Write header if file is empty
    if (f.size() == 0) {
        f.println("timestamp_ms,workerID,heartRate,skinTemp,riskLevel,tc,tcore");
    }
    String line = "";
    line += String(millis())        + ",";
    line += workerID                + ",";
    line += String(current_hr,  1)  + ",";
    line += String(current_temp, 1) + ",";
    line += String(alertStatus)     + ",";
    line += String(currentTC)       + ",";
    line += String(last_mu_C,   2);
    f.println(line);
    f.close();
    Serial.println("Logged to SD card");
}

void sendDataToCloud(int alertStatus) {
    #ifdef DEBUG_FORCE_SD_LOG
        logToSDCard(alertStatus);
        return;
    #endif

    if (WiFi.status() != WL_CONNECTED) {
        logToSDCard(alertStatus);
        return;
    }
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(10000);
    HTTPClient http;
    if (http.begin(client, serverUrl)) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-api-key", apiKey);
        String payload = "{";
        payload += "\"deviceId\":\""  + deviceId               + "\",";
        payload += "\"heartRate\":"   + String(current_hr,   1) + ",";
        payload += "\"skinTemp\":"    + String(current_temp, 1) + ",";
        payload += "\"riskLevel\":"   + String(alertStatus)     + ",";
        payload += "\"tc\":"          + String(currentTC);
        payload += "}";
        int httpCode = http.POST(payload);
        Serial.printf("POST response: %d\n", httpCode);
        http.end();
    }
}


// ================================================================
// ALERT TRIGGER
// Single function called by BOTH real inference and the debug
// long-press path. Guarantees haptic, Vercel POST, state change,
// and display flash are always identical regardless of trigger source.
// ================================================================

void updateHapticAlert() {
    if (currentState != ALERT_ACTIVE) return;
    if (millis() - lastHapticTime >= 200) {
        lastHapticTime = millis();
        haptic.setMode(DRV2605_MODE_INTTRIG);  // re-assert mode each time
        haptic.setWaveform(0, 1);
        haptic.setWaveform(1, 0);
        haptic.go();
    }
}

void triggerAlert(float tcore_C) {
    last_mu_C      = tcore_C;
    lastHapticTime = 0;
    haptic.setMode(DRV2605_MODE_INTTRIG);  // re-assert mode
    haptic.setWaveform(0, 1);
    haptic.setWaveform(1, 0);
    haptic.go();
    sendDataToCloud(1);
    currentState = ALERT_ACTIVE;
    Serial.printf("ALERT triggered — Tcore=%.2f\n", tcore_C);
}


// ================================================================
// ML MODEL SETUP
// ================================================================
void setup_model() {
    model = tflite::GetModel(heatsense_modelfinal_data);
    static tflite::MicroMutableOpResolver<12> resolver;
    resolver.AddConv2D();
    resolver.AddDepthwiseConv2D();
    resolver.AddReshape();
    resolver.AddExpandDims();
    resolver.AddPad();
    resolver.AddAdd();
    resolver.AddMean();
    resolver.AddRelu();
    resolver.AddFullyConnected();
    resolver.AddQuantize();
    resolver.AddDequantize();
    resolver.AddMul();   // BatchNormalization produces MUL ops
    static tflite::MicroInterpreter static_interpreter(
        model, resolver, tensor_arena, kArenaSize, error_reporter
    );
    interpreter = &static_interpreter;
    interpreter->AllocateTensors();
    Serial.printf("Input shape: %d x %d x %d\n",
    interpreter->input(0)->dims->data[0],
    interpreter->input(0)->dims->data[1],
    interpreter->input(0)->dims->data[2]);
    Serial.printf("Output shape: %d x %d\n",
    interpreter->output(0)->dims->data[0],
    interpreter->output(0)->dims->data[1]);
    Serial.printf("Arena used: %d bytes\n", interpreter->arena_used_bytes());
}


// ================================================================
// SLIDING WINDOW
// ================================================================
void push_sample(float raw_features[N_FEATURES]) {
    for (int i = 0; i < N_FEATURES; i++) {
        sensor_buffer[buf_idx][i] = (raw_features[i] - FEATURE_MEAN[i]) / FEATURE_STD[i];
    }
    buf_idx = (buf_idx + 1) % WINDOW_SIZE;
    if (buf_count < WINDOW_SIZE) buf_count++;
}


// ================================================================
// ML INFERENCE
// ================================================================
int run_inference() {
    if (buf_count < WINDOW_SIZE) return -1;
    TfLiteTensor* input = interpreter->input(0);
    for (int row = 0; row < WINDOW_SIZE; row++) {
        int src = (buf_idx + row) % WINDOW_SIZE;
        for (int col = 0; col < N_FEATURES; col++) {
            int val = (int)roundf(sensor_buffer[src][col] / input->params.scale)
                      + input->params.zero_point;
            input->data.int8[row * N_FEATURES + col] = (int8_t)std::max(-128, std::min(127, val));
        }
    }
    if (interpreter->Invoke() != kTfLiteOk) return -2;
    TfLiteTensor* output = interpreter->output(0);
    float mu_std  = (output->data.int8[0] - output->params.zero_point) * output->params.scale;
    float lv_std  = (output->data.int8[1] - output->params.zero_point) * output->params.scale;
    last_mu_C = mu_std * Y_STD + Y_MEAN;
    float sigma_C = expf(0.5f * lv_std) * Y_STD;
    bool  hit     = (last_mu_C + K_SIGMA * sigma_C >= RED_THRESHOLD);
    alert_ring[ring_idx % RED_SUSTAIN] = hit;
    ring_idx++;
    bool alert = true;
    for (int i = 0; i < RED_SUSTAIN; i++) {
        if (!alert_ring[i]) { alert = false; break; }
    }
    return alert ? 1 : 0;
}


// ================================================================
// DEBUG UTILITIES
// ================================================================
void scanI2CBus() {
    Serial.println("\n--- I2C Bus Scan ---");
    for (byte address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        if (Wire.endTransmission() == 0) {
            Serial.printf("Device at 0x%02X\n", address);
        }
    }
}

void testHapticMotor() {
    haptic.setWaveform(0, 1);
    haptic.setWaveform(1, 0);   // Terminator
    haptic.go();
}


// ================================================================
// DISPLAY
// Flash is driven by the loop calling updateDisplay() every 500ms
// when in ALERT_ACTIVE. Each call toggles flashOn so the screen
// alternates between content and blank every 500ms.
// ================================================================
void updateDisplay() {
    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);

    switch (currentState) {

        case WAITING_FOR_NFC:
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("HeatSense Ready");
            display.setTextSize(2);
            display.setCursor(0, 20);
            display.print("Tap NFC");
            display.setTextSize(1);
            display.setCursor(0, 48);
            display.print("to start session");
            break;

        case VALIDATING_BIOMETRICS:
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("ID: " + workerID);
            display.setCursor(0, 20);
            display.print("Waiting for");
            display.setCursor(0, 32);
            display.print("EmotiBit signal...");
            display.setCursor(0, 48);
            display.print("Please wear device");
            break;

        case MONITORING:
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("HR:   ");
            display.print(current_hr, 1);
            display.print(" bpm");
            display.setCursor(0, 12);
            display.print("Temp: ");
            display.print(current_temp, 1);
            display.print(" C");
            display.setCursor(0, 24);
            display.print("Effort: TC");
            display.print(currentTC);
            display.setCursor(0, 36);
            if (buf_count < WINDOW_SIZE) {
                display.print("Warming up...");
                display.setCursor(0, 48);
                display.print(buf_count);
                display.print("/30 min");
            } else {
                display.print("Tcore~");
                display.print(last_mu_C, 1);
                display.print("C");
                display.setCursor(0, 48);
                display.print("Monitoring");
            }
            break;

        case ALERT_ACTIVE: {
            // toggles every call; loop calls every 500ms → 1Hz blink
            static bool flashOn = true;
            flashOn = !flashOn;
            if (flashOn) {
                display.setTextSize(2);
                display.setCursor(20, 0);
                display.print("ALERT!");
                display.setTextSize(1);
                display.setCursor(0, 28);
                display.print("Tcore: ");
                display.print(last_mu_C, 1);
                display.print(" C");
                display.setCursor(0, 44);
                display.print("Hold btn to clear");
            }
            // flashOn==false: clearDisplay() already ran above → blank screen
            break;
        }
    }

    display.display();
}


// ================================================================
// SETUP
// ================================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("HeatSense booting...");

    pinMode(BUTTON_PIN, INPUT_PULLUP);

    WiFi.begin(ssid, password);
    emotibit.setup();
    setup_model();

    #ifdef TEST_I2C_BUS
        scanI2CBus();
    #endif

    Wire.end();
    delay(50);
    Wire.begin();
    delay(500);

    display.begin(0x3C, true);
    Serial.println("OLED OK");
    display.display();
    delay(1000);
    display.clearDisplay();
    display.display();
    display.setRotation(1);
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.print("Init NFC...");
    display.display();

    nfc.begin();
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (!versiondata) {
        Serial.println("PN532 NOT FOUND");
        display.clearDisplay();
        display.setCursor(0, 0);
        display.print("NFC FAIL!");
        display.display();
        while (1);
    }
    Serial.printf("PN532 firmware: 0x%X\n", versiondata);
    nfc.SAMConfig();
    Serial.println("NFC ready");

    if (!haptic.begin()) {
        Serial.println("DRV2605 NOT FOUND");
    } else {
        haptic.selectLibrary(1);
        haptic.setMode(DRV2605_MODE_INTTRIG);
        testHapticMotor();
    }

    display.clearDisplay();
    display.setCursor(0, 0);
    display.print("System Ready");
    display.display();
    delay(1000);
}


// ================================================================
// MAIN LOOP
// ================================================================
void loop() {
    emotibit.update();
    emotibit.processHeartRate();
    updateHeartRate();
    updateHapticAlert();
    // Display interval: 500ms in ALERT_ACTIVE (drives the flash), 5s otherwise
    static unsigned long lastDisplayTime = 0;
    unsigned long displayInterval = (currentState == ALERT_ACTIVE) ? 500UL : 5000UL;
    if (millis() - lastDisplayTime >= displayInterval) {
        lastDisplayTime = millis();
        updateDisplay();
    }


    switch (currentState) {

        // ------------------------------------------------------------
        // WAITING_FOR_NFC
        // ------------------------------------------------------------
        case WAITING_FOR_NFC: {
            #ifdef DEBUG_NFC_ID
                workerID     = DEBUG_NFC_ID;
                currentState = VALIDATING_BIOMETRICS;
                Serial.println("DEBUG: NFC bypassed, ID = " + workerID);
                break;
            #endif

            uint8_t uid[7]    = { 0 };
            uint8_t uidLength = 0;
            if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100)) {
                String textID = readNFCText(uid, uidLength);
                if (isValidWorkerID(textID)) {
                    workerID     = textID;
                    currentState = VALIDATING_BIOMETRICS;
                    Serial.println("Valid worker ID: " + workerID);
                } else {
                    Serial.println("Card rejected — invalid ID: [" + textID + "]");
                }
            }
            break;
        }

        // ------------------------------------------------------------
        // VALIDATING_BIOMETRICS
        // ------------------------------------------------------------
        case VALIDATING_BIOMETRICS: {
            static unsigned long lastCheck = 0;
            if (millis() - lastCheck >= 2000) {
                lastCheck = millis();
                float hr   = getHeartRate();
                float temp = getSkinTemp();
                Serial.printf("Validating — HR: %.1f  Temp: %.1f\n", hr, temp);
                if (isBiometricValid(hr, temp)) {
                    current_hr       = hr;
                    current_temp     = temp;
                    current_env_t    = getEnvTemp();
                    current_rh       = getHumidity();
                    sessionStartTime = millis();
                    emotibit.setupSdCard(true);
                    currentState     = MONITORING;
                    Serial.println("Biometrics valid — session started.");
                }
            }
            break;
        }

        // ------------------------------------------------------------
        // MONITORING
        //
        // Button behaviour:
        //   short tap  → cycle TC level (5 → 11 → 17 → 5)
        //   hold 3 sec → debug alert via triggerAlert() — identical to
        //                a real inference alert
        // ------------------------------------------------------------
        case MONITORING: {
            static unsigned long lastSampleTime = 0;
            static unsigned long lastPostTime   = 0;

            // ---- Button handling ----
            if (justClearedAlert) {
                justClearedAlert = false;
            } else {
                static unsigned long btnHeld = 0;
                if (digitalRead(BUTTON_PIN) == LOW) {
                    if (btnHeld == 0) btnHeld = millis();
                    if (millis() - btnHeld > 3000) {
                        Serial.println("[DEBUG] Long-press alert trigger");
                        triggerAlert(38.6f);   // same path as real inference
                        btnHeld = 0;
                    }
                } else {
                    if (btnHeld > 0 && millis() - btnHeld < 3000) {
                        tc_idx    = (tc_idx + 1) % 3;
                        currentTC = TC_LEVELS[tc_idx];
                        delay(300);
                    }
                    btnHeld = 0;
                }
            }

            // ---- 60-second inference cycle ----
            if (millis() - lastSampleTime >= 60000UL) {
                lastSampleTime = millis();
                unsigned long now = millis();

                float hr_raw = getHeartRate();
                if (isBiometricValid(hr_raw, 35.0f)) {
                    current_hr   = hr_raw;
                    last_hr_time = now;
                } else if (now - last_hr_time > SENSOR_DROPOUT_MAX_MS) {
                    Serial.println("HR dropout timeout — ending session.");
                    resetSession();
                    break;
                }

                float temp_raw = getSkinTemp();
                if (temp_raw >= TEMP_MIN && temp_raw <= TEMP_MAX) {
                    current_temp   = temp_raw;
                    last_temp_time = now;
                } else if (now - last_temp_time > SENSOR_DROPOUT_MAX_MS) {
                    Serial.println("Skin temp dropout timeout — ending session.");
                    resetSession();
                    break;
                }

                if (!isBiometricValid(current_hr, current_temp)) {
                    Serial.printf("Invalid biometrics (HR:%.1f Temp:%.1f)\n",
                                  current_hr, current_temp);
                    resetSession();
                    break;
                }

                float env_raw = getEnvTemp();
                if (env_raw > 0.0f && env_raw < 60.0f) {
                    current_env_t = env_raw;
                    last_env_time = now;
                }
                float rh_raw = getHumidity();
                if (rh_raw >= 0.0f && rh_raw <= 100.0f) {
                    current_rh   = rh_raw;
                    last_rh_time = now;
                }

                float wet_bulb = stullWetBulb(current_env_t, current_rh);
                float time_min = fminf((float)((now - sessionStartTime) / 60000.0f),
                                       MAX_SESSION_MIN);
                cumulative_hr += fmaxf(0.0f, current_hr - 70.0f);

                float hr_slope = 0.0f, temp_slope = 0.0f;
                if (buf_count >= 5) {
                    int   back     = (buf_idx - 5 + WINDOW_SIZE) % WINDOW_SIZE;
                    float old_hr   = sensor_buffer[back][0] * FEATURE_STD[0] + FEATURE_MEAN[0];
                    float old_temp = sensor_buffer[back][1] * FEATURE_STD[1] + FEATURE_MEAN[1];
                    hr_slope   = current_hr   - old_hr;
                    temp_slope = current_temp - old_temp;
                }

                if (baseline_count < BASELINE_SAMPLES) {
                    baseline_hr_sum   += current_hr;
                    baseline_temp_sum += current_temp;
                    baseline_count++;
                    if (baseline_count == BASELINE_SAMPLES) {
                        baseline_hr   = baseline_hr_sum   / (float)BASELINE_SAMPLES;
                        baseline_temp = baseline_temp_sum / (float)BASELINE_SAMPLES;
                        Serial.printf("Baseline set — HR: %.1f  Temp: %.1f\n",
                                      baseline_hr, baseline_temp);
                    }
                }
                float hr_above_baseline   = (baseline_count >= BASELINE_SAMPLES)
                                            ? (current_hr   - baseline_hr)   : 0.0f;
                float temp_above_baseline = (baseline_count >= BASELINE_SAMPLES)
                                            ? (current_temp - baseline_temp) : 0.0f;

                buf60_hr[buf60_idx]   = current_hr;
                buf60_temp[buf60_idx] = current_temp;
                buf60_idx = (buf60_idx + 1) % BUF60_SIZE;
                if (buf60_count < BUF60_SIZE) buf60_count++;

                float hr_mean_60m     = 0.0f;
                float hr_zone4_60m    = 0.0f;
                float temp_mean_60m   = 0.0f;
                float temp_change_60m = 0.0f;

                if (buf60_count > 0) {
                    for (int i = 0; i < buf60_count; i++) {
                        int idx = (buf60_idx - buf60_count + i + BUF60_SIZE) % BUF60_SIZE;
                        hr_mean_60m   += buf60_hr[idx];
                        temp_mean_60m += buf60_temp[idx];
                        if (buf60_hr[idx] > HR_ZONE4_BPM) hr_zone4_60m += 1.0f;
                    }
                    hr_mean_60m   /= (float)buf60_count;
                    temp_mean_60m /= (float)buf60_count;
                    int oldest = (buf60_idx - buf60_count + BUF60_SIZE) % BUF60_SIZE;
                    int newest = (buf60_idx - 1 + BUF60_SIZE) % BUF60_SIZE;
                    temp_change_60m = buf60_temp[newest] - buf60_temp[oldest];
                }

                float feats[N_FEATURES] = {
                    current_hr,           // 0  HR
                    current_temp,         // 1  SkinTemp_UpperArm
                    time_min,             // 2  time_in_session
                    cumulative_hr,        // 3  cumulative_HR
                    hr_slope,             // 4  HR_slope_5m
                    temp_slope,           // 5  SkinTemp_slope_5m
                    (float)currentTC,     // 6  Perceptual_TC
                    wet_bulb,             // 7  Env_WetBulb
                    hr_above_baseline,    // 8  HR_above_baseline
                    temp_above_baseline,  // 9  SkinTemp_above_baseline
                    hr_mean_60m,          // 10 HR_mean_60m
                    hr_zone4_60m,         // 11 HR_zone4_60m
                    temp_mean_60m,        // 12 SkinTemp_mean_60m
                    temp_change_60m       // 13 SkinTemp_change_60m
                };

                push_sample(feats);

                int result = run_inference();
                Serial.printf("Inference: result=%d  Tcore=%.2f  HR=%.1f  Temp=%.1f\n",
                              result, last_mu_C, current_hr, current_temp);

                if (result == 1) {
                    triggerAlert(last_mu_C);   // real inference alert
                }
            }
            if (millis() - lastPostTime >= DEBUG_POST_INTERVAL_MS) {
                    lastPostTime = millis();
                    if (currentState != ALERT_ACTIVE) {
                        sendDataToCloud(0);
                    }
                }
            break;
        }

        // ------------------------------------------------------------
        // ALERT_ACTIVE
        // Short button press acknowledges and returns to monitoring.
        // ------------------------------------------------------------
        case ALERT_ACTIVE:
            if (digitalRead(BUTTON_PIN) == LOW) {
                for (int i = 0; i < RED_SUSTAIN; i++) alert_ring[i] = false;
                justClearedAlert = true;
                currentState     = MONITORING;
                delay(500);
            }
            break;
    }
}