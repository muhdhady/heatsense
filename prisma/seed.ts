// Bootstraps the database with the single supervisor account required for login.
// Workers are registered at runtime through the dashboard UI, not seeded here.
//
// Run with: npx prisma db seed
//
// NOTE: The variable is named `db` rather than `prisma` because lib/db.ts declares
// a global `var prisma` for the Next.js singleton. Using the same name here causes
// a TypeScript block-scope redeclaration conflict in some compiler configurations.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  // bcrypt cost factor 10 is standard — fast enough for a seed script,
  // strong enough that brute-forcing the hash is impractical.
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // upsert is safe to run multiple times without duplicating the account.
  await db.supervisor.upsert({
    where: { email: 'supervisor@heatsense.com' },
    update: {},
    create: {
      email: 'supervisor@heatsense.com',
      name: 'Site Commander',
      password: hashedPassword,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
