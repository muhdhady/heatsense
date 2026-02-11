'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Download, Calendar, Activity, 
  ThermometerSun, Clock, History, Radio, BrainCircuit, AlertCircle, Loader2, Filter
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { toast } from 'sonner';

import { SIGNAL_TIMEOUT_MS, UI_REFRESH_INTERVAL_MS } from '@/lib/constants';
import { formatTimeAgo, cn } from '@/lib/utils';

// --- HELPER: Smart Date Formatting for Axis ---
const formatAxisDate = (isoString: string, showDate: boolean) => {
  const date = new Date(isoString);
  if (showDate) {
    // If multi-day, show "02 Feb 14:00"
    return date.toLocaleDateString('en-AE', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  }
  // If single day, just show "14:00"
  return date.toLocaleTimeString('en-AE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

const formatTooltipDate = (isoString: string) => {
  return new Date(isoString).toLocaleDateString('en-AE', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

export default function WorkerDetailsClient({ worker }: { worker: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const hasDateParams = searchParams.has('from') || searchParams.has('to');
  const [activeTab, setActiveTab] = useState<'live' | 'history'>(hasDateParams ? 'history' : 'live');

  const [dateRange, setDateRange] = useState({
    from: worker.viewFrom,
    to: worker.viewTo
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const logs = worker.logs; 
  const liveLog = worker.latestLog; 

  // --- CHECK IF MULTI-DAY DATA ---
  // If the first log and last log are on different days, we enable date labels on X-Axis
  const isMultiDay = useMemo(() => {
    if (logs.length < 2) return false;
    const start = new Date(logs[0].timestamp).getDate();
    const end = new Date(logs[logs.length - 1].timestamp).getDate();
    return start !== end;
  }, [logs]);
  
  // --- DERIVED METRICS ---
  const isOffline = useMemo(() => {
    if (!liveLog) return true;
    const lastSeen = new Date(liveLog.timestamp).getTime();
    return (Date.now() - lastSeen) > SIGNAL_TIMEOUT_MS;
  }, [liveLog]);

  const stats = useMemo(() => {
    if (!logs.length) return { avgHr: 0, avgTemp: 0, rpe: '--' };
    const totalHr = logs.reduce((acc: number, log: any) => acc + log.heartRate, 0);
    const totalTemp = logs.reduce((acc: number, log: any) => acc + log.skinTemp, 0);
    return {
      avgHr: Math.round(totalHr / logs.length),
      avgTemp: (totalTemp / logs.length).toFixed(1),
      rpe: activeTab === 'live' && liveLog ? liveLog.rpe : (logs[logs.length - 1]?.rpe || '--')
    };
  }, [logs, liveLog, activeTab]);

  // --- HANDLERS ---
  const handleTabChange = (tab: 'live' | 'history') => {
    setActiveTab(tab);
    if (tab === 'live') {
      startTransition(() => {
        router.push(`/dashboard/${worker.id}`);
        setDateRange({ from: todayStr, to: todayStr });
      });
    }
  };

  useEffect(() => {
    if (activeTab !== 'live') return;
    const interval = setInterval(() => { router.refresh(); }, UI_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router, activeTab]);

  const isRangeInvalid = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return false;
    return new Date(dateRange.from) > new Date(dateRange.to);
  }, [dateRange]);

  const handleDateInput = (key: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const applyDateFilter = () => {
    if(dateRange.from && dateRange.to && !isRangeInvalid) {
      startTransition(() => {
        router.push(`/dashboard/${worker.id}?from=${dateRange.from}&to=${dateRange.to}`);
        setActiveTab('history');
      });
    } else {
      toast.error("Please select a valid date range.");
    }
  };

  const handleExport = () => {
    if (isRangeInvalid || !logs.length || isPending) return;

    const headers = "Timestamp,Worker ID,Heart Rate (BPM),Skin Temp (C),RPE (Borg),Risk Level\n";
    const rows = logs.map((log: any) => 
      `${log.timestamp},${worker.id},${log.heartRate},${log.skinTemp},${log.rpe || 6},${log.riskLevel}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeName = worker.name.replace(/\s+/g, '_');
    link.setAttribute('download', `${safeName}_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started.");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      
      {/* HEADER */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 bg-stone-50 border border-stone-200 text-stone-500 rounded-lg hover:bg-orange-50 hover:text-orange-600 transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-stone-900 flex items-center gap-3">
                  {worker.name}
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    isOffline ? "bg-stone-100 text-stone-500" : 
                    worker.status === 'red' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {isOffline ? 'OFFLINE' : 'LIVE'}
                  </span>
                </h1>
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 font-mono">
                  <span>ID: {worker.id}</span>
                  <span className="text-stone-300">|</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {liveLog ? formatTimeAgo(liveLog.timestamp) : 'Never'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex p-1 bg-stone-100 rounded-lg self-start md:self-auto">
              <button onClick={() => handleTabChange('live')} className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2", activeTab === 'live' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700")}>
                <Radio size={14} className={activeTab === 'live' ? "text-orange-500 animate-pulse" : ""} /> Live Monitor
              </button>
              <button onClick={() => handleTabChange('history')} className={cn("px-4 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2", activeTab === 'history' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700")}>
                <History size={14} /> History
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* LIVE MONITOR */}
        {activeTab === 'live' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {isOffline ? (
               <div className="bg-stone-100 border border-stone-200 rounded-xl p-8 text-center">
                  <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                    <Radio size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-700">Worker is Offline</h3>
                  <p className="text-stone-500 text-sm mt-2">
                    No active session detected. <br/>Last signal: {liveLog ? formatTimeAgo(liveLog.timestamp) : 'never'}.
                  </p>
               </div>
            ) : (
               <>
                 <div className={cn("p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm", worker.status === 'red' ? "bg-red-50 border-red-200" : "bg-white border-stone-200")}>
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-full", worker.status === 'red' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600")}>
                         <Activity size={24} />
                      </div>
                      <div>
                        <h2 className={cn("text-2xl font-bold", worker.status === 'red' ? "text-red-700" : "text-emerald-700")}>
                          {worker.status === 'red' ? "CRITICAL STATUS" : "Active Session"}
                        </h2>
                        <p className="text-stone-500 text-sm mt-1">Monitoring active. Device synced {formatTimeAgo(liveLog?.timestamp || '')}.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-center">
                      <div>
                        <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.heartRate || '--'}</div>
                        <div className="text-xs text-stone-400 font-bold uppercase tracking-wider">BPM</div>
                      </div>
                      <div className="w-px h-10 bg-stone-200"></div>
                      <div>
                        <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.skinTemp?.toFixed(1) || '--'}</div>
                        <div className="text-xs text-stone-400 font-bold uppercase tracking-wider">°C</div>
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                       <div className="flex justify-between mb-4"><span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Avg Heart Rate</span><Activity size={16} className="text-orange-500" /></div>
                       <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.heartRate} <span className="text-sm text-stone-400 font-sans ml-1">bpm</span></div>
                       <div className="mt-2 text-xs font-medium text-stone-500">Current Reading</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                       <div className="flex justify-between mb-4"><span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Avg Skin Temp</span><ThermometerSun size={16} className="text-blue-500" /></div>
                       <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.skinTemp?.toFixed(1)} <span className="text-sm text-stone-400 font-sans ml-1">°C</span></div>
                       <div className="mt-2 text-xs font-medium text-stone-500">Current Reading</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                       <div className="flex justify-between mb-4"><span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Real-Time RPE</span><BrainCircuit size={16} className="text-purple-500" /></div>
                       <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.rpe || '--'}</div>
                       <div className="mt-2 text-xs font-medium text-stone-500">Borg Scale (6-20)</div>
                    </div>
                 </div>
               </>
            )}
          </div>
        )}

        {/* HISTORY FILTER */}
        {activeTab === 'history' && (
           <div className={cn(
             "p-4 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-300 animate-in fade-in slide-in-from-top-1",
             isRangeInvalid ? "bg-red-50 border-red-200" : "bg-white border-stone-200"
           )}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                 <div className="flex items-center gap-2">
                   <div className={cn("flex items-center gap-2 text-sm font-medium", isRangeInvalid ? "text-red-700" : "text-stone-500")}>
                     {isRangeInvalid ? <AlertCircle size={16} /> : <Calendar size={16} />}
                     <span>Range:</span>
                   </div>
                   <div className={cn("flex items-center gap-2 rounded-lg p-1", isRangeInvalid ? "bg-red-100" : "bg-stone-50")}>
                     <input type="date" value={dateRange.from} onChange={(e) => handleDateInput('from', e.target.value)} max={todayStr} className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2 py-1" />
                     <span className="text-stone-300">-</span>
                     <input type="date" value={dateRange.to} max={todayStr} onChange={(e) => handleDateInput('to', e.target.value)} className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2 py-1" />
                   </div>
                 </div>
                 <button onClick={applyDateFilter} disabled={isPending || isRangeInvalid} className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2", (isPending || isRangeInvalid) ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 hover:border-stone-400")}>
                    {isPending ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
                    {isPending ? "Loading..." : "Apply"}
                 </button>
              </div>
              <button onClick={handleExport} disabled={isPending || isRangeInvalid || !logs.length} className={cn("w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all", (isPending || isRangeInvalid || !logs.length) ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-stone-900 text-white hover:bg-orange-600 shadow-sm")}>
                 <Download size={14} /> Export CSV
              </button>
           </div>
        )}

        {/* CHARTS */}
        {((activeTab === 'live' && !isOffline) || activeTab === 'history') && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             
             {activeTab === 'live' && (
                <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-50 p-2 rounded-lg justify-center">
                   <BrainCircuit size={14} />
                   <span>RPE is calculated using the Borg Scale (Heart Rate / 10).</span>
                </div>
             )}

             <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                   <Activity size={16} className="text-orange-500" /> Heart Rate Trend
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={logs}>
                      <defs>
                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      
                      {/* UPDATED X-AXIS */}
                      <XAxis 
                        dataKey="timestamp" 
                        // Smart formatting: shows date if multi-day, only time if single day
                        tickFormatter={(val) => formatAxisDate(val, isMultiDay)} 
                        stroke="#a8a29e" 
                        fontSize={10} 
                        minTickGap={50} 
                      />
                      
                      <YAxis stroke="#a8a29e" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} />
                      
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        // Uses the full date formatter for the tooltip
                        labelFormatter={(l) => formatTooltipDate(l)} 
                        labelStyle={{ color: '#0c0a09', fontWeight: 'bold' }} 
                      />
                      
                      <Area type="monotone" dataKey="heartRate" stroke="#f97316" strokeWidth={2} fill="url(#colorHr)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
                <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                   <ThermometerSun size={16} className="text-blue-500" /> Skin Temperature Trend
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={logs}>
                      <defs>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      
                      {/* UPDATED X-AXIS */}
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(val) => formatAxisDate(val, isMultiDay)} 
                        stroke="#a8a29e" 
                        fontSize={10} 
                        minTickGap={50} 
                      />
                      
                      <YAxis stroke="#a8a29e" fontSize={10} domain={[32, 42]} />
                      
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        labelFormatter={(l) => formatTooltipDate(l)} 
                        labelStyle={{ color: '#0c0a09', fontWeight: 'bold' }} 
                      />
                      
                      <Area type="monotone" dataKey="skinTemp" stroke="#3b82f6" strokeWidth={2} fill="url(#colorTemp)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
           </div>
        )}
      </main>
    </div>
  );
}