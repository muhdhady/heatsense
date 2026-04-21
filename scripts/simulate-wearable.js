//const API_URL = 'https://heatsense.vercel.app/api/ingest';
const API_URL = "http://localhost:3000/api/ingest"; // Toggle for local testing

const IOT_SECRET = "super-secure-iot-secret";
const TARGET_RISK_DEVICE = "HS-003";
const UPLOAD_INTERVAL_MS = 3000;

// MODE: 'simulate' = regular interval-based simulation (3 real devices)
//       'stress'   = concurrent ramp-up load test (requires seed-stress-devices.js)
const MODE = "simulate";

const SIMULATION_DEVICES = ["HS-001", "HS-002", "HS-003"];
const STRESS_LEVELS = [10, 25, 50, 100]; // concurrent device counts per ramp stage

// --- VITALS GENERATOR ---
function generateVitals(deviceId) {
  let heartRate, skinTemp, riskLevel;

  if (deviceId === TARGET_RISK_DEVICE) {
    const isCritical = Math.random() > 0.7;
    if (isCritical) {
      heartRate = Math.floor(135 + Math.random() * 20); // 135-155
      skinTemp = (38.8 + Math.random() * 1.5).toFixed(1);
      riskLevel = 1;
    } else {
      heartRate = Math.floor(85 + Math.random() * 15); // 85-100
      skinTemp = (37.2 + Math.random() * 0.5).toFixed(1);
      riskLevel = 0;
    }
  } else {
    heartRate = Math.floor(85 + Math.random() * 25); // 85-110
    skinTemp = (36.1 + Math.random() * 1.0).toFixed(1);
    riskLevel = 0;
  }

  // TC (THERMAL COMFORT): 5=Low, 11=Medium, 17=High
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

// --- SHARED SEND FUNCTION (returns timing + result) ---
async function sendOne(deviceId) {
  const data = generateVitals(deviceId);
  const start = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": IOT_SECRET },
      body: JSON.stringify(data),
    });
    return {
      ok: response.ok,
      status: response.status,
      elapsed: Date.now() - start,
    };
  } catch {
    return { ok: false, status: 0, elapsed: Date.now() - start };
  }
}

// --- SIMULATE MODE ---
async function runSimulation() {
  for (const deviceId of SIMULATION_DEVICES) {
    const data = generateVitals(deviceId);
    console.log(
      `📤 Sending ${deviceId}: HR ${data.heartRate} | TC ${data.tc} (${data.tc <= 7 ? "Low" : data.tc <= 14 ? "Medium" : "High"})`,
    );
    const result = await sendOne(deviceId);
    if (!result.ok) console.log(`❌ API Error: ${result.status}`);
  }
}

// --- STRESS TEST MODE ---
async function runStressTest() {
  console.log(
    "🔥 Starting Stress Test — ensure seed-stress-devices.js has been run first.\n",
  );

  for (const count of STRESS_LEVELS) {
    const devices = Array.from(
      { length: count },
      (_, i) => `HS-SIM-${String(i + 1).padStart(3, "0")}`,
    );

    console.log(`⚡ Dispatching ${count} concurrent requests...`);
    const batchStart = Date.now();

    const results = await Promise.allSettled(devices.map((id) => sendOne(id)));
    const totalElapsed = Date.now() - batchStart;

    const settled = results.map((r) =>
      r.status === "fulfilled" ? r.value : { ok: false, elapsed: 0 },
    );
    const successful = settled.filter((r) => r.ok).length;
    const failed = count - successful;
    const successTimes = settled.filter((r) => r.ok).map((r) => r.elapsed);
    const avgMs = successTimes.length
      ? Math.round(
          successTimes.reduce((a, b) => a + b, 0) / successTimes.length,
        )
      : 0;
    const maxMs = successTimes.length ? Math.max(...successTimes) : 0;

    console.log(`   ✅ Success: ${successful}/${count}  ❌ Failed: ${failed}`);
    console.log(
      `   ⏱  Avg response: ${avgMs}ms | Max: ${maxMs}ms | Batch total: ${totalElapsed}ms\n`,
    );

    await new Promise((r) => setTimeout(r, 3000)); // pause between levels
  }

  console.log("✅ Stress test complete.");
}

// --- ENTRY POINT ---
if (MODE === "stress") {
  runStressTest();
} else {
  console.log(`🔥 Starting Simulator... Target: ${TARGET_RISK_DEVICE}`);
  setInterval(runSimulation, UPLOAD_INTERVAL_MS);
}
