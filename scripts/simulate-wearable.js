// Development/testing simulator — impersonates real ESP32 wearable devices.
//
// Two modes (set MODE below):
//   'simulate' — sends periodic telemetry for the three registered demo devices
//                (HS-001, HS-002, HS-003). HS-003 is the "at-risk" device and has
//                a 30% chance of generating a critical reading each cycle.
//
//   'stress'   — ramps up to 100 concurrent devices to load-test the ingest API
//                and Neon DB. Requires seed-stress-devices.js to be run first.
//
// The simulator never sends TC=0 because it simulates active workers who have
// already pressed the button at least once (TC=0 means "no button pressed yet").

const API_URL = process.env.INGEST_URL || "http://localhost:3000/api/ingest";

const IOT_SECRET = process.env.IOT_SECRET;
if (!IOT_SECRET) {
  console.error("IOT_SECRET env var is required. e.g. IOT_SECRET=... node scripts/simulate-wearable.js");
  process.exit(1);
}

// HS-003 is the designated risk device — it generates critical readings ~30% of the time
const TARGET_RISK_DEVICE = "HS-001";

const UPLOAD_INTERVAL_MS = 3000; // matches UI_REFRESH_INTERVAL_MS when set for demo

const MODE = "simulate"; // 'simulate' | 'stress'

const SIMULATION_DEVICES = ["HS-001", "HS-002"];
const STRESS_LEVELS = [10, 25, 50, 100]; // concurrent device counts per ramp stage

function generateVitals(deviceId) {
  let heartRate, skinTemp, riskLevel;

  if (deviceId === TARGET_RISK_DEVICE) {
    // 30% chance of a critical reading for the risk device
    const isCritical = Math.random() > 0.7;
    if (isCritical) {
      heartRate = Math.floor(135 + Math.random() * 20); // 135–155 BPM
      skinTemp = (38.8 + Math.random() * 1.5).toFixed(1); // 38.8–40.3 °C
      riskLevel = 1;
    } else {
      heartRate = Math.floor(85 + Math.random() * 15);
      skinTemp = (37.2 + Math.random() * 0.5).toFixed(1);
      riskLevel = 0;
    }
  } else {
    heartRate = Math.floor(85 + Math.random() * 25); // 85–110 BPM
    skinTemp = (36.1 + Math.random() * 1.0).toFixed(1);
    riskLevel = 0;
  }

  // TC values: 5 = low discomfort, 11 = medium, 17 = high.
  // Critical risk device reports high discomfort; elevated HR reports medium;
  // otherwise the worker reports low discomfort.
  let tc;
  if (deviceId === TARGET_RISK_DEVICE && riskLevel === 1) {
    tc = 17;
  } else if (heartRate > 110) {
    tc = 11;
  } else {
    tc = 5;
  }

  return { deviceId, heartRate, skinTemp, riskLevel, tc };
}

// Sends one payload to the ingest API and returns status + response time
async function sendOne(deviceId) {
  const data = generateVitals(deviceId);
  const start = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": IOT_SECRET },
      body: JSON.stringify(data),
    });
    return { ok: response.ok, status: response.status, elapsed: Date.now() - start };
  } catch {
    return { ok: false, status: 0, elapsed: Date.now() - start };
  }
}

async function runSimulation() {
  for (const deviceId of SIMULATION_DEVICES) {
    const data = generateVitals(deviceId);
    const tcLabel = data.tc <= 7 ? "Low" : data.tc <= 14 ? "Medium" : "High";
    console.log(`[${deviceId}] HR: ${data.heartRate} | TC: ${data.tc} (${tcLabel})`);
    const result = await sendOne(deviceId);
    if (!result.ok) console.error(`[${deviceId}] API error: ${result.status}`);
  }
}

async function runStressTest() {
  console.log("Starting stress test. Ensure seed-stress-devices.js has been run first.\n");

  for (const count of STRESS_LEVELS) {
    const devices = Array.from(
      { length: count },
      (_, i) => `HS-SIM-${String(i + 1).padStart(3, "0")}`,
    );

    console.log(`Dispatching ${count} concurrent requests...`);
    const batchStart = Date.now();

    // Promise.allSettled is used instead of Promise.all so a single failed request
    // doesn't abort the whole batch — we want to measure partial failure rates
    const results = await Promise.allSettled(devices.map((id) => sendOne(id)));
    const totalElapsed = Date.now() - batchStart;

    const settled = results.map((r) =>
      r.status === "fulfilled" ? r.value : { ok: false, elapsed: 0 },
    );
    const successful = settled.filter((r) => r.ok).length;
    const failed = count - successful;
    const successTimes = settled.filter((r) => r.ok).map((r) => r.elapsed);
    const avgMs = successTimes.length
      ? Math.round(successTimes.reduce((a, b) => a + b, 0) / successTimes.length)
      : 0;
    const maxMs = successTimes.length ? Math.max(...successTimes) : 0;

    console.log(`  Success: ${successful}/${count}  Failed: ${failed}`);
    console.log(`  Avg: ${avgMs}ms  Max: ${maxMs}ms  Batch total: ${totalElapsed}ms\n`);

    await new Promise((r) => setTimeout(r, 3000)); // pause between ramp levels
  }

  console.log("Stress test complete.");
}

if (MODE === "stress") {
  runStressTest();
} else {
  console.log(`Simulator started. Target risk device: ${TARGET_RISK_DEVICE}`);
  setInterval(runSimulation, UPLOAD_INTERVAL_MS);
}
