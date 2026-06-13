// Server component — the main dashboard page.
//
// Runs on the server on every request (Next.js default for server components).
// Fetches all workers with their latest health log, then passes the data down
// to the DashboardClient component for rendering.
//
// Weather is fetched from Open-Meteo and cached for 30 minutes using ISR
// (Incremental Static Regeneration) so it doesn't hit the external API on every
// page load, while still staying reasonably fresh throughout the day.

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import db from '@/lib/db';
import DashboardClient from './client-page';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Open-Meteo free API — Sharjah / AUS campus coordinates (lat 25.3117, lon 55.4921)
const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast?latitude=25.3117&longitude=55.4921&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FDubai";

async function getWeather() {
  try {
    // `next: { revalidate: 1800 }` tells Next.js to cache this fetch result for
    // 1800 seconds (30 min) before re-fetching from Open-Meteo
    const res = await fetch(WEATHER_API, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    return {
      temp: data.current?.temperature_2m.toFixed(1) || '--',
      humidity: data.current?.relative_humidity_2m.toString() || '--',
    };
  } catch (error) {
    console.error('[Weather]:', error);
    return { temp: '--', humidity: '--' }; // dashboard still loads if weather fails
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  // Fetch workers and weather in parallel to minimise total server response time
  const [workers, weatherData] = await Promise.all([
    db.worker.findMany({
      include: {
        // Only the most recent log is needed here — just enough to populate
        // the vitals columns in the dashboard table
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    }),
    getWeather(),
  ]);

  // Flatten the nested `logs` array into a `currentVitals` object and convert
  // Date objects to ISO strings so Next.js can serialize the data for the client
  const formattedWorkers = workers.map(w => ({
    ...w,
    lastSeen: w.lastSeen.toISOString(),
    currentVitals: w.logs[0]
      ? { heartRate: w.logs[0].heartRate, skinTemp: w.logs[0].skinTemp }
      : undefined,
  }));

  return (
    <DashboardClient
      initialData={formattedWorkers}
      initialWeather={weatherData}
    />
  );
}
