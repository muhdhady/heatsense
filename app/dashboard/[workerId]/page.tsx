import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import db from '@/lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import WorkerDetailsClient from './client-page';

interface PageProps {
  params: Promise<{ workerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WorkerDetailsPage({ params, searchParams }: PageProps) {
  // 1. Secure Auth Check
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  // Parse ID (Auto-increment Integer)
  const workerId = parseInt(decodeURIComponent(resolvedParams.workerId));
  if (isNaN(workerId)) notFound();

  // 2. Determine Date Range (UAE TIMEZONE)
  const uaeTimeZone = 'Asia/Dubai';
  const todayInUAE = new Date().toLocaleDateString('en-CA', { timeZone: uaeTimeZone }); // YYYY-MM-DD
  
  // Get 'from' and 'to' from URL, or default to Today
  const fromDateStr = (resolvedSearchParams.from as string) || todayInUAE;
  const toDateStr = (resolvedSearchParams.to as string) || todayInUAE;
  
  // Calculate Start (00:00:00) and End (23:59:59) in UTC/Offset
  const startOfRange = new Date(`${fromDateStr}T00:00:00+04:00`); 
  const endOfRange = new Date(`${toDateStr}T23:59:59.999+04:00`);

  // 3. Fetch Worker + Filtered Logs
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: {
      logs: {
        where: {
          timestamp: {
            gte: startOfRange,
            lte: endOfRange,
          },
        },
        orderBy: { timestamp: 'asc' }, 
      },
    },
  });

  if (!worker) notFound();

  // 4. Serialize Data
  const serializedWorker = {
    ...worker,
    lastSeen: worker.lastSeen.toISOString(),
    logs: worker.logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })),
    // Pass view context
    viewFrom: fromDateStr,
    viewTo: toDateStr,
    isLiveView: (toDateStr === todayInUAE && fromDateStr === todayInUAE)
  };

  return <WorkerDetailsClient worker={serializedWorker} />;
}