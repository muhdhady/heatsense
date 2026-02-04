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
  // NOTICE: We removed the 'id' field. The DB will auto-generate 1, 2, 3...
  const workers = [
    {
      name: 'Zaid',
      deviceId: 'HS-001',
      role: 'Welder',
      status: 'green',
    },
    {
      name: 'Omar',
      deviceId: 'HS-002',
      role: 'Site Supervisor',
      status: 'green',
    },
    {
      name: 'Ali',
      deviceId: 'HS-003',
      role: 'Crane Operator',
      status: 'green',
    }
  ];

  for (const w of workers) {
    // We use 'create' here since we know the DB is empty after a reset.
    // If you plan to run this multiple times without resetting, you would need
    // a unique field (like deviceId) to use upsert.
    await prismaa.worker.create({
      data: {
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