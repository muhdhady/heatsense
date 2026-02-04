// scripts/simulate-wearable.js
const API_URL = 'http://localhost:3000/api/ingest';

// The simulator will cycle through these devices
const DEVICES = ['HS-001', 'HS-002', 'HS-003'];

// This device is the only one that will experience heat stress
const TARGET_RISK_DEVICE = 'HS-003'; 

console.log(`🔥 Starting Multi-Device Simulator...`);
console.log(`Targets: ${DEVICES.join(', ')}`);
console.log(`⚠️ Unstable Device: ${TARGET_RISK_DEVICE} (Occasional Spikes)`);

function generateVitals(deviceId) {
  let heartRate, skinTemp, riskLevel;

  // Logic for the "Unstable" device (HS-003)
  if (deviceId === TARGET_RISK_DEVICE) {
    // 15% chance to trigger a "Heat Stress Event"
    const isCritical = Math.random() > 0.85; 

    if (isCritical) {
      // DANGER ZONE
      heartRate = Math.floor(135 + Math.random() * 20); // 135-155 BPM
      skinTemp = (38.8 + Math.random() * 1.5).toFixed(1); // 38.8-40.3 °C
      riskLevel = 1;
    } else {
      // NORMAL ZONE (Recovering or stable)
      heartRate = Math.floor(85 + Math.random() * 15); // 85-100 BPM
      skinTemp = (37.2 + Math.random() * 0.5).toFixed(1); // 37.2-37.7 °C
      riskLevel = 0;
    }
  } 
  
  // Logic for "Safe" devices (HS-001, HS-002)
  else {
    // Always healthy
    heartRate = Math.floor(85 + Math.random() * 25); // 85-110 BPM
    skinTemp = (36.1 + Math.random() * 1.0).toFixed(1); // 36.1-37.1 °C
    riskLevel = 0;
  }

  return {
    deviceId,
    heartRate,
    skinTemp,
    riskLevel
  };
}

async function sendData() {
  // Loop through all devices and send data for each
  for (const deviceId of DEVICES) {
    const data = generateVitals(deviceId);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        // Only log critical events to keep terminal clean
        if (data.riskLevel === 1) {
          console.log(`⚠️ CRITICAL: ${deviceId} | HR ${data.heartRate} | ${data.skinTemp}°C`);
        } else {
          // Optional: Comment this out if it's too noisy
          console.log(`✅ OK: ${deviceId} | HR ${data.heartRate}`);
        }
      } else {
        // This usually happens if the worker isn't registered in the Dashboard yet
        console.log(`❌ Failed (${deviceId}): Device not registered in DB?`);
      }
    } catch (err) {
      console.log(`❌ Network Error: Is Next.js running?`);
    }
  }
  console.log('---');
}

// Send data for all 3 devices every 2 seconds
setInterval(sendData, 2000);