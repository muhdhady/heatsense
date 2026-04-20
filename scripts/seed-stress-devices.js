// scripts/seed-stress-devices.js
// Creates 100 virtual workers for stress testing.
// Run once before switching simulate-wearable.js to MODE = 'stress'.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEVICE_COUNT = 100;

async function main() {
  console.log(`🌱 Seeding ${DEVICE_COUNT} virtual stress-test devices...\n`);

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
    process.stdout.write(`\r   Registered device ${i}/${DEVICE_COUNT}...`);
  }

  console.log(`\n\n✅ Done. HS-SIM-001 → HS-SIM-${String(DEVICE_COUNT).padStart(3, '0')} are registered.`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Set MODE = 'stress' in simulate-wearable.js`);
  console.log(`   2. node scripts/simulate-wearable.js`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
