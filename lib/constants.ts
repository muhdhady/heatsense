// How often the Frontend (Dashboard) polls for new data
// User Request: 15 seconds
export const UI_REFRESH_INTERVAL_MS = 15000;

// How often the Hardware (ESP32) is expected to send data
// 30 seconds
export const DEVICE_UPLOAD_INTERVAL_MS = 30000;

// When to mark a device as "Offline" / "Orange"
// Logic: If we miss ~4-5 expected packets, we assume it's gone.
export const SIGNAL_TIMEOUT_MINS = 2.5; 
export const SIGNAL_TIMEOUT_MS = SIGNAL_TIMEOUT_MINS * 60 * 1000;

export const APP_TIMEZONE = 'Asia/Dubai';