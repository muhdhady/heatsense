'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Activity, 
  ThermometerSun, 
  AlertTriangle, 
  Calendar,
  Download
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { mockWorkers } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

// Helper to generate fake history for the graphs
const generateHistory = () => {
  const data = [];
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    data.push({
      time: new Date(now.getTime() - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hr: 80 + Math.random() * 40, // Random HR between 80-120
      temp: 36.5 + Math.random() * 1.5, // Random Temp between 36.5-38.0
    });
  }
  return data;
};

export default function WorkerDetailsPage() {
  const router = useRouter();
  const params = useParams();
  
  // Find the worker from mock data
  const worker = mockWorkers.find(w => w.id === decodeURIComponent(params.workerId as string));
  const historyData = React.useMemo(() => generateHistory(), []);

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-800">Worker Not Found</h1>
          <button 
            onClick={() => router.back()}
            className="mt-4 text-orange-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-6">
      
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors text-stone-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{worker.name}</h1>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="font-mono bg-stone-100 px-1.5 rounded">{worker.id}</span>
              <span>•</span>
              <span>{worker.role}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:text-orange-600 transition-colors shadow-sm">
            <Calendar size={16} />
            Today
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-lg shadow-stone-200">
            <Download size={16} />
            Export Log
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        
        {/* 1. Current Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Risk Status Card */}
          <div className={cn(
            "p-6 rounded-xl border shadow-sm flex items-center justify-between",
            worker.status === 'red' ? "bg-red-50 border-red-100" : "bg-white border-stone-100"
          )}>
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Current Risk Level</p>
              <h3 className={cn("text-2xl font-bold", worker.status === 'red' ? "text-red-700" : "text-emerald-700")}>
                {worker.status === 'red' ? 'CRITICAL' : 'Normal'}
              </h3>
            </div>
            <div className={cn(
              "p-3 rounded-full",
              worker.status === 'red' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
            )}>
              <AlertTriangle size={24} />
            </div>
          </div>

          {/* Heart Rate Card */}
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Heart Rate</p>
              <h3 className="text-2xl font-bold text-stone-800">
                {worker.currentVitals?.heartRate} <span className="text-sm font-medium text-stone-400">BPM</span>
              </h3>
            </div>
            <div className="p-3 rounded-full bg-orange-50 text-orange-500">
              <Activity size={24} />
            </div>
          </div>

          {/* Temperature Card */}
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Skin Temp</p>
              <h3 className="text-2xl font-bold text-stone-800">
                {worker.currentVitals?.skinTemp} <span className="text-sm font-medium text-stone-400">°C</span>
              </h3>
            </div>
            <div className="p-3 rounded-full bg-orange-50 text-orange-500">
              <ThermometerSun size={24} />
            </div>
          </div>
        </div>

        {/* 2. Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Heart Rate Chart */}
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
            <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
              <Activity size={18} className="text-orange-500" />
              Heart Rate Trend (1h)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#a8a29e', fontSize: 12}} 
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#a8a29e', fontSize: 12}} 
                    domain={['dataMin - 10', 'dataMax + 10']}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="hr" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorHr)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Temperature Chart */}
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
            <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
              <ThermometerSun size={18} className="text-orange-500" />
              Temperature Trend (1h)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#a8a29e', fontSize: 12}} 
                    minTickGap={30}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#a8a29e', fontSize: 12}} 
                    domain={[35, 40]}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="temp" 
                    stroke="#ef4444" 
                    strokeWidth={2} 
                    dot={false}
                  />
                  {/* Critical Threshold Line */}
                  <Line 
                    type="monotone" 
                    dataKey={() => 38.5} 
                    stroke="#9ca3af" 
                    strokeDasharray="5 5" 
                    strokeWidth={1} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}