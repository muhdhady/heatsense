'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'; 
import { AlertTriangle, ThermometerSun, Plus, VolumeX, Play, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { StatusTable } from '@/components/tables/StatusTable';
import { WorkerModal } from '@/components/ui/WorkerModal';
import { SIGNAL_TIMEOUT_MS, SIGNAL_TIMEOUT_MINS, UI_REFRESH_INTERVAL_MS } from '@/lib/constants';

export default function DashboardClient({ initialData }: { initialData: any[] }) {
  const router = useRouter();
  
  // --- STATE MANAGEMENT ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Monitoring State
  const [isMonitoringStarted, setIsMonitoringStarted] = useState(false);

  // --- AUDIO SETUP ---
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
  const criticalCount = initialData.filter((w: any) => w.status === 'red').length;
  const isSystemCritical = criticalCount > 0;

  const activeMetrics = useMemo(() => {
    const activeCount = initialData.filter(w => 
      (Date.now() - new Date(w.lastSeen).getTime()) < SIGNAL_TIMEOUT_MS
    ).length;
    
    return {
      active: activeCount,
      total: initialData.length,
      isFull: activeCount === initialData.length
    };
  }, [initialData]);

  const avgTemp = useMemo(() => {
    const workersWithTemp = initialData.filter(w => w.currentVitals?.skinTemp);
    if (workersWithTemp.length === 0) return '--';
    const total = workersWithTemp.reduce((sum, w) => sum + w.currentVitals.skinTemp, 0);
    return (total / workersWithTemp.length).toFixed(1);
  }, [initialData]);

  // --- AUDIO HANDLER ---
  useEffect(() => {
    if (!isMonitoringStarted || !audioRef.current) return;

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


  // --- API HANDLERS (CRUD) ---

  // 1. SAVE (Create or Update)
  const handleSaveWorker = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const isEditing = !!editingWorker;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        id: isEditing ? editingWorker.id : undefined
      };

      const res = await fetch('/api/workers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save worker');
      }

      // Success Toast
      toast.success(isEditing ? "Worker updated successfully" : "Worker deployed successfully");
      setIsModalOpen(false);
      router.refresh(); 

    } catch (error) {
      // Error Toast
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. DELETE
  const handleDeleteWorker = async (workerId: number) => {
    // SECURITY: We use confirm() here. It blocks the UI until answered.
    if (!confirm("Are you sure you want to remove this worker? All logs will be permanently deleted.")) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/workers?id=${workerId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete worker');
      }

      // Success Toast
      toast.success("Worker removed from system");
      setIsModalOpen(false);
      router.refresh();

    } catch (error) {
      // Error Toast
      toast.error(error instanceof Error ? error.message : "Failed to delete worker");
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- USER INTERFACE ACTIONS ---

  const handleStartMonitoring = async () => {
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {
      // Ignore initial play errors
    }
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
      
      {/* --- START MONITORING OVERLAY --- */}
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

      {/* --- WORKER MODAL (With API Hooks) --- */}
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-200">
              <span className="text-white font-bold text-xl">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 leading-tight">HeatSense</h1>
              <p className="text-xs text-orange-600 font-medium">Supervisor Control</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-stone-900 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden md:inline">Add Worker</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1: Active Workforce */}
          <div 
            className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden group cursor-help"
            title={`Devices are marked inactive if no signal is received for ${SIGNAL_TIMEOUT_MINS} minutes.`}
          >
             <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                      Real-Time Monitoring
                    </h3>
                    <span className="bg-stone-100 text-stone-500 text-[10px] px-1.5 py-0.5 rounded border border-stone-200">
                      {SIGNAL_TIMEOUT_MINS}m Window
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-2" suppressHydrationWarning>
                     <span className="text-3xl font-bold text-stone-900">
                       {activeMetrics.active}
                       <span className="text-stone-400 text-xl font-medium">/{activeMetrics.total}</span>
                     </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2" suppressHydrationWarning>
                    <div className={`relative w-2 h-2 rounded-full flex-shrink-0 ${activeMetrics.isFull ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {activeMetrics.isFull && <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></div>}
                    </div>
                    <span className="text-xs font-medium text-stone-500">
                      {activeMetrics.isFull ? 'Full Coverage' : 'Check Inactive Devices'}
                    </span>
                  </div>
                </div>
             </div>
          </div>
          
          {/* Card 2: Average Temp */}
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">Average Temperature</h3>
            <div className="text-3xl font-bold text-stone-800">{avgTemp}°C</div>
            <div className="text-xs text-orange-600 font-medium mt-1">Real-time Average</div>
            <div className="absolute -right-4 -bottom-4 opacity-5">
               <ThermometerSun size={100} />
            </div>
          </div>

          {/* Card 3: Critical Count */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors duration-300 ${isSystemCritical ? 'bg-red-50 border-red-100' : 'bg-white border-stone-100'}`}>
            <h3 className={`${isSystemCritical ? 'text-red-800' : 'text-stone-500'} text-xs font-bold uppercase tracking-wider mb-2`}>
              Intervention Required
            </h3>
            <div className={`text-3xl font-bold ${isSystemCritical ? 'text-red-600' : 'text-stone-800'}`}>
              {criticalCount}
            </div>
            <div className="text-xs text-stone-500 mt-1">Workers at High Risk</div>
          </div>
        </div>

        {/* --- WORKER TABLE --- */}
        <StatusTable data={initialData} onEdit={handleEditWorker} />
      </main>
    </div>
  );
}