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
import { toast } from 'sonner';

// IMPORT CONSTANTS
import { SIGNAL_TIMEOUT_MS } from '@/lib/constants';

// Format Helpers
const formatTime = (isoString: string, showDate = false) => {
  const date = new Date(isoString);
  if (showDate) {
    return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDuration = (ms: number) => {
  if (ms < 0) return "00h 00m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export default function WorkerDetailsClient({ worker }: { worker: any }) {
  const router = useRouter();
  
  // Local state for inputs
  const [dateRange, setDateRange] = useState({
    from: worker.viewFrom,
    to: worker.viewTo
  });

  // --- 1. LIVE REFRESH LOGIC ---
  useEffect(() => {
    if (!worker.isLiveView) return; 

    const interval = setInterval(() => {
      router.refresh();
    }, 2000);
    return () => clearInterval(interval);
  }, [router, worker.isLiveView]);

  // --- 2. STATS CALCULATION ---
  const logs = worker.logs;
  const currentLog = logs.length > 0 ? logs[logs.length - 1] : {};

  // Check Connectivity using Global Constant
  const isOffline = useMemo(() => {
    if (!currentLog.timestamp || !worker.isLiveView) return true;
    const lastSeen = new Date(currentLog.timestamp).getTime();
    const now = Date.now();
    return (now - lastSeen) > SIGNAL_TIMEOUT_MS;
  }, [currentLog.timestamp, worker.isLiveView]);

  // Derived State: Show Realtime ONLY if Live + Online
  const showRealtimeStatus = worker.isLiveView && !isOffline;

  const stats = useMemo(() => {
    if (!logs.length) return { avgHr: 0, avgTemp: 0, shiftDuration: 0, hasCriticalEvent: false };
    
    // Average HR
    const totalHr = logs.reduce((acc: number, log: any) => acc + log.heartRate, 0);
    const avgHr = Math.round(totalHr / logs.length);
    
    // Average Temp
    const totalTemp = logs.reduce((acc: number, log: any) => acc + log.skinTemp, 0);
    const avgTemp = (totalTemp / logs.length).toFixed(1);

    // Duration Logic
    const firstLogTime = new Date(logs[0].timestamp).getTime();
    let lastLogTime;

    if (worker.isLiveView) {
      lastLogTime = Date.now();
    } else {
      lastLogTime = new Date(logs[logs.length - 1].timestamp).getTime();
    }
    
    // Critical Event Check
    const hasCriticalEvent = logs.some((log: any) => 
        log.riskLevel === 'high' || log.status === 'red' || log.skinTemp > 38
    );
    
    return {
      avgHr,
      avgTemp,
      shiftDuration: lastLogTime - firstLogTime,
      hasCriticalEvent
    };
  }, [logs, worker.isLiveView]);

  // --- 3. HANDLERS ---
  
  const handleDateInput = (key: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const applyDateFilter = () => {
    if(dateRange.from && dateRange.to) {
      router.push(`?from=${dateRange.from}&to=${dateRange.to}`);
    }
  };

  const handleExport = () => {
    if (!logs.length) {
      toast.error("No logs found for this date range.");
      return;
    }

    const headers = "Timestamp,Worker ID,Heart Rate (BPM),Skin Temp (C),Risk Level\n";
    const rows = logs.map((log: any) => 
      `${log.timestamp},${worker.id},${log.heartRate},${log.skinTemp},${log.riskLevel}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${worker.name.replace(' ', '_')}_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Export started successfully.");
  };

  const isMultiDay = worker.viewFrom !== worker.viewTo;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left: Worker Info */}
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
                {worker.isLiveView && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isOffline ? 'bg-stone-100 text-stone-500' : // Grey if Offline
                    worker.status === 'red' ? 'bg-red-100 text-red-600' : 
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {isOffline ? 'OFFLINE' : (worker.status === 'red' ? 'CRITICAL' : 'LIVE')}
                  </span>
                )}
              </h1>
                <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} /> Last Sync: {currentLog.timestamp ? formatTime(currentLog.timestamp) : '--'}
                  </span>
                  <span className="hidden md:inline">|</span>
                  <span>ID: {worker.id}</span>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3">
              
              {/* DATE RANGE PICKER */}
              <div className="flex items-center bg-stone-100 rounded-lg p-1 gap-1">
                <input 
                  type="date" 
                  value={dateRange.from}
                  onChange={(e) => handleDateInput('from', e.target.value)}
                  onBlur={applyDateFilter}
                  className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2"
                />
                <span className="text-stone-400 text-xs">-</span>
                <input 
                  type="date" 
                  value={dateRange.to}
                  onChange={(e) => handleDateInput('to', e.target.value)}
                  onBlur={applyDateFilter}
                  max={new Date().toISOString().split('T')[0]}
                  className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2"
                />
              </div>

              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm"
              >
                <Download size={14} />
                <span className="hidden md:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* Real-time Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Activity size={20} className="text-orange-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Avg HR</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono">
              {stats.avgHr}
              <span className="text-sm text-stone-400 font-sans ml-1">bpm</span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-500">
               Based on {logs.length} readings
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ThermometerSun size={20} className="text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Avg Temp</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono">
              {stats.avgTemp}
              <span className="text-sm text-stone-400 font-sans ml-1">°C</span>
            </div>
            <div className="mt-2 text-xs font-medium text-stone-500">
              Average across selection
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Calendar size={20} className="text-purple-500" />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Duration</span>
            </div>
            <div className="text-3xl font-bold text-stone-800 font-mono" suppressHydrationWarning>
              {formatDuration(stats.shiftDuration)}
            </div>
            <div className="mt-2 text-xs font-medium text-green-600">
              {worker.isLiveView ? 'Active Session' : 'Recorded Time'}
            </div>
          </div>

          {/* Status Card - Uses showRealtimeStatus logic */}
          <div className={`p-5 rounded-xl border shadow-sm ${
            // 1. If Realtime & RED -> RED
            showRealtimeStatus && worker.status === 'red' ? 'bg-red-50 border-red-200' :
            // 2. If History/Offline & Critical Event -> ORANGE
            !showRealtimeStatus && stats.hasCriticalEvent ? 'bg-orange-50 border-orange-200' :
            // 3. Else -> GREEN/WHITE
            'bg-white border-stone-200'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-lg ${
                showRealtimeStatus && worker.status === 'red' ? 'bg-red-100 text-red-600' :
                !showRealtimeStatus && stats.hasCriticalEvent ? 'bg-orange-100 text-orange-600' :
                'bg-emerald-50 text-emerald-500'
              }`}>
                <AlertTriangle size={20} />
              </div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                {showRealtimeStatus ? 'Current Status' : 'Session Summary'}
              </span>
            </div>

            <div className={`text-3xl font-bold font-mono ${
              showRealtimeStatus && worker.status === 'red' ? 'text-red-600' :
              !showRealtimeStatus && stats.hasCriticalEvent ? 'text-orange-600' :
              'text-emerald-600'
            }`}>
              {showRealtimeStatus 
                ? (worker.status === 'red' ? 'HIGH RISK' : 'NORMAL') 
                : (stats.hasCriticalEvent ? 'INCIDENT' : 'CLEAN')
              }
            </div>

            <div className="mt-2 text-xs font-medium text-stone-500">
              {showRealtimeStatus 
                ? 'Real-time Vital Signals' 
                : (stats.hasCriticalEvent ? 'Critical levels detected' : 'No anomalies recorded')
              }
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Physiological Trends</h3>
            <span className="text-xs text-stone-400 font-mono">
              Range: {worker.viewFrom} to {worker.viewTo}
            </span>
          </div>
          
          <div className="h-[350px] w-full">
            {logs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={logs}>
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
                    tickFormatter={(val) => formatTime(val, isMultiDay)} 
                    stroke="#a8a29e" 
                    fontSize={10} 
                    tickMargin={10}
                    minTickGap={60}
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="#a8a29e" 
                    fontSize={10} 
                    domain={['dataMin - 10', 'dataMax + 10']} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#a8a29e" 
                    fontSize={10} 
                    domain={[30, 45]} 
                  />
                  
                  <Tooltip 
                    labelFormatter={(label) => formatTime(label, true)}
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
                    isAnimationActive={false} 
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
                  
                  <ReferenceLine y={38} yAxisId="right" stroke="red" strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-stone-300">
                 <Activity size={48} className="mb-2 opacity-20" />
                 <p className="text-sm font-medium">No logs recorded for this date range.</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}