// scripts/simulate-wearable.js
// Run this with: node scripts/simulate-wearable.js

const API_URL = 'http://localhost:3000/api/ingest';
const DEVICE_ID = 'HS-001'; // Must match a deviceId in your Database!

console.log(`Starting HeatSense Wearable Simulator for ${DEVICE_ID}...`);

function generateVitals() {
  // Simulate random fluctuations
  const heartRate = Math.floor(70 + Math.random() * 50); // 70 - 120 BPM
  const skinTemp = (36.5 + Math.random() * 2.5).toFixed(1); // 36.5 - 39.0 °C
  
  // Simple risk logic for demo
  const riskLevel = (heartRate > 110 || skinTemp > 38.0) ? 1 : 0;

  return {
    deviceId: DEVICE_ID,
    heartRate,
    skinTemp,
    riskLevel
  };
}

async function sendData() {
  const data = generateVitals();
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      console.log(`Sent: HR ${data.heartRate} | Temp ${data.skinTemp} | Risk ${data.riskLevel}`);
    } else {
      console.log(`Error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.log(`Network Error: Is Next.js running?`);
  }
}

// Send data every 2 seconds
setInterval(sendData, 2000);