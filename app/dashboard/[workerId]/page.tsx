// Server component — worker detail page.
//
// Fetches the full log history for the selected worker within a date range,
// plus a separate query for the absolute latest log (used by the Live Monitor tab).
//
// The date range defaults to today in UAE time (UTC+4) and can be overridden via
// query params: /dashboard/42?from=2025-04-01&to=2025-04-30
//
// `force-dynamic` disables Next.js caching for this page so that every visit
// (including the polling refresh triggered by router.refresh()) re-runs the DB query
// and shows up-to-date data.

import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import db from '@/lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import WorkerDetailsClient from './client-page';

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
  if (isNaN(workerId)) notFound();

  // Convert the selected date range to UTC timestamps anchored to UAE midnight.
  // "2025-05-01T00:00:00+04:00" = start of day in Dubai time.
  const uaeTimeZone = 'Asia/Dubai';
  const todayInUAE = new Date().toLocaleDateString('en-CA', { timeZone: uaeTimeZone });
  const fromDateStr = (resolvedSearchParams.from as string) || todayInUAE;
  const toDateStr = (resolvedSearchParams.to as string) || todayInUAE;

  const startOfRange = new Date(`${fromDateStr}T00:00:00+04:00`);
  const endOfRange = new Date(`${toDateStr}T23:59:59.999+04:00`);

  const [worker, latestLog] = await Promise.all([
    db.worker.findUnique({
      where: { id: workerId },
      include: {
        logs: {
          where: { timestamp: { gte: startOfRange, lte: endOfRange } },
          orderBy: { timestamp: 'asc' }, // chronological order for the charts
        },
      },
    }),
    // Fetch the most recent log independently of the date range.
    // This allows the Live Monitor tab to always show the current vitals even
    // when the supervisor is browsing historical data on the History tab.
    db.healthLog.findFirst({
      where: { workerId },
      orderBy: { timestamp: 'desc' },
    }),
  ]);

  if (!worker) notFound();

  // Serialize Date objects to ISO strings before passing to the client component.
  // Next.js cannot pass non-serializable values (like Date) across the server/client boundary.
  const serializedWorker = {
    ...worker,
    lastSeen: worker.lastSeen.toISOString(),
    logs: worker.logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })),
    latestLog: latestLog
      ? { ...latestLog, timestamp: latestLog.timestamp.toISOString() }
      : null,
    viewFrom: fromDateStr,
    viewTo: toDateStr,
    isToday: toDateStr === todayInUAE && fromDateStr === todayInUAE,
  };

  return <WorkerDetailsClient worker={serializedWorker} />;
}
