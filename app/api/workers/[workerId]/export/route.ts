// GET /api/workers/[workerId]/export?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Streams the FULL, un-downsampled health log history for a worker over a date
// range as a CSV file. The History tab's charts receive a downsampled subset
// (see app/dashboard/[workerId]/page.tsx) so they render fast, but a CSV export
// should be lossless — every reading the device uploaded. This endpoint does the
// full DB read on demand, only when the supervisor actually clicks Export.
//
// Requires a valid session. The public demo account is allowed (read-only).

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Mirrors the tcLabel mapping in the client so exported CSVs match the UI.
function tcLabel(val: number | null): string {
  if (val === null || val === 0) return 'None';
  if (val <= 7) return 'Low';
  if (val <= 14) return 'Medium';
  return 'High';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { workerId } = await params;
    const numericId = parseInt(workerId);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const uaeTimeZone = 'Asia/Dubai';
    const todayInUAE = new Date().toLocaleDateString('en-CA', { timeZone: uaeTimeZone });
    const fromDateStr = searchParams.get('from') || todayInUAE;
    const toDateStr = searchParams.get('to') || todayInUAE;

    // Anchor the range to UAE midnight, identical to the page's server query.
    const startOfRange = new Date(`${fromDateStr}T00:00:00+04:00`);
    const endOfRange = new Date(`${toDateStr}T23:59:59.999+04:00`);

    const worker = await db.worker.findUnique({ where: { id: numericId } });
    if (!worker) return NextResponse.json({ error: 'Worker not found' }, { status: 404 });

    const logs = await db.healthLog.findMany({
      where: { workerId: numericId, timestamp: { gte: startOfRange, lte: endOfRange } },
      orderBy: { timestamp: 'asc' },
    });

    const header = 'Timestamp,Worker ID,Heart Rate (BPM),Skin Temp (C),TC (Thermal Discomfort),Risk Level\n';
    const body = logs
      .map((log) =>
        `${log.timestamp.toISOString()},${worker.id},${log.heartRate},${log.skinTemp},${tcLabel(log.tc ?? null)},${log.riskLevel}`,
      )
      .join('\n');

    const safeName = worker.name.replace(/\s+/g, '_');
    const filename = `${safeName}_${fromDateStr}_to_${toDateStr}.csv`;

    return new NextResponse(header + body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[Workers Export GET]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
