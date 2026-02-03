export interface Worker {
  id: string;
  name: string;
  deviceId: string;
  status: 'green' | 'red'; // Strict typing: only these two allowed
  role: string;
  lastSeen: string; // ISO Date string
  
  // Snapshot of vitals for the dashboard table, have to update
  currentVitals?: {
    heartRate: number;
    skinTemp: number;
  };
}

export interface HealthLog {
  id: number;
  timestamp: string;
  heartRate: number;
  skinTemp: number;
  riskLevel: number; // 0 = Safe, 1 = Critical
  workerId: string;
}