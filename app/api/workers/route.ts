// /api/workers — CRUD operations for Worker records.
//
// All four methods require a valid NextAuth session (supervisor must be logged in).
// Workers are the field staff paired to physical ESP32 wearable devices.
//
// GET    — returns all workers ordered by ID (used to populate the dashboard table)
// POST   — creates a new worker (called when supervisor fills in the "Add Worker" modal)
// PUT    — updates an existing worker's name, role, or device assignment
// DELETE — removes a worker and cascades to delete all their health logs

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { DEMO_EMAIL } from '@/lib/constants';

// The public demo account is read-only: it can view everything but cannot mutate
// shared data. Returns a 403 the UI surfaces as a toast. Returns true when the
// request should be blocked.
function isDemo(session: { user?: { email?: string | null } } | null): boolean {
  return session?.user?.email === DEMO_EMAIL;
}
const demoBlocked = () => NextResponse.json(
  { error: 'This is a read-only demo account. Changes are disabled.' },
  { status: 403 },
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workers = await db.worker.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(workers);
  } catch (error) {
    console.error('[Workers GET]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isDemo(session)) return demoBlocked();

    const body = await req.json();
    const { name, deviceId, role } = body;

    if (!name || !deviceId) {
      return NextResponse.json({ error: 'Name and Device ID are required.' }, { status: 400 });
    }

    // Each physical device can only be assigned to one worker at a time
    const existingDevice = await db.worker.findUnique({ where: { deviceId } });
    if (existingDevice) {
      return NextResponse.json(
        { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` },
        { status: 409 },
      );
    }

    const newWorker = await db.worker.create({
      data: {
        name,
        deviceId,
        role: role || 'Laborer',
        status: 'green', // new workers start safe until the device sends data
      },
    });

    return NextResponse.json(newWorker);

  } catch (error) {
    console.error('[Workers POST]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isDemo(session)) return demoBlocked();

    const body = await req.json();
    const { id, name, role, deviceId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    // If the supervisor is reassigning the device, make sure the new serial isn't
    // already taken by a *different* worker (same worker keeping its own device is fine)
    if (deviceId) {
      const existingDevice = await db.worker.findUnique({ where: { deviceId } });
      if (existingDevice && existingDevice.id !== numericId) {
        return NextResponse.json(
          { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` },
          { status: 409 },
        );
      }
    }

    const updatedWorker = await db.worker.update({
      where: { id: numericId },
      data: { name, role, deviceId },
    });

    return NextResponse.json(updatedWorker);

  } catch (error) {
    console.error('[Workers PUT]:', error);
    return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isDemo(session)) return demoBlocked();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Worker ID required' }, { status: 400 });
    }

    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid worker ID' }, { status: 400 });
    }

    // Cascade delete is configured in the Prisma schema, so all HealthLog rows
    // for this worker are removed automatically
    await db.worker.delete({ where: { id: numericId } });
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Workers DELETE]:', error);
    return NextResponse.json({ error: 'Failed to delete worker' }, { status: 500 });
  }
}
