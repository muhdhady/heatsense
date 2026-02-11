import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import db from '@/lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import WorkerDetailsClient from './client-page';

// FORCE DYNAMIC: Ensure new data is fetched on every request
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WorkerDetailsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const workerId = parseInt(decodeURIComponent(resolvedParams.workerId));
  if (isNaN(workerId)) {
    console.error("Invalid Worker ID:", resolvedParams.workerId);
    notFound();
  }

  // Date Logic
  const uaeTimeZone = 'Asia/Dubai';
  const todayInUAE = new Date().toLocaleDateString('en-CA', { timeZone: uaeTimeZone });
  const fromDateStr = (resolvedSearchParams.from as string) || todayInUAE;
  const toDateStr = (resolvedSearchParams.to as string) || todayInUAE;
  
  const startOfRange = new Date(`${fromDateStr}T00:00:00+04:00`); 
  const endOfRange = new Date(`${toDateStr}T23:59:59.999+04:00`);

  // Parallel Fetching
  const [worker, latestLog] = await Promise.all([
    db.worker.findUnique({
      where: { id: workerId },
      include: {
        logs: {
          where: {
            timestamp: { gte: startOfRange, lte: endOfRange },
          },
          orderBy: { timestamp: 'asc' }, 
        },
      },
    }),
    db.healthLog.findFirst({
      where: { workerId: workerId },
      orderBy: { timestamp: 'desc' },
    })
  ]);

  if (!worker) notFound();

  const serializedWorker = {
    ...worker,
    lastSeen: worker.lastSeen.toISOString(),
    logs: worker.logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })),
    latestLog: latestLog ? {
      ...latestLog,
      timestamp: latestLog.timestamp.toISOString(),
    } : null,
    viewFrom: fromDateStr,
    viewTo: toDateStr,
    isToday: (toDateStr === todayInUAE && fromDateStr === todayInUAE)
  };

  return <WorkerDetailsClient worker={serializedWorker} />;
}