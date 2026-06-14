// Client component — worker detail page.
//
// Two tabs:
//   Live Monitor — shows the most recent reading and polls for new data automatically.
//   History      — lets the supervisor filter by date range, view charts, and export CSV.
//
// Data flow:
//   WorkerDetailsPage (server) fetches logs + latestLog → passes as `worker` prop.
//   While on the Live tab, router.refresh() re-runs the server component every
//   UI_REFRESH_INTERVAL_MS milliseconds, streaming down updated props.
//
// TC (thermal discomfort) mapping:
//   The wearable has a physical button the worker presses to report discomfort.
//   Raw values from the DB: 0 (no input yet), 5 (low), 11 (medium), 17 (high).
//   These are displayed as None / Low / Medium / High on the stat card.

'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, Calendar, Activity,
  ThermometerSun, Clock, History, Radio, BrainCircuit, AlertCircle, Loader2, Filter,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

import { SIGNAL_TIMEOUT_MS, UI_REFRESH_INTERVAL_MS } from '@/lib/constants';
import { formatTimeAgo, cn } from '@/lib/utils';

/**
 * Formats a log timestamp for the chart X-axis.
 * When the selected range spans multiple calendar days, the full date is shown
 * ("02 May 14:00") so the supervisor can tell which day each point belongs to.
 * For a single-day view, just the time is shown ("14:00") to save space.
 */
