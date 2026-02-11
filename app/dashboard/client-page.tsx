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
  CloudSun
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
  
  // --- STATE MANAGEMENT ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isMonitoringStarted, setIsMonitoringStarted] = useState(false);
  const weather = initialWeather;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioDismissed, setIsAudioDismissed] = useState(false);

  // --- SESSION MANAGER ---
  useEffect(() => {
    const wasStarted = sessionStorage.getItem("monitoring_started");
    if (wasStarted === "true") {
      setIsMonitoringStarted(true);
    }
  }, []);

  // --- LIVE DATA TICKER ---
  useEffect(() => {
    if (!isMonitoringStarted) return; 

    const interval = setInterval(() => {
      router.refresh(); 
    }, UI_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router, isMonitoringStarted]);

  // --- METRICS CALCULATIONS ---
  const criticalCount = initialData.filter((w: any) => 
    w.status === 'red' && 
    (Date.now() - new Date(w.lastSeen).getTime() < SIGNAL_TIMEOUT_MS)
  ).length;
  const isSystemCritical = criticalCount > 0;

  const activeMetrics = useMemo(() => {
    const activeCount = initialData.filter(w => 
      // Check if vitals exist (meaning they have sent data) AND they are recent
      w.currentVitals && 
      (Date.now() - new Date(w.lastSeen).getTime()) < SIGNAL_TIMEOUT_MS
    ).length;
    
    return {
      active: activeCount,
      total: initialData.length,
      isFull: activeCount === initialData.length && activeCount > 0
    };
  }, [initialData]);

  // --- AUDIO HANDLER ---
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
          if (e.name !== 'AbortError') console.warn("Audio Playback:", e);
        });
      } else {
        audioRef.current.pause();
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioDismissed(false);
    }
  }, [isSystemCritical, isAudioDismissed, isMonitoringStarted]);

  // --- API HANDLERS ---
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

      toast.success(isEditing ? "Worker updated successfully" : "Worker deployed successfully");
      setIsModalOpen(false);
      router.refresh(); 
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorker = async (workerId: number) => {
    if (!confirm("Are you sure you want to remove this worker? All logs will be permanently deleted.")) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/workers?id=${workerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete worker');
      
      toast.success("Worker removed from system");
      setIsModalOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete worker");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UI ACTIONS ---
  const handleStartMonitoring = async () => {
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {}
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
      
      {/* --- PAUSE OVERLAY --- */}
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

      {/* --- WORKER MODAL --- */}
      <WorkerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingWorker}
        onSave={handleSaveWorker}   
        onDelete={handleDeleteWorker} 
        isSubmitting={isSubmitting} 
      />

      {/* --- ALERT BANNER --- */}
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

      {/* --- HEADER --- */}
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

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Card 1: Active Connections */}
          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
             <div className="flex justify-between items-start mb-2">
                <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Signal size={14} /> Active Connections
                </h3>
                {activeMetrics.isFull && (
                   <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
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
          
          {/* Card 2: Outside Temp */}
          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
               <CloudSun size={14} /> Outside Temp
            </h3>
            <div className="text-3xl font-bold text-stone-800">{weather.temp}°C</div>
            <div className="text-xs text-orange-600 font-medium mt-2">Sharjah, UAE</div>
          </div>

          {/* Card 3: Outside Humidity */}
          <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
               <Droplets size={14} /> Humidity
            </h3>
            <div className="text-3xl font-bold text-stone-800">{weather.humidity}%</div>
            <div className="text-xs text-blue-600 font-medium mt-2">Atmospheric</div>
          </div>

          {/* Card 4: Critical Interventions */}
          <div className={`p-5 rounded-xl border shadow-sm transition-colors duration-300 ${isSystemCritical ? 'bg-red-50 border-red-100' : 'bg-white border-stone-100'}`}>
            <h3 className={`${isSystemCritical ? 'text-red-800' : 'text-stone-500'} text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2`}>
              <AlertTriangle size={14} /> Intervention
            </h3>
            <div className={`text-3xl font-bold ${isSystemCritical ? 'text-red-600' : 'text-stone-800'}`}>
              {criticalCount}
            </div>
            <div className="text-xs text-stone-500 mt-2 font-medium">
              Active High-Risk Cases
            </div>
          </div>
        </div>

        {/* --- WORKER TABLE --- */}
        <StatusTable data={initialData} onEdit={handleEditWorker} />
      </main>
    </div>
  );
}