// Replays a pre-recorded ML session from a JSON file, sending one row at a time
// to the ingest API to simulate a live wearable during a demo.
//
// Expected JSON shape:
//   { meta: { alert_threshold: 38.3 }, session: { predictions: [ { t_minutes, HR, SkinTemp, TC, alert_val }, ... ] } }
//
// DEMO NOTES:
//   - UPLOAD_INTERVAL_MS is set to 3000 (matches UI_REFRESH_INTERVAL_MS when lowered for demo).
//     This way each dashboard refresh shows exactly one new data point — clean, readable progress.
//   - The ML-DEMO device must be registered in the DB before running this script.
//   - IOT_SECRET env var is required.

const fs = require("fs");
const path = require("path");

const API_URL = process.env.INGEST_URL || "http://localhost:3000/api/ingest";

const IOT_SECRET = process.env.IOT_SECRET;
if (!IOT_SECRET) {
  console.error("IOT_SECRET env var is required. e.g. IOT_SECRET=... node scripts/demo/playback.js");
  process.exit(1);
}
const TARGET_DEVICE = "ML-DEMO";

// Set this to match UI_REFRESH_INTERVAL_MS (in constants.ts) so each dashboard
// poll sees exactly one new data point rather than many stale ones.
const UPLOAD_INTERVAL_MS = 3000;

const dataPath = path.join(__dirname, "heatsense_session_predictions.json");
let jsonData;
try {
  jsonData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
} catch {
  console.error("Failed to load JSON. Ensure 'heatsense_session_predictions.json' is in the same directory.");
  process.exit(1);
}

const predictions = jsonData.session.predictions;
const ALERT_THRESHOLD = jsonData.meta.alert_threshold;

// The raw TC from the dataset may not fall exactly on 5/11/17.
// Map to the nearest valid discrete level accepted by the ingest API.
function mapTC(rawTc) {
  if (rawTc <= 7) return 5;
  if (rawTc <= 14) return 11;
  return 17;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function startPlayback() {
  console.log(`Playback started`);
  console.log(`Device   : ${TARGET_DEVICE}`);
  console.log(`Threshold: ${ALERT_THRESHOLD}°C`);
  console.log(`Interval : ${UPLOAD_INTERVAL_MS / 1000}s`);
  console.log(`Rows     : ${predictions.length}\n`);

  for (let i = 0; i < predictions.length; i++) {
    const row = predictions[i];

    // alert_val is the model's predicted core body temperature.
    // If it meets or exceeds the threshold, the wearable would flag a critical alert.
    const payload = {
      deviceId: TARGET_DEVICE,
      heartRate: Math.round(row.HR),
      skinTemp: row.SkinTemp.toFixed(1),
      tc: mapTC(row.TC),
      riskLevel: row.alert_val >= ALERT_THRESHOLD ? 1 : 0,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": IOT_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const statusTag = payload.riskLevel === 1 ? "CRITICAL" : "SAFE";
        console.log(
          `[${TARGET_DEVICE}] Min: ${row.t_minutes} | HR: ${payload.heartRate} | Skin: ${payload.skinTemp}°C | Core est: ${row.alert_val.toFixed(2)}°C | ${statusTag}`,
        );
      } else {
        const errorResponse = await response.json().catch(() => ({}));
        console.error(`API ${response.status}:`, errorResponse.error || "Unknown error");
      }
    } catch (err) {
      console.error(`Network error: ${err.message}`);
    }

    // Skip the delay after the last row so the script exits immediately
    if (i < predictions.length - 1) {
      await delay(UPLOAD_INTERVAL_MS);
    }
  }

  console.log("\nPlayback complete.");
  process.exit(0);
}

startPlayback();
