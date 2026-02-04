import React from 'react';
import db from '@/lib/db';
import { notFound } from 'next/navigation';
import WorkerDetailsClient from './client-page';

interface PageProps {
  params: Promise<{ workerId: string }>;
}

export default async function WorkerDetailsPage({ params }: PageProps) {
  // 1. Await the params
  const resolvedParams = await params;
  const id = decodeURIComponent(resolvedParams.workerId);

  console.log(`🔍 Looking up Worker ID: "${id}"`);
  const workerId = parseInt(id);

  // 2. Fetch Worker + Recent Logs
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: {
      logs: {
        orderBy: { timestamp: 'desc' },
        take: 2000, 
      },
    },
  });

  if (!worker) {
    console.log(`Worker "${id}" not found in Database.`); 
    notFound();
  }

  // 3. Serialize Data
  const serializedWorker = {
    ...worker,
    lastSeen: worker.lastSeen.toISOString(),
    logs: worker.logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    })).reverse(), 
  };

  return <WorkerDetailsClient worker={serializedWorker} />;
}