// Creates 100 virtual workers in the database for load testing.
//
// Device IDs follow the pattern HS-SIM-001 → HS-SIM-100.
// Run this once before switching simulate-wearable.js to MODE = 'stress'.
// Safe to re-run — upsert skips workers that already exist.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEVICE_COUNT = 100;

async function main() {
  for (let i = 1; i <= DEVICE_COUNT; i++) {
    const deviceId = `HS-SIM-${String(i).padStart(3, '0')}`;
    await prisma.worker.upsert({
      where: { deviceId },
      update: {},
      create: {
        name: `Sim Worker ${i}`,
        role: 'Stress Test',
        deviceId,
        status: 'green',
      },
    });
    process.stdout.write(`\rRegistered ${i}/${DEVICE_COUNT}...`);
  }

  console.log(`\nDone. HS-SIM-001 to HS-SIM-${String(DEVICE_COUNT).padStart(3, '0')} registered.`);
  console.log(`Set MODE = 'stress' in simulate-wearable.js and run: node scripts/simulate-wearable.js`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
