'use client';

import React, { useState } from 'react';
import { AlertTriangle, Search, Bell, ThermometerSun, Plus } from 'lucide-react';
import { StatusTable } from '@/components/tables/StatusTable';
import { WorkerModal } from '@/components/ui/WorkerModal';

export default function DashboardClient({ initialData }: { initialData: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Use data passed from the server
  const criticalCount = initialData.filter((w: any) => w.status === 'red').length;
  const isSystemCritical = criticalCount > 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <WorkerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Alert Banner */}
      {isSystemCritical && (
        <div className="w-full bg-red-600 text-white px-4 py-3 shadow-md flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
          <AlertTriangle className="animate-bounce" />
          <span className="font-bold tracking-wide uppercase">
            System Alert: {criticalCount} Worker(s) Approaching Heat Stroke Threshold
          </span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-10">
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
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-stone-900 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden md:inline">Add Worker</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">Active Workforce</h3>
            <div className="text-3xl font-bold text-stone-800">{initialData.length}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1">100% Connectivity</div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm relative overflow-hidden">
            <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">Avg Site Temp</h3>
            <div className="text-3xl font-bold text-stone-800">38.4°C</div>
            <div className="text-xs text-orange-600 font-medium mt-1">+2.1°C vs. Forecast</div>
            <div className="absolute -right-4 -bottom-4 opacity-5">
               <ThermometerSun size={100} />
            </div>
          </div>

          <div className={`p-6 rounded-xl border shadow-sm ${isSystemCritical ? 'bg-red-50 border-red-100' : 'bg-white border-stone-100'}`}>
            <h3 className={`${isSystemCritical ? 'text-red-800' : 'text-stone-500'} text-xs font-bold uppercase tracking-wider mb-2`}>
              Intervention Required
            </h3>
            <div className={`text-3xl font-bold ${isSystemCritical ? 'text-red-600' : 'text-stone-800'}`}>
              {criticalCount}
            </div>
            <div className="text-xs text-stone-500 mt-1">Workers at High Risk</div>
          </div>
        </div>

        <StatusTable data={initialData} />
      
      </main>
    </div>
  );
}