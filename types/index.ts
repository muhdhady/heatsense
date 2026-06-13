// Shared TypeScript interfaces used by both server components (pages) and
// client components (dashboard, worker detail).
//
// These mirror the Prisma models but use serializable types (string instead of
// Date) because Next.js server components must JSON-serialize data before
// passing it to client components.

export interface Worker {
  id: string;
  name: string;
  deviceId: string;
  status: 'green' | 'red';
  role: string;
  lastSeen: string; // ISO date string (serialized from DateTime)

  // Populated from the worker's most recent HealthLog row.
  // Undefined if the worker has never sent data.
  currentVitals?: {
    heartRate: number;
    skinTemp: number;
  };
}

export interface HealthLog {
  id: number;
  timestamp: string;  // ISO date string
  heartRate: number;
  skinTemp: number;
  riskLevel: number;  // 0 = safe, 1 = critical
  tc: number;         // thermal discomfort: 0 (no input) | 5 (low) | 11 (medium) | 17 (high)
  workerId: string;
}