const formatAxisDate = (isoString: string, showDate: boolean) => {
  const date = new Date(isoString);
  if (showDate) {
    return date.toLocaleDateString('en-AE', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
  return date.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatTooltipDate = (isoString: string) =>
  new Date(isoString).toLocaleDateString('en-AE', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

export default function WorkerDetailsClient({ worker }: { worker: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [liveLog, setLiveLog] = useState(worker.latestLog);
  const [chartLogs, setChartLogs] = useState(worker.logs);
  // Tracks the worker's current risk status. worker.status is a prop from the server;
  // on the Live tab it is refreshed by polling (router.refresh()) and synced into
  // liveStatus so the banner and LIVE/OFFLINE badge stay current.
  const [liveStatus, setLiveStatus] = useState<string>(worker.status);

  // If the URL already contains date params (e.g. navigating back from export),
  // open on the History tab directly
  const hasDateParams = searchParams.has('from') || searchParams.has('to');
  const [activeTab, setActiveTab] = useState<'live' | 'history'>(hasDateParams ? 'history' : 'live');

  const [dateRange, setDateRange] = useState({ from: worker.viewFrom, to: worker.viewTo });

  // Use the UAE timezone (Asia/Dubai, UTC+4) to match the server-side computation.
  // toISOString() would return UTC, causing the date picker to be one day behind
  // between midnight and 4am UAE time — a real operational window for shift handovers.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

  // Determine whether the displayed log range spans more than one calendar day.
  // Affects how X-axis tick labels are formatted in the charts.
  // Use the full date string (YYYY-MM-DD) rather than .getDate() (1–31): two readings
  // on e.g. May 3 and June 3 would both return 3 from getDate() and be wrongly
  // treated as the same day, hiding date labels on a multi-month chart.
  const isMultiDay = useMemo(() => {
    if (chartLogs.length < 2) return false;
    const start = chartLogs[0].timestamp.split('T')[0];
    const end = chartLogs[chartLogs.length - 1].timestamp.split('T')[0];
    return start !== end;
  }, [chartLogs]);

  // The worker is considered offline if the most recent log is older than SIGNAL_TIMEOUT_MS.
  // This mirrors the same threshold used on the dashboard table.
  const isOffline = useMemo(() => {
    if (!liveLog) return true;
    return Date.now() - new Date(liveLog.timestamp).getTime() > SIGNAL_TIMEOUT_MS;
  }, [liveLog]);

  // Summary stats shown on the stat cards.
  // On the Live tab, tc comes from the latest log (real-time).
  // On the History tab, tc comes from the last row in the filtered range.
  const stats = useMemo(() => {
    if (!chartLogs.length) return { avgHr: 0, avgTemp: 0, tc: null };
    const totalHr = chartLogs.reduce((acc: number, log: any) => acc + log.heartRate, 0);
    const totalTemp = chartLogs.reduce((acc: number, log: any) => acc + log.skinTemp, 0);
    const rawTc = activeTab === 'live' && liveLog ? liveLog.tc : (chartLogs[chartLogs.length - 1]?.tc ?? null);
    return {
      avgHr: Math.round(totalHr / chartLogs.length),
      avgTemp: (totalTemp / chartLogs.length).toFixed(1),
      tc: rawTc,
    };
  }, [chartLogs, liveLog, activeTab]);

  /**
   * Maps the raw TC integer from the DB to a human-readable discomfort label.
   * The card is titled "Thermal Discomfort", so 5 = "Low" means low discomfort (comfortable).
   */
  const tcLabel = (val: number | null): string => {
    if (val === null || val === 0) return 'None';
    if (val <= 7) return 'Low';
    if (val <= 14) return 'Medium';
    return 'High';
  };

  const tcColor = (val: number | null): string => {
    if (val === null || val === 0) return 'text-stone-400';
    if (val <= 7) return 'text-emerald-600';
    if (val <= 14) return 'text-amber-500';
    return 'text-red-500';
  };

  const handleTabChange = (tab: 'live' | 'history') => {
    setActiveTab(tab);
    if (tab === 'live') {
      // Clear any date params from the URL and reset the date picker to today
      startTransition(() => {
        router.push(`/dashboard/${worker.id}`);
        setDateRange({ from: todayStr, to: todayStr });
      });
    } else {
      // Switching to History: reset chartLogs to the clean server-fetched data
      // for the selected range.
      setChartLogs(worker.logs);
    }
  };

  // Poll for fresh data on the Live tab by re-running the server component.
  // router.refresh() re-fetches the worker (including its latest log) at the
  // configured interval; the sync effect below pushes the new prop into state.
  useEffect(() => {
    if (activeTab !== 'live') return;

    const interval = setInterval(() => {
      router.refresh();
    }, UI_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeTab, router]);

  // Sync server-refreshed data into the live view when on the Live tab.
  // (On the History tab, chartLogs is driven by the date-range fetch instead.)
  useEffect(() => {
    if (activeTab !== 'live') return;
    setLiveLog(worker.latestLog);
    setLiveStatus(worker.status);
    setChartLogs(worker.logs);
  }, [worker, activeTab]);

  // Validate that the start date is not after the end date
  const isRangeInvalid = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return false;
    return new Date(dateRange.from) > new Date(dateRange.to);
  }, [dateRange]);

  const handleDateInput = (key: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [key]: value }));
  };

  const applyDateFilter = () => {
    if (dateRange.from && dateRange.to && !isRangeInvalid) {
      startTransition(() => {
        router.push(`/dashboard/${worker.id}?from=${dateRange.from}&to=${dateRange.to}`);
        setActiveTab('history');
      });
    } else {
      toast.error("Invalid Range: Start Date cannot be after End Date.");
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  // Export the FULL log history for the selected range as CSV.
  //
  // The charts only receive a downsampled subset of readings (the server caps
  // chart points for performance), so we can't build the CSV from chartLogs or
  // it would be lossy. Instead we hit /api/workers/[id]/export, which does the
  // full un-downsampled DB read and returns a CSV file on demand.
  const handleExport = async () => {
    if (isRangeInvalid || isPending || isExporting) return;

    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/workers/${worker.id}/export?from=${dateRange.from}&to=${dateRange.to}`,
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const safeName = worker.name.replace(/\s+/g, '_');
      link.setAttribute('download', `${safeName}_${dateRange.from}_to_${dateRange.to}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Download started.");
    } catch (err) {
      console.error('[Export]:', err);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">

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
                  {/* LIVE/OFFLINE badge — reflects whether the device is actively transmitting */}
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    isOffline ? "bg-stone-100 text-stone-500" :
                    liveStatus === 'red' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600",
                  )}>
                    {isOffline ? 'OFFLINE' : liveStatus === 'red' ? 'CRITICAL' : 'LIVE'}
                  </span>
                </h1>
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-1 font-mono">
                  <span>ID: {worker.id}</span>
                  <span className="text-stone-300">|</span>
                  <span className="flex items-center gap-1" suppressHydrationWarning>
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

        {/* Live Monitor tab */}
        {activeTab === 'live' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {isOffline ? (
              <div className="bg-stone-100 border border-stone-200 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                  <Radio size={32} />
                </div>
                <h3 className="text-lg font-bold text-stone-700">Worker is Offline</h3>
                <p className="text-stone-500 text-sm mt-2">
                  No active session detected. <br />Last signal: {liveLog ? formatTimeAgo(liveLog.timestamp) : 'never'}.
                </p>
              </div>
            ) : (
              <>
                {/* Status banner — red when critical, green when safe */}
                <div className={cn("p-6 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm", liveStatus === 'red' ? "bg-red-50 border-red-200" : "bg-white border-stone-200")}>
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-full", liveStatus === 'red' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600")}>
                      <Activity size={24} />
                    </div>
                    <div>
                      <h2 className={cn("text-2xl font-bold", liveStatus === 'red' ? "text-red-700" : "text-emerald-700")}>
                        {liveStatus === 'red' ? "CRITICAL STATUS" : "Active Session"}
                      </h2>
                      <p className="text-stone-500 text-sm mt-1">Monitoring active. Device synced {formatTimeAgo(liveLog?.timestamp || '')}.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 text-center">
                    <div>
                      <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.heartRate || '--'}</div>
                      <div className="text-xs text-stone-400 font-bold uppercase tracking-wider">BPM</div>
                    </div>
                    <div className="w-px h-10 bg-stone-200" />
                    <div>
                      <div className="text-3xl font-bold text-stone-800 font-mono">{liveLog?.skinTemp?.toFixed(1) || '--'}</div>
                      <div className="text-xs text-stone-400 font-bold uppercase tracking-wider">°C</div>
                    </div>
                  </div>
                </div>

                {/* Three stat cards: current heart rate, current skin temp, and thermal discomfort */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                    <div className="flex justify-between mb-4">
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Heart Rate</span>
                      <Activity size={16} className="text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold text-stone-800 font-mono">
                      {liveLog?.heartRate} <span className="text-sm text-stone-400 font-sans ml-1">bpm</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-stone-500">Current Reading</div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                    <div className="flex justify-between mb-4">
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Skin Temp</span>
                      <ThermometerSun size={16} className="text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-stone-800 font-mono">
                      {liveLog?.skinTemp?.toFixed(1)} <span className="text-sm text-stone-400 font-sans ml-1">°C</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-stone-500">Current Reading</div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
                    <div className="flex justify-between mb-4">
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Thermal Discomfort</span>
                      <BrainCircuit size={16} className="text-purple-500" />
                    </div>
                    {/* tcColor/tcLabel map the raw integer to a colour-coded label */}
                    <div className={`text-3xl font-bold font-mono ${tcColor(liveLog?.tc ?? null)}`}>
                      {tcLabel(liveLog?.tc ?? null)}
                    </div>
                    <div className="mt-2 text-xs font-medium text-stone-500">Perceptual Input</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* History tab — date range picker + CSV export button */}
        {activeTab === 'history' && (
          <div className={cn(
            "p-4 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-300 animate-in fade-in slide-in-from-top-1",
            // Highlight the filter row red if the supervisor enters an invalid range
            isRangeInvalid ? "bg-red-50 border-red-200" : "bg-white border-stone-200",
          )}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className={cn("flex items-center gap-2 text-sm font-medium", isRangeInvalid ? "text-red-700" : "text-stone-500")}>
                  {isRangeInvalid ? <AlertCircle size={16} /> : <Calendar size={16} />}
                  <span>{isRangeInvalid ? "Invalid Date Range:" : "Range:"}</span>
                </div>
                <div className={cn("flex items-center gap-2 rounded-lg p-1", isRangeInvalid ? "bg-red-100" : "bg-stone-50")}>
                  <input type="date" value={dateRange.from} onChange={(e) => handleDateInput('from', e.target.value)} max={todayStr} className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2 py-1" />
                  <span className="text-stone-300">-</span>
                  <input type="date" value={dateRange.to} max={todayStr} onChange={(e) => handleDateInput('to', e.target.value)} className="bg-transparent border-none text-xs font-medium text-stone-700 focus:ring-0 outline-none w-28 px-2 py-1" />
                </div>
              </div>

              {/* Apply pushes date params into the URL, which triggers a server re-fetch */}
              <button
                onClick={applyDateFilter}
                disabled={isPending || isRangeInvalid}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  (isPending || isRangeInvalid)
                    ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                    : "bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 hover:border-stone-400",
                )}
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
                {isPending ? "Loading..." : "Apply"}
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={isPending || isExporting || isRangeInvalid || !chartLogs.length}
              className={cn(
                "w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                (isPending || isExporting || isRangeInvalid || !chartLogs.length)
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-stone-900 text-white hover:bg-orange-600 shadow-sm",
              )}
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        )}

        {/* Charts — shown when online on Live tab, always shown on History tab */}
        {((activeTab === 'live' && !isOffline) || activeTab === 'history') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Heart rate area chart */}
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Activity size={16} className="text-orange-500" /> Heart Rate Trend
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartLogs}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(val) => formatAxisDate(val, isMultiDay)}
                      stroke="#a8a29e"
                      fontSize={10}
                      minTickGap={50}
                    />
                    <YAxis stroke="#a8a29e" fontSize={10} domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(l) => formatTooltipDate(l)}
                      labelStyle={{ color: '#0c0a09', fontWeight: 'bold' }}
                    />
                    {/* isAnimationActive=false prevents chart re-animation on every poll refresh */}
                    <Area type="monotone" dataKey="heartRate" stroke="#f97316" strokeWidth={2} fill="url(#colorHr)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Skin temperature area chart — Y-axis fixed at 32–42 °C (physiological range) */}
            <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                <ThermometerSun size={16} className="text-blue-500" /> Skin Temperature Trend
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartLogs}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
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
