import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import db from '@/lib/db';
import DashboardClient from './client-page';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Server Component
export default async function DashboardPage() {
  // 1. Check Auth Securely
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  // 2. Fetch Workers from DB
  const workers = await db.worker.findMany({
    include: {
      logs: {
        orderBy: { timestamp: 'desc' },
        take: 1, // Get only the latest log for "Real-time" status
      },
    },
    orderBy: { id: 'asc' } // Order by ID (1, 2, 3...)
  });

  // 3. Transform Data for the UI
  // The UI expects "currentVitals", but DB gives "logs[]". We map it here.
  const formattedWorkers = workers.map(w => ({
    ...w,
    lastSeen: w.lastSeen.toISOString(),
    currentVitals: w.logs[0] ? {
      heartRate: w.logs[0].heartRate,
      skinTemp: w.logs[0].skinTemp,
    } : undefined
  }));

  // 4. Pass data to the Client Component
  return <DashboardClient initialData={formattedWorkers} />;
}