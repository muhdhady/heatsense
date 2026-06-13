// Worker status table rendered on the main dashboard.
//
// Each row represents one registered worker. Clicking a row navigates to that
// worker's detail page. The edit (pencil) button opens the WorkerModal without
// triggering the row navigation (stopPropagation).
//
// Sort order: critical (red) workers always appear at the top so the supervisor
// sees the most urgent cases immediately without scrolling.

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Activity,
  Clock,
  ChevronRight,
  ThermometerSun,
  Pencil,
} from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';

interface StatusTableProps {
  data: any[];
  onEdit: (worker: any) => void;
}

export const StatusTable = ({ data, onEdit }: StatusTableProps) => {
  const router = useRouter();

  // Critical workers surface to the top; unknown statuses are treated as green
  const sortedData = [...data].sort((a, b) => {
    const priority: Record<string, number> = { red: 0, green: 1 };
    return (priority[a.status] ?? 1) - (priority[b.status] ?? 1);
  });

  return (
    <div className="w-full bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#FFFBF5] border-b border-orange-100">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-orange-900/60 uppercase tracking-wider">Worker Details</th>
            <th className="px-6 py-4 text-xs font-bold text-orange-900/60 uppercase tracking-wider text-center">Last Reported</th>
            <th className="px-6 py-4 text-xs font-bold text-orange-900/60 uppercase tracking-wider text-center">Risk Status</th>
            <th className="px-6 py-4 text-xs font-bold text-orange-900/60 uppercase tracking-wider text-right">Last Sync</th>
            <th className="px-6 py-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-stone-400">
                No workers deployed yet. Click "Add Worker" to begin.
              </td>
            </tr>
          ) : (
            sortedData.map((worker) => (
              <tr
                key={worker.id}
                onClick={() => router.push(`/dashboard/${worker.id}`)}
                className="group hover:bg-orange-50/50 transition-colors cursor-pointer"
              >
                {/* Name, numeric ID, and job role */}
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-2.5 rounded-full border",
                      worker.status === 'red'
                        ? "bg-red-50 border-red-100 text-red-600"
                        : "bg-stone-50 border-stone-100 text-stone-500",
                    )}>
                      <User size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-stone-900">{worker.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                          ID: {worker.id}
                        </span>
                        <span className="text-xs text-stone-400">• {worker.role}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Latest vitals snapshot — populated from the most recent HealthLog row */}
                <td className="px-6 py-5 text-center">
                  <div className="inline-flex items-center gap-4 bg-[#FFFBF5] border border-orange-100 px-4 py-2 rounded-lg shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <Activity size={14} className="text-orange-400" />
                      <span className="text-lg font-bold text-stone-700 tracking-widest min-w-[2.5rem] text-right">
                        {worker.currentVitals?.heartRate ? Math.round(worker.currentVitals.heartRate) : '--'}
                      </span>
                      <span className="text-[10px] text-stone-400 uppercase">BPM</span>
                    </div>
                    <div className="w-px h-4 bg-orange-200/50" />
                    <div className="flex items-center gap-1.5">
                      <ThermometerSun size={14} className="text-orange-400" />
                      <span className="text-lg font-bold text-stone-700 tracking-widest min-w-[3rem] text-right">
                        {worker.currentVitals?.skinTemp ? Number(worker.currentVitals.skinTemp).toFixed(1) : '--.-'}
                      </span>
                      <span className="text-[10px] text-stone-400 uppercase">°C</span>
                    </div>
                  </div>
                </td>

                {/* Risk status badge — animates when critical to draw attention */}
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <div className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 border",
                      worker.status === 'red'
                        ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200",
                    )}>
                      <div className={cn("w-2 h-2 rounded-full", worker.status === 'red' ? "bg-red-600" : "bg-emerald-500")} />
                      {worker.status === 'red' ? 'CRITICAL' : 'Safe'}
                    </div>
                  </div>
                </td>

                {/* Last sync time (relative) and device serial number */}
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-stone-500">
                    <Clock size={14} />
                    {/* suppressHydrationWarning: formatTimeAgo output differs between server and client renders */}
                    <span className="text-sm font-medium" suppressHydrationWarning>
                      {formatTimeAgo(worker.lastSeen)}
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-1 flex items-center justify-end gap-1">
                    <span className="font-mono">{worker.deviceId}</span>
                  </div>
                </td>

                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(worker); }}
                      className="p-2 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-all"
                      title="Edit Worker"
                    >
                      <Pencil size={16} />
                    </button>
                    <span className="text-stone-300 group-hover:text-orange-400 transition-colors">
                      <ChevronRight size={20} />
                    </span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
