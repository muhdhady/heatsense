// prisma/seed.ts
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prismaa = new PrismaClient();

async function main() {
  console.log('Starting Database Seed...');

  // 1. Create Supervisor (Login Account)
  // Password: "admin123"
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prismaa.supervisor.upsert({
    where: { email: 'supervisor@heatsense.com' },
    update: {},
    create: {
      email: 'supervisor@heatsense.com',
      name: 'Site Commander',
      password: hashedPassword,
    },
  });
  console.log('Supervisor Account Created (supervisor@heatsense.com / admin123)');

  // 2. Create Workers
  const workers = [
    {
      id: 'W-104',
      name: 'Zaid Mansoor',
      deviceId: 'HS-001',
      role: 'Welder',
      status: 'green',
    },
    {
      id: 'W-102',
      name: 'Omar Khalid',
      deviceId: 'HS-002',
      role: 'Site Supervisor',
      status: 'green',
    }
  ];

  for (const w of workers) {
    await prismaa.worker.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        name: w.name,
        deviceId: w.deviceId,
        role: w.role,
        status: w.status,
      },
    });
  }
  console.log(`${workers.length} Workers Deployed`);

  console.log('Seeding Finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaa.$disconnect();
  });