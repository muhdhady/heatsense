import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET: Fetch all workers
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workers = await db.worker.findMany({
      orderBy: { id: 'asc' }
    });

    return NextResponse.json(workers);
  } catch (error) {
    console.error("API Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Create a new Worker
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, deviceId, role } = body;

    // 1. Validation
    if (!name || !deviceId) {
      return NextResponse.json(
        { error: "Name and Device ID are required." }, 
        { status: 400 }
      );
    }

    // 2. Duplicate Check: Device ID
    // Workers cannot share the same sensor
    const existingDevice = await db.worker.findUnique({ where: { deviceId } });
    if (existingDevice) {
      return NextResponse.json(
        { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` }, 
        { status: 409 }
      );
    }

    // 3. Create
    const newWorker = await db.worker.create({
      data: {
        name,
        deviceId,
        role: role || 'Laborer',
        status: 'green', // Default to safe
      },
    });

    return NextResponse.json(newWorker);

  } catch (error) {
    console.error("API Create Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Update an existing Worker
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, role, deviceId } = body; 

    if (!id) {
      return NextResponse.json({ error: "Worker ID is required" }, { status: 400 });
    }

    // 1. Check if trying to use a taken Device ID
    if (deviceId) {
        const existingDevice = await db.worker.findUnique({ where: { deviceId } });
        // If device exists AND belongs to a DIFFERENT worker
        if (existingDevice && existingDevice.id !== parseInt(id)) {
            return NextResponse.json(
                { error: `Device '${deviceId}' is already assigned to ${existingDevice.name}.` }, 
                { status: 409 }
            );
        }
    }

    // 2. Update
    const updatedWorker = await db.worker.update({
      where: { id: parseInt(id) }, // Ensure ID is an Integer
      data: {
        name,
        role,
        deviceId, 
      },
    });

    return NextResponse.json(updatedWorker);

  } catch (error) {
    console.error("API Update Error:", error);
    return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
  }
}

// DELETE: Remove a worker
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get ID from URL Search Params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Worker ID required" }, { status: 400 });
    }

    await db.worker.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("API Delete Error:", error);
    return NextResponse.json({ error: "Failed to delete worker" }, { status: 500 });
  }
}