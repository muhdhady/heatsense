'use client';

import React from 'react';
import { X, Save, User, Smartphone, Briefcase, Hash } from 'lucide-react';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any; // If passed, we are in "Edit" mode
}

export const WorkerModal = ({ isOpen, onClose, initialData }: WorkerModalProps) => {
  if (!isOpen) return null;

  const isEditMode = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-[#FDFBF7] w-full max-w-md rounded-xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-white">
          <h2 className="text-lg font-bold text-stone-800">
            {isEditMode ? 'Edit Worker Profile' : 'Register New Worker'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form className="p-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
          
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <User size={14} /> Full Name
            </label>
            <input 
              type="text" 
              defaultValue={initialData?.name}
              placeholder="e.g. Ali Hassan" 
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Worker ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
                <Hash size={14} /> Worker ID
              </label>
              <input 
                type="text" 
                defaultValue={initialData?.id}
                placeholder="W-..." 
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm font-mono"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
                <Briefcase size={14} /> Role
              </label>
              <select className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm">
                <option>Laborer</option>
                <option>Welder</option>
                <option>Supervisor</option>
                <option>Driver</option>
              </select>
            </div>
          </div>

          {/* Device ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <Smartphone size={14} /> Device Serial (ESP32)
            </label>
            <input 
              type="text" 
              defaultValue={initialData?.deviceId}
              placeholder="HS-..." 
              className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-stone-500 focus:outline-none text-sm font-mono cursor-not-allowed"
              readOnly={isEditMode} // Cannot change device ID in edit mode usually
            />
            {isEditMode ? (
              <p className="text-[10px] text-stone-400">Device binding cannot be changed while active.</p>
            ) : (
              <p className="text-[10px] text-orange-600">Enter the serial number printed on the device.</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 font-medium rounded-lg hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-stone-900 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {isEditMode ? 'Save Changes' : 'Add Worker'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};