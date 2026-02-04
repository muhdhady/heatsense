'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Download, Calendar, Activity, 
  ThermometerSun, AlertTriangle, Clock 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

export default function WorkerDetailsClient({ worker }: { worker: any }) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<'today' | 'all'>('today');

  // --- 1. LIVE DATA TICKER ---
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 2000);
    return () => clearInterval(interval);
  }, [router]);

  // --- 2. DATA FILTERING ---
  const filteredLogs = useMemo(() => {
    if (timeRange === 'all') return worker.logs;
    
    // Filter for "Today" (Midnight onwards)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return worker.logs.filter((log: any) => new Date(log.timestamp) >= startOfDay);
  }, [worker.logs, timeRange]);

  // Calculate Stats based on visible data
  const stats = useMemo(() => {
    if (!filteredLogs.length) return { avgHr: 0, peakTemp: 0 };
    
    const totalHr = filteredLogs.reduce((acc: number, log: any) => acc + log.heartRate, 0);
    const maxTemp = Math.max(...filteredLogs.map((log: any) => log.skinTemp));
    
    return {
      avgHr: Math.round(totalHr / filteredLogs.length),
      peakTemp: maxTemp.toFixed(1)
    };
  }, [filteredLogs]);

  // Current values (latest log)
  const currentLog = worker.logs[worker.logs.length - 1] || {};

  // --- 3. EXPORT FUNCTION ---
  const handleExport = () => {
    if (!filteredLogs.length) return;

    const headers = "Timestamp,Worker ID,Heart Rate (BPM),Skin Temp (C),Risk Level\n";
    const rows = filteredLogs.map((log: any) => 
      `${log.timestamp},${worker.id},${log.heartRate},${log.skinTemp},${log.riskLevel}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${worker.name.replace(' ', '_')}_logs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 4. FORMATTING CHART AXIS ---
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard" 
                className="p-2 -ml-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-all"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  {worker.name}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    worker.status === 'red' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {worker.status === 'red' ? 'Critical' : 'Safe'}
                  </span>
                </h1>
                <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> Last Sync: Just now
                  </span>
                  <span>|</span>
                  <span>ID: {worker.id}</span>
                  <span>|</span>
                  <span>Device: {worker.deviceId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-stone-100 p-1 rounded-lg flex text-xs font-medium">
                <button 
                  onClick={() => setTimeRange('today')}
                  className={`px-3 py-1.5 rounded-md transition-all ${timeRange === 'today' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  Today
                </button>
                <button 
                  onClick={() => setTimeRange('all')}
                  className={`px-3 py-1.5 rounded-md transition-all ${timeRange === 'all' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  History
                </button>
              </div>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
              >
                <Download size={14} />
                Export Log
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* Real-time Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Activity size={20} className="text-orange-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Current HR</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono">
              {currentLog.heartRate || '--'}
              <span className="text-sm text-stone-400 font-sans ml-1">bpm</span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-500">
              Avg: {stats.avgHr} bpm
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ThermometerSun size={20} className="text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Skin Temp</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono">
              {currentLog.skinTemp?.toFixed(1) || '--'}
              <span className="text-sm text-stone-400 font-sans ml-1">°C</span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-500">
              Peak: {stats.peakTemp}°C
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Calendar size={20} className="text-purple-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Shift Duration</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono">
              04:20
            </div>
            <div className="mt-2 text-xs font-medium text-green-600">
              Active Session
            </div>
          </div>

          <div className={`p-5 rounded-xl border shadow-sm ${worker.status === 'red' ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-lg ${worker.status === 'red' ? 'bg-red-100' : 'bg-emerald-50'}`}>
                <AlertTriangle size={20} className={worker.status === 'red' ? 'text-red-600' : 'text-emerald-500'} />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Risk Level</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${worker.status === 'red' ? 'text-red-600' : 'text-emerald-600'}`}>
              {worker.status === 'red' ? 'HIGH' : 'LOW'}
            </div>
            <div className="mt-2 text-xs font-medium text-stone-500">
              {worker.status === 'red' ? 'Immediate Action Reqd' : 'Vital signs normal'}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-6">Physiological Trends</h3>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredLogs}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatTime} 
                  stroke="#a8a29e" 
                  fontSize={10} 
                  tickMargin={10}
                  minTickGap={50}
                />
                <YAxis 
                  yAxisId="left" 
                  stroke="#a8a29e" 
                  fontSize={10} 
                  domain={['dataMin - 10', 'dataMax + 10']} // Auto-scale HR
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#a8a29e" 
                  fontSize={10} 
                  domain={[35, 41]} // Fixed scale for Temp
                />
                
                <Tooltip 
                  labelFormatter={(label) => formatTime(label)}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="heartRate" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorHr)" 
                  name="Heart Rate"
                  isAnimationActive={false} // Disable animation for smooth live updates
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="skinTemp" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTemp)" 
                  name="Skin Temp"
                  isAnimationActive={false}
                />
                
                {/* Risk Threshold Line */}
                <ReferenceLine y={38} yAxisId="right" stroke="red" strokeDasharray="3 3" label={{ position: 'right',  value: 'Risk', fill: 'red', fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </main>
    </div>
  );
}