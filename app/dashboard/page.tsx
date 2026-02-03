import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import db from '@/lib/db';
import DashboardClient from './client-page';

// Server Component
export default async function DashboardPage() {
  // 1. Check Auth
  const session = await getServerSession();
  if (!session) redirect("/");

  // 2. Fetch Workers from DB
  const workers = await db.worker.findMany({
    include: {
      logs: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' }
  });

  // 3. Transform Data for the UI
  // The UI expects "currentVitals", but DB gives "logs[]". We map it here.
  const formattedWorkers = workers.map(w => ({
    ...w,
    // Convert Date objects to ISO strings for Client Components
    lastSeen: w.lastSeen.toISOString(),
    currentVitals: w.logs[0] ? {
      heartRate: w.logs[0].heartRate,
      skinTemp: w.logs[0].skinTemp,
    } : undefined
  }));

  // 4. Pass data to the Client Component
  return <DashboardClient initialData={formattedWorkers} />;
}