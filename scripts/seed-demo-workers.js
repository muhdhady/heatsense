// Seeds a small set of realistic demo workers with recent telemetry so the
// dashboard, Live Monitor, and History charts all have something to show.
//
// Run with: node scripts/seed-demo-workers.js
//
// Idempotent on the worker records (upsert by deviceId), but it WIPES and
// regenerates each demo worker's HealthLogs on every run so the data stays
// "fresh" relative to now — re-run it whenever the readings look stale.
//
// Reading density is deliberately modest (one sample every 5 minutes over the
// last few days) to keep payloads small; the history charts downsample anyway.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_INTERVAL_MS = 5 * 60 * 1000; // one reading every 5 minutes
const HISTORY_DAYS = 4;                    // how far back to generate readings

// Each demo worker has a "profile" that shapes its vitals so the dashboard shows
// a mix of states: healthy, borderline, critical, and offline.
const DEMO_WORKERS = [
  { deviceId: 'HS-001', name: 'Hazem Tarek',   role: 'Welder',          profile: 'healthy'  },
  { deviceId: 'HS-002', name: 'Mesum Ali',     role: 'Scaffolder',      profile: 'active'   },
  { deviceId: 'HS-003', name: 'Omar Khalifa',  role: 'Crane Operator',  profile: 'critical' },
  { deviceId: 'HS-004', name: 'Yusuf Rahman',  role: 'Laborer',         profile: 'healthy'  },
  { deviceId: 'HS-005', name: 'Bilal Hassan',  role: 'Electrician',     profile: 'offline'  },
];

const rand = (min, max) => min + Math.random() * (max - min);
const round1 = (n) => Math.round(n * 10) / 10;

// Returns { heartRate, skinTemp, tc, riskLevel } for a reading at fractional
// progress `t` (0 = oldest, 1 = newest) given the worker's profile.
function reading(profile, t) {
  // Gentle diurnal-ish wave plus noise so the lines aren't flat.
  const wave = Math.sin(t * Math.PI * 6);

  let hr, temp, tc = 0, risk = 0;
  switch (profile) {
    case 'active': // higher exertion, still safe
      hr = 105 + wave * 12 + rand(-6, 6);
      temp = 35.5 + wave * 0.6 + rand(-0.3, 0.3);
      tc = Math.random() < 0.1 ? 5 : 0;
      break;
    case 'critical': // trends into heat-stress territory and ends in the red zone
      hr = 90 + t * 72 + wave * 6 + rand(-4, 4);
      temp = 35 + t * 4 + rand(-0.2, 0.2);
      tc = t > 0.7 ? (Math.random() < 0.5 ? 17 : 11) : (Math.random() < 0.15 ? 5 : 0);
      risk = temp >= 38.5 || hr >= 150 ? 1 : 0;
      break;
    case 'healthy':
    default:
      hr = 78 + wave * 8 + rand(-5, 5);
      temp = 34.5 + wave * 0.5 + rand(-0.3, 0.3);
      tc = Math.random() < 0.05 ? 5 : 0;
      break;
  }
  return {
    heartRate: Math.round(hr),
    skinTemp: round1(temp),
    tc,
    riskLevel: risk,
  };
}

async function seedWorker(spec) {
  const worker = await prisma.worker.upsert({
    where: { deviceId: spec.deviceId },
    update: { name: spec.name, role: spec.role },
    create: { name: spec.name, role: spec.role, deviceId: spec.deviceId, status: 'green' },
  });

  // Regenerate logs from scratch so timestamps stay anchored to "now".
  await prisma.healthLog.deleteMany({ where: { workerId: worker.id } });

  const now = Date.now();
  // Offline workers stopped transmitting a while ago; everyone else is current.
  const endOffsetMs = spec.profile === 'offline' ? 6 * 60 * 60 * 1000 : 0;
  const end = now - endOffsetMs;
  const start = end - HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const count = Math.floor((end - start) / SAMPLE_INTERVAL_MS);

  const rows = [];
  let last = null;
  for (let i = 0; i <= count; i++) {
    const ts = new Date(start + i * SAMPLE_INTERVAL_MS);
    const r = reading(spec.profile, i / count);
    rows.push({ ...r, workerId: worker.id, timestamp: ts });
    last = r;
  }

  await prisma.healthLog.createMany({ data: rows });

  // Sync the worker's denormalized status/lastSeen to its final reading,
  // matching what the live ingest endpoint would have done.
  await prisma.worker.update({
    where: { id: worker.id },
    data: {
      status: last && last.riskLevel === 1 ? 'red' : 'green',
      lastSeen: new Date(end),
    },
  });

  console.log(`  ${spec.name} (${spec.deviceId}) — ${rows.length} readings, profile=${spec.profile}`);
}

async function main() {
  console.log('Seeding demo workers + readings...');
  for (const spec of DEMO_WORKERS) {
    await seedWorker(spec);
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
