// POST /api/ingest
//
// Receives telemetry from wearable devices (ESP32) and writes it to the database.
// This is the only endpoint the hardware talks to — it is not called by the dashboard UI.
//
// Request body (JSON):
//   deviceId  : string  — must match a registered Worker.deviceId
//   heartRate : number  — BPM from the pulse sensor
//   skinTemp  : number  — degrees Celsius from the skin temperature sensor
//   riskLevel : number  — 0 (safe) or 1 (critical), determined by the on-device ML classifier
//   tc        : number  — thermal discomfort button value: 0 | 5 | 11 | 17
//
// Security: requests must include the IOT_SECRET value in the x-api-key header.
// If IOT_SECRET is not set in the environment, the check is skipped (dev mode).

import { NextResponse } from 'next/server';
import db from '@/lib/db';

const IOT_SECRET = process.env.IOT_SECRET;

export async function POST(req: Request) {
  try {
    // Authenticate the device before processing the payload.
    // Fail closed: if IOT_SECRET is not configured, reject all requests rather than
    // silently allowing unauthenticated access (e.g. a misconfigured Vercel deploy).
    const apiKey = req.headers.get('x-api-key');
    if (!IOT_SECRET) {
      console.error('[Ingest] IOT_SECRET env var is not set — rejecting request');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }
    if (apiKey !== IOT_SECRET) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await req.json();
    const { deviceId, heartRate, skinTemp, riskLevel, tc } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing Device ID' }, { status: 400 });
    }

    const hr = parseFloat(heartRate);
    const temp = parseFloat(skinTemp);
    const risk = parseInt(riskLevel) || 0;

    // TC represents the thermal discomfort level reported by the worker via the wearable button.
    // Valid values: 0 (no button pressed yet), 5 (low), 11 (medium), 17 (high).
    const tcLevel = (tc !== undefined && tc !== null) ? parseInt(String(tc)) : 0;
    if (isNaN(tcLevel) || ![0, 5, 11, 17].includes(tcLevel)) {
      return NextResponse.json({ error: 'Invalid TC value: must be 0, 5, 11, or 17' }, { status: 400 });
    }

    if (isNaN(hr) || isNaN(temp)) {
      return NextResponse.json({ error: 'Invalid sensor data format' }, { status: 400 });
    }

    // Physiologically plausible ranges — rejects obviously corrupted sensor readings
    if (hr < 30 || hr > 250 || temp < 25 || temp > 45) {
      return NextResponse.json({ error: 'Sensor values out of plausible range' }, { status: 400 });
    }

    // Look up the worker by device serial number
    const worker = await db.worker.findUnique({
      where: { deviceId },
      select: { id: true },
    });

    if (!worker) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 });
    }

    const statusString = risk > 0 ? 'red' : 'green';
    const currentTimestamp = new Date();

    // Write the log entry and update the worker's status atomically.
    await db.$transaction([
      db.healthLog.create({
        data: {
          workerId: worker.id,
          heartRate: hr,
          skinTemp: temp,
          riskLevel: risk,
          tc: tcLevel,
          timestamp: currentTimestamp, // explicitly passing it so we can push the exact same time
        },
      }),
      db.worker.update({
        where: { id: worker.id },
        data: {
          status: statusString,
          lastSeen: currentTimestamp,
        },
      }),
    ]);

    // The dashboard picks up this new reading on its next poll (router.refresh()
    // every UI_REFRESH_INTERVAL_MS), so the ingest endpoint just persists and returns.
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Ingest API Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}