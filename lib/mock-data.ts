import { Worker } from '@/types';

export const mockWorkers: Worker[] = [
  {
    id: 'W-104',
    name: 'Zaid',
    deviceId: 'HS-001',
    status: 'red',
    role: 'Welder',
    lastSeen: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
    currentVitals: { heartRate: 145, skinTemp: 39.2 }
  },
  {
    id: 'W-102',
    name: 'Omar',
    deviceId: 'HS-012',
    status: 'green',
    role: 'Site Supervisor',
    lastSeen: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    currentVitals: { heartRate: 78, skinTemp: 37.1 }
  },
  {
    id: 'W-109',
    name: 'Khalid',
    deviceId: 'HS-008',
    status: 'green', // Changed to green
    role: 'General Labor',
    lastSeen: new Date(Date.now() - 1000 * 30).toISOString(), // 30 sec ago
    currentVitals: { heartRate: 92, skinTemp: 37.5 }
  },
  {
    id: 'W-115',
    name: 'Ahmed',
    deviceId: 'HS-022',
    status: 'red', 
    role: 'Crane Operator',
    lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    currentVitals: { heartRate: 110, skinTemp: 38.9 }
  },
];