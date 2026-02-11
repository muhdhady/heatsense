import { NextResponse } from 'next/server';
import db from '@/lib/db';

const IOT_SECRET = process.env.IOT_SECRET;

export async function POST(req: Request) {
  try {
    // 1. Security Check
    const apiKey = req.headers.get('x-api-key');
    if (IOT_SECRET && apiKey !== IOT_SECRET) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 2. Input Parsing
    const body = await req.json();
    const { deviceId, heartRate, skinTemp, riskLevel, rpe } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing Device ID' }, { status: 400 });
    }

    // 3. Data Validation
    const hr = parseFloat(heartRate);
    const temp = parseFloat(skinTemp);
    const risk = parseInt(riskLevel) || 0;

    // BORG SCALE (6-20): Default to 6 (No Exertion) if missing
    const rpeLevel = parseInt(rpe) || 6; 

    if (isNaN(hr) || isNaN(temp)) {
      return NextResponse.json({ error: 'Invalid sensor data format' }, { status: 400 });
    }

    // 4. Find Worker
    const worker = await db.worker.findUnique({
      where: { deviceId: deviceId },
      select: { id: true }
    });

    if (!worker) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 });
    }

    // 5. Database Transaction
    await db.$transaction([
      db.healthLog.create({
        data: {
          workerId: worker.id,
          heartRate: hr,
          skinTemp: temp,
          riskLevel: risk,
          rpe: rpeLevel // 6-20 Scale
        },
      }),
      db.worker.update({
        where: { id: worker.id },
        data: {
          status: risk > 0 ? 'red' : 'green',
          lastSeen: new Date(),
        },
      })
    ]);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Ingest API Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}