// Modal for creating and editing worker profiles.
//
// Operates in two modes determined by the `initialData` prop:
//   Create mode (initialData = null/undefined) — blank form, "Add Worker" submit button.
//   Edit mode   (initialData = worker object)  — pre-filled form, "Save Changes" button
//                                                 + a delete button that removes the worker.
//
// The parent component (DashboardClient) owns the API calls and submission state.
// This component just renders the form, calls onSave/onDelete, and handles its own
// reset logic when the modal opens or closes.

'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, User, Smartphone, Briefcase, Trash2, Loader2 } from 'lucide-react';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal opens in edit mode pre-filled with this worker's data */
  initialData?: any;
  onSave: (formData: any) => Promise<void>;
  onDelete: (workerId: number) => Promise<void>;
  isSubmitting: boolean;
}

export const WorkerModal = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  onDelete,
  isSubmitting,
}: WorkerModalProps) => {
  const [formData, setFormData] = useState({ name: '', deviceId: '', role: '' });

  // Populate the form with existing data when editing, or reset it for a new entry.
  // The `isOpen` dependency ensures the form resets if the modal is closed and reopened
  // for a different worker without unmounting.
  useEffect(() => {
    if (initialData) {
      setFormData({ name: initialData.name, deviceId: initialData.deviceId, role: initialData.role });
    } else {
      setFormData({ name: '', deviceId: '', role: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditMode = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleDelete = () => {
    if (initialData?.id) onDelete(initialData.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FDFBF7] w-full max-w-md rounded-xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white">
          <h2 className="text-lg font-bold text-stone-800">
            {isEditMode ? 'Edit Worker Profile' : 'Register New Worker'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form className="p-6 space-y-4" onSubmit={handleSubmit}>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <User size={14} /> Full Name
            </label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ali Hassan"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all text-sm text-stone-800"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <Briefcase size={14} /> Role
            </label>
            <input
              required
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g. Welder"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm text-stone-800"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <Smartphone size={14} /> Device Serial (ESP32)
            </label>
            <input
              required
              type="text"
              value={formData.deviceId}
              onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
              placeholder="HS-..."
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm font-mono"
            />
            <p className="text-[10px] text-orange-600">
              {isEditMode
                ? "Warning: changing this reassigns the physical device."
                : "Enter the serial number printed on the device."}
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            {/* Delete button only appears in edit mode */}
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3 py-2 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center"
                title="Remove Worker"
              >
                <Trash2 size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 font-medium rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-stone-900 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isEditMode ? 'Save Changes' : 'Add Worker'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
