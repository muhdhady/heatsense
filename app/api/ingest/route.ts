import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    // 1. Parse the incoming JSON (from ESP32 or Simulator)
    const body = await req.json();
    const { deviceId, heartRate, skinTemp, riskLevel } = body;

    // 2. Validate essential data
    if (!deviceId || !heartRate) {
      return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 3. Find the worker linked to this device
    // Have to add checks for device not found later
    const worker = await db.worker.findUnique({
      where: { deviceId: deviceId },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 });
    }

    // 4. Save the Health Log to the Database
    await db.healthLog.create({
      data: {
        workerId: worker.id,
        heartRate: parseFloat(heartRate),
        skinTemp: parseFloat(skinTemp),
        riskLevel: parseInt(riskLevel) || 0,
      },
    });

    // 5. Update the Worker's "Live Status" cache
    // This allows the dashboard to show current state without querying logs
    await db.worker.update({
      where: { id: worker.id },
      data: {
        status: parseInt(riskLevel) > 0 ? 'red' : 'green'
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Ingest Error:', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}