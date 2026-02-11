import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import db from '@/lib/db';
import DashboardClient from './client-page';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Weather API (Sharjah - AUS Campus Coordinates)
const WEATHER_API = "https://api.open-meteo.com/v1/forecast?latitude=25.3117&longitude=55.4921&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FDubai";

// Helper: Fetch Weather with ISR (Cached for 30 mins)
async function getWeather() {
  try {
    const res = await fetch(WEATHER_API, {
      next: { revalidate: 1800 } // Cache for 1800 seconds (30 mins)
    });
    
    if (!res.ok) throw new Error('Weather fetch failed');
    
    const data = await res.json();
    return {
      temp: data.current?.temperature_2m.toFixed(1) || '--',
      humidity: data.current?.relative_humidity_2m.toString() || '--'
    };
  } catch (error) {
    console.error("Weather Error:", error);
    return { temp: '--', humidity: '--' }; // Fallback values
  }
}

export default async function DashboardPage() {
  // 1. Secure Auth Check
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  // 2. Parallel Data Fetching
  const [workers, weatherData] = await Promise.all([
    // A. Fetch Workers
    db.worker.findMany({
      include: {
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 1, // Get only the latest log for "Real-time" status
        },
      },
      orderBy: { id: 'asc' }
    }),
    // B. Fetch Weather (Cached)
    getWeather()
  ]);

  // 3. Transform Data for the UI
  const formattedWorkers = workers.map(w => ({
    ...w,
    lastSeen: w.lastSeen.toISOString(),
    currentVitals: w.logs[0] ? {
      heartRate: w.logs[0].heartRate,
      skinTemp: w.logs[0].skinTemp,
    } : undefined
  }));

  // 4. Pass combined data to Client
  return (
    <DashboardClient 
      initialData={formattedWorkers} 
      initialWeather={weatherData} 
    />
  );
}