import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, heartRate, skinTemp, riskLevel } = body;

    // Validate essential data
    if (!deviceId || !heartRate) {
      return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // Find the worker
    const worker = await db.worker.findUnique({
      where: { deviceId: deviceId },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 });
    }

    // 1. Save the Health Log
    await db.healthLog.create({
      data: {
        workerId: worker.id,
        heartRate: parseFloat(heartRate),
        skinTemp: parseFloat(skinTemp),
        riskLevel: parseInt(riskLevel) || 0,
      },
    });

    // 2. Update Worker Status AND Last Seen (THE FIX)
    await db.worker.update({
      where: { id: worker.id },
      data: {
        status: parseInt(riskLevel) > 0 ? 'red' : 'green',
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Ingest Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}