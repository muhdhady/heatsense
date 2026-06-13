// Client component — main dashboard (worker overview).
//
// Responsibilities:
//   - Render the KPI cards (active connections, weather, critical count)
//   - Drive the worker status table via StatusTable
//   - Manage the audible alarm lifecycle (unlock → play → dismiss → auto-reset)
//   - Poll for fresh data via router.refresh() while monitoring is active
//   - Open the WorkerModal for creating and editing workers
//
// Data flow:
//   DashboardPage (server) fetches workers + weather → passes as props → this component
//   On each router.refresh() call, Next.js re-runs the server component and
//   streams updated props down without a full page navigation.

'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Plus,
  VolumeX,
  Play,
  ShieldCheck,
  Pause,
  Signal,
  Droplets,
  CloudSun,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusTable } from '@/components/tables/StatusTable';
import { WorkerModal } from '@/components/ui/WorkerModal';
import { SIGNAL_TIMEOUT_MS, SIGNAL_TIMEOUT_MINS, UI_REFRESH_INTERVAL_MS } from '@/lib/constants';

interface DashboardClientProps {
  initialData: any[];
  initialWeather: {
    temp: string;
    humidity: string;
  };
}

export default function DashboardClient({ initialData, initialWeather }: DashboardClientProps) {
  const router = useRouter();

  // Local copy of workers — seeded from the server and kept fresh by polling:
  // router.refresh() re-runs the server component at UI_REFRESH_INTERVAL_MS (and after
  // mutations); the useEffect below syncs the new initialData prop back into this state
  // so the table reflects fresh vitals and any added/edited/deleted workers.
  const [workersData, setWorkersData] = useState(initialData);

  // Sync whenever the server re-runs (triggered by router.refresh() after mutations).
  // Without this, initialData changes are silently discarded because useState only
  // consumes its argument on the very first render.
  useEffect(() => {
    setWorkersData(initialData);
  }, [initialData]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // isMonitoringStarted gates both data polling and the alarm system.
  // The supervisor must explicitly click "Start Monitoring" before any alerts fire.
  const [isMonitoringStarted, setIsMonitoringStarted] = useState(false);
  const weather = initialWeather;

  // audioRef holds the Audio object so we can play/pause it from multiple effects
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioDismissed, setIsAudioDismissed] = useState(false);

  // Restore monitoring state across page navigations within the same browser session.
  // sessionStorage persists until the tab is closed, so navigating to a worker detail
  // page and back doesn't reset the monitoring state.
  //
  // IMPORTANT: audioRef must also be initialised here. The alarm effect guards with
  // `if (!audioRef.current) return`, so if the page reloads with monitoring already
  // active (sessionStorage path), the alarm would be permanently silent for that
  // session unless we create the Audio object here too.
  useEffect(() => {
    if (sessionStorage.getItem("monitoring_started") === "true") {
      const audio = new Audio('/alarm.mp3');
      audio.loop = true;
      audioRef.current = audio;
      setIsMonitoringStarted(true);
    }
  }, []);

  // Poll for new data at the configured interval while monitoring is active.
  // router.refresh() re-runs the server component and streams updated props down
  // without a full page navigation, so the table and KPI cards stay current.
  useEffect(() => {
    if (!isMonitoringStarted) return;

    const interval = setInterval(() => {
      router.refresh();
    }, UI_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isMonitoringStarted, router]);

  // A worker is "critical" only if their status is red AND their last upload was recent.
  // This prevents stale red statuses (e.g. from yesterday) from triggering the alarm.
  const criticalCount = workersData.filter((w: any) =>
    w.status === 'red' &&
    Date.now() - new Date(w.lastSeen).getTime() < SIGNAL_TIMEOUT_MS,
  ).length;
  const isSystemCritical = criticalCount > 0;

  // A worker is "active" if they have sent at least one reading within the timeout window
  const activeMetrics = useMemo(() => {
    const activeCount = workersData.filter(w =>
      w.currentVitals &&
      Date.now() - new Date(w.lastSeen).getTime() < SIGNAL_TIMEOUT_MS,
    ).length;
    return {
      active: activeCount,
      total: workersData.length,
      isFull: activeCount === workersData.length && activeCount > 0,
    };
  }, [workersData]);

  // Alarm logic:
  //   - Play when system is critical and alarm has not been dismissed
  //   - Pause immediately when dismissed
  //   - Reset dismissed state when the system returns to safe (so alarm fires again on next event)
  useEffect(() => {
    if (!audioRef.current) return;

    if (!isMonitoringStarted) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      return;
    }

    if (isSystemCritical) {
      if (!isAudioDismissed) {
        audioRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.warn('[Audio]:', e);
        });
      } else {
        audioRef.current.pause();
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioDismissed(false); // auto-reset so next critical event triggers alarm again
    }
  }, [isSystemCritical, isAudioDismissed, isMonitoringStarted]);

  const handleSaveWorker = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const isEditing = !!editingWorker;
      const method = isEditing ? 'PUT' : 'POST';
      const payload = { ...formData, id: isEditing ? editingWorker.id : undefined };

      const res = await fetch('/api/workers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save worker');

      toast.success(isEditing ? 'Worker updated successfully' : 'Worker deployed successfully');
      setIsModalOpen(false);
      router.refresh(); // post-write: sync the new/updated worker back into the table
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorker = async (workerId: number) => {
    if (!confirm('Are you sure you want to remove this worker? All logs will be permanently deleted.')) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/workers?id=${workerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete worker');
      toast.success('Worker removed from system');
      setIsModalOpen(false);
      router.refresh(); // post-delete: remove the worker row from the table
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete worker');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Browsers block audio autoplay until the user has interacted with the page.
  // We exploit the "Start Monitoring" click to pre-unlock the audio context by
  // immediately playing and pausing a silent instance of the alarm file.
  const handleStartMonitoring = async () => {
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
    audioRef.current = audio;
    setIsMonitoringStarted(true);
    sessionStorage.setItem("monitoring_started", "true");
    toast.info("Real-time monitoring enabled");
  };

  const handleDismissAudio = () => {
    setIsAudioDismissed(true);
    audioRef.current?.pause();
    toast.success("Alarm muted temporarily");
  };

  const handleAddNew = () => {
    setEditingWorker(null);
    setIsModalOpen(true);
  };

  const handleEditWorker = (worker: any) => {
    setEditingWorker(worker);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] relative">

      {/* Monitoring start overlay — blocks the UI until the supervisor explicitly
          starts a session. This ensures the audio context is unlocked before any
          alarm could fire, and makes it clear the system needs human activation. */}
      {!isMonitoringStarted && (
        <div className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in zoom-in-50 duration-300">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Safety Dashboard</h2>
            <p className="text-stone-500 mb-8 text-sm leading-relaxed">
              Monitoring is currently paused. Click below to enable real-time data streaming and audible safety alerts.
            </p>
            <button
              onClick={handleStartMonitoring}
              className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg"
            >
              <Play size={18} fill="currentColor" />
              Start Monitoring
            </button>
          </div>
        </div>
      )}

      <WorkerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingWorker}
        onSave={handleSaveWorker}
        onDelete={handleDeleteWorker}
        isSubmitting={isSubmitting}
      />

      {/* Alert banner — only visible when at least one worker is actively critical */}
      {isSystemCritical && isMonitoringStarted && (
        <div className="w-full bg-red-600 text-white px-4 py-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-3 sticky top-0 z-50 animate-in slide-in-from-top">
          <div className="flex items-center gap-3 justify-center w-full md:w-auto">
            <AlertTriangle className="animate-bounce" />
            <span className="font-bold tracking-wide uppercase text-sm md:text-base text-center">
              System Alert: {criticalCount} Worker(s) Approaching Heat Stroke Threshold
            </span>
          </div>

          {!isAudioDismissed ? (
            <button
              onClick={handleDismissAudio}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors border border-white/30 whitespace-nowrap"
            >
              <VolumeX size={16} />
              Dismiss Alarm
            </button>
          ) : (
            <div className="flex items-center gap-2 opacity-80 text-sm bg-black/20 px-3 py-1 rounded whitespace-nowrap">
              <VolumeX size={16} />
              <span>Alarm Muted</span>
            </div>
          )}
        </div>
      )}

      <header className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-200 shrink-0">
              <span className="text-white font-bold text-xl">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 leading-tight">HeatSense</h1>
              <p className="text-xs text-orange-600 font-medium">Supervisor Control</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                setIsMonitoringStarted(!isMonitoringStarted);
                if (isMonitoringStarted) {
                  sessionStorage.removeItem("monitoring_started");
                  toast.info("Monitoring paused");
                } else {
                  sessionStorage.setItem("monitoring_started", "true");
                  toast.success("Monitoring resumed");
                }
              }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                isMonitoringStarted
                  ? "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
              }`}
            >
              {isMonitoringStarted ? <Pause size={16} /> : <Play size={16} />}
              {isMonitoringStarted ? "Pause" : "Resume"}
            </button>
            <button
              onClick={handleAddNew}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-stone-900 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden md:inline">Add Worker</span>
              <span className="md:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* KPI cards — quick summary metrics at the top of the dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Signal size={14} /> Active Connections
              </h3>
              {activeMetrics.isFull && (
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-stone-900">{activeMetrics.active}</span>
              <span className="text-sm font-medium text-stone-400">/ {activeMetrics.total}</span>
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              Live Monitoring ({SIGNAL_TIMEOUT_MINS}m window)
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <CloudSun size={14} /> Outside Temp
            </h3>
            <div className="text-3xl font-bold text-stone-800">{weather.temp}°C</div>
            <div className="text-xs text-orange-600 font-medium mt-2">Sharjah, UAE</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Droplets size={14} /> Humidity
            </h3>
            <div className="text-3xl font-bold text-stone-800">{weather.humidity}%</div>
            <div className="text-xs text-blue-600 font-medium mt-2">Atmospheric</div>
          </div>

          {/* This card changes colour when any worker is in a critical state */}
          <div className={`p-5 rounded-xl border shadow-sm transition-colors duration-300 ${isSystemCritical ? 'bg-red-50 border-red-100' : 'bg-white border-stone-100'}`}>
            <h3 className={`${isSystemCritical ? 'text-red-800' : 'text-stone-500'} text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2`}>
              <AlertTriangle size={14} /> Intervention
            </h3>
            <div className={`text-3xl font-bold ${isSystemCritical ? 'text-red-600' : 'text-stone-800'}`}>
              {criticalCount}
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">Active High-Risk Cases</div>
          </div>
        </div>

        <StatusTable data={workersData} onEdit={handleEditWorker} />
      </main>
    </div>
  );
}
