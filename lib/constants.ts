// How often the dashboard calls router.refresh() to pull new data from the server.
// Lower this to ~3000 before a demo for near-live appearance.
// Cost at 3 s for a 30-minute demo: <2 CPU-seconds of Neon compute — negligible.
// Revert to 15000 afterwards.
export const UI_REFRESH_INTERVAL_MS = 15000;

// Expected upload cadence from each wearable device (ESP32).
// Used to calculate whether a device has gone silent.
export const DEVICE_UPLOAD_INTERVAL_MS = 30000;

// How long without a packet before a device is treated as offline.
// At 30 s/upload, 2.5 min covers ~4-5 missed packets — enough to survive brief
// connectivity gaps without falsely marking a worker offline.
export const SIGNAL_TIMEOUT_MINS = 2.5;
export const SIGNAL_TIMEOUT_MS = SIGNAL_TIMEOUT_MINS * 60 * 1000;

// All date/time display and range logic uses UAE Standard Time (UTC+4).
export const APP_TIMEZONE = 'Asia/Dubai';
