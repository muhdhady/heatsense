// Direct database injection for UI testing.
//
// Bypasses the ingest API entirely and writes a health log entry straight into
// the database. Useful for verifying dashboard behaviour for specific scenarios
// without needing a physical device or running the simulator.
//
// Configure the three constants below, then run: node scripts/test-scenario.js
//
// Scenario combinations:
//   IS_CRITICAL=false, IS_STALE=false → green row, no alert banner, no alarm
//   IS_CRITICAL=true,  IS_STALE=false → red row, alert banner visible, alarm rings
//   IS_CRITICAL=true,  IS_STALE=true  → red row, alert banner hidden (data too old to alert)
//   IS_CRITICAL=false, IS_STALE=true  → green row, "last seen" shows 24h ago

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WORKER_ID = 'HS-TEST-01'; // device serial — worker is created if it doesn't exist
const IS_CRITICAL = false;      // true = riskLevel 1 (red), false = riskLevel 0 (green)
const IS_STALE = false;         // true = timestamp 24h ago (triggers offline detection)

async function main() {
  const timestamp = new Date();
  if (IS_STALE) {
    timestamp.setHours(timestamp.getHours() - 24);
  }

  // Upsert creates the test worker automatically if this is the first run
  const worker = await prisma.worker.upsert({
    where: { deviceId: WORKER_ID },
    update: {
      status: IS_CRITICAL ? 'red' : 'green',
      lastSeen: timestamp,
    },
    create: {
      name: 'Test Worker',
      role: 'Scenario Tester',
      deviceId: WORKER_ID,
      status: IS_CRITICAL ? 'red' : 'green',
      lastSeen: timestamp,
    },
  });

  await prisma.healthLog.create({
    data: {
      workerId: worker.id,
      heartRate: IS_CRITICAL ? 165 : 85,
      skinTemp: IS_CRITICAL ? 39.5 : 37.0,
      riskLevel: IS_CRITICAL ? 1 : 0,
      tc: IS_CRITICAL ? 17 : 5,
      timestamp,
    },
  });

  console.log(`Injected: ${WORKER_ID} | critical=${IS_CRITICAL} | stale=${IS_STALE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
