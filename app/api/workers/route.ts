import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';

// POST: Create a new Worker
export async function POST(req: Request) {
  try {
    // 1. Security Check (Optional but recommended)
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, deviceId, role, status } = body;

    // 2. Validation: Check for empty fields
    if (!id || !name || !deviceId) {
      return NextResponse.json(
        { error: "Missing required fields (ID, Name, or Device ID)" }, 
        { status: 400 }
      );
    }

    // 3. Duplicate Check: Worker ID
    const existingId = await db.worker.findUnique({ where: { id } });
    if (existingId) {
      return NextResponse.json(
        { error: `Worker ID '${id}' is already in use.` }, 
        { status: 409 }
      );
    }

    // 4. Duplicate Check: Device ID
    const existingDevice = await db.worker.findUnique({ where: { deviceId } });
    if (existingDevice) {
      return NextResponse.json(
        { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` }, 
        { status: 409 }
      );
    }

    // 5. Create the Worker
    const newWorker = await db.worker.create({
      data: {
        id,
        name,
        deviceId,
        role: role || 'Laborer',
        status: status || 'green',
      },
    });

    return NextResponse.json(newWorker);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Update an existing Worker
export async function PUT(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, role, deviceId } = body; 
    // Note: We usually don't update ID, but we use ID to find the record.

    if (!id) {
      return NextResponse.json({ error: "Worker ID is required for updates" }, { status: 400 });
    }

    // Check if we are trying to change the Device ID to one that is already taken
    if (deviceId) {
        const existingDevice = await db.worker.findUnique({ where: { deviceId } });
        // If device exists AND it belongs to someone else (not the person we are editing)
        if (existingDevice && existingDevice.id !== id) {
            return NextResponse.json(
                { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` }, 
                { status: 409 }
            );
        }
    }

    const updatedWorker = await db.worker.update({
      where: { id },
      data: {
        name,
        role,
        deviceId, // Optional update
      },
    });

    return NextResponse.json(updatedWorker);

  } catch (error) {
    console.error("API Update Error:", error);
    return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
  }
}