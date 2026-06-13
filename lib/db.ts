// Prisma client singleton for Next.js.
//
// Next.js Hot Module Replacement (HMR) in development re-executes module code on
// every file save, which would create a new PrismaClient instance each time and
// quickly exhaust the database connection pool.
//
// The fix: store the single instance on `globalThis` (which persists across HMR
// cycles) and reuse it. In production there is no HMR, so a fresh instance is
// created once and used for the lifetime of the server process.

import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const db = globalThis.prisma ?? prismaClientSingleton();

export default db;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = db;
