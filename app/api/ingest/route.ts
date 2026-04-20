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
    const { deviceId, heartRate, skinTemp, riskLevel, tc } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing Device ID' }, { status: 400 });
    }

    // 3. Data Validation
    const hr = parseFloat(heartRate);
    const temp = parseFloat(skinTemp);
    const risk = parseInt(riskLevel) || 0;

    // THERMAL COMFORT: Must be one of three discrete button values (5=Low, 11=Medium, 17=High)
    const tcLevel = parseInt(tc) || 5;
    if (![5, 11, 17].includes(tcLevel)) {
      return NextResponse.json({ error: 'Invalid TC value: must be 5, 11, or 17' }, { status: 400 });
    }

    if (isNaN(hr) || isNaN(temp)) {
      return NextResponse.json({ error: 'Invalid sensor data format' }, { status: 400 });
    }

    if (hr < 30 || hr > 250 || temp < 25 || temp > 45) {
      return NextResponse.json({ error: 'Sensor values out of plausible range' }, { status: 400 });
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
          tc: tcLevel
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