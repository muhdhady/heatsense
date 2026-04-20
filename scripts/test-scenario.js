// scripts/test-db-direct.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- CONFIGURATION ---
const WORKER_ID = 'HS-TEST-01'; // Ensure this matches your test worker ID
const IS_CRITICAL = false;       // true = RED, false = GREEN
const IS_STALE = false;          // true = "Yesterday", false = "Now"

async function main() {
  console.log(`🧪 Initializing Direct DB Injection...`);
  
  // 1. Calculate the Time
  const timestamp = new Date();
  if (IS_STALE) {
    timestamp.setHours(timestamp.getHours() - 24); // Rewind 24 hours
  }

  console.log(`Target: ${WORKER_ID}`);
  console.log(`Time:   ${IS_STALE ? '24 Hours Ago' : 'Right Now'}`);
  console.log(`Status: ${IS_CRITICAL ? 'CRITICAL' : 'NORMAL'}`);

  // 2. Update the Worker Status & Last Seen (Crucial for Dashboard Logic)
  // We use 'upsert' so it creates the worker if it doesn't exist
  const worker = await prisma.worker.upsert({
    where: { deviceId: WORKER_ID },
    update: {
      status: IS_CRITICAL ? 'red' : 'green',
      lastSeen: timestamp
      // We also update the cached vitals on the worker model itself
    },
    create: {
      name: 'Test Dummy',
      role: 'Scenario Tester',
      deviceId: WORKER_ID,
      status: IS_CRITICAL ? 'red' : 'green',
      lastSeen: timestamp
    },
  });

  // 3. Create the Log Entry
  await prisma.healthLog.create({
    data: {
      workerId: worker.id,
      heartRate: IS_CRITICAL ? 165 : 85,
      skinTemp: IS_CRITICAL ? 39.5 : 37.0,
      riskLevel: IS_CRITICAL ? 1 : 0,
      tc: IS_CRITICAL ? 17 : 5,
      timestamp: timestamp,
    },
  });

  console.log(`✅ Success! Data injected.`);
  console.log(`💡 EXPECTATION:`);
  
  if (IS_CRITICAL && IS_STALE) {
    console.log(`   Table: RED (Critical)`);
    console.log(`   Banner: HIDDEN (Data is too old)`);
    console.log(`   Audio: SILENT`);
  } else if (IS_CRITICAL && !IS_STALE) {
    console.log(`   Table: RED (Critical)`);
    console.log(`   Banner: VISIBLE`);
    console.log(`   Audio: RINGING`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });