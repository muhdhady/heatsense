'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, User, Smartphone, Briefcase, Hash, Loader2 } from 'lucide-react';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any; // If present, we are in "Edit Mode"
}

export const WorkerModal = ({ isOpen, onClose, initialData }: WorkerModalProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    deviceId: '',
    role: '', // Default empty string since it's now open text
  });

  // Reset or Pre-fill form when modal opens
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        name: initialData.name,
        deviceId: initialData.deviceId,
        role: initialData.role,
      });
    } else {
      setFormData({ id: '', name: '', deviceId: '', role: '' });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const isEditMode = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await fetch('/api/workers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save worker');
      }

      // Success!
      router.refresh(); // Reloads the page data from the server
      onClose();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Error Message */}
        {error && (
          <div className="px-6 py-2 bg-red-50 text-red-600 text-xs font-medium border-b border-red-100">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <User size={14} /> Full Name
            </label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Ali Hassan" 
              // Added text-stone-800
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all text-sm text-stone-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Worker ID (Read-only in Edit Mode to prevent DB issues) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
                <Hash size={14} /> Worker ID
              </label>
              <input 
                required
                type="text" 
                value={formData.id}
                onChange={(e) => setFormData({...formData, id: e.target.value})}
                readOnly={isEditMode}
                placeholder="W-..." 
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none text-sm font-mono ${isEditMode ? 'bg-stone-100 text-stone-500 border-stone-200 cursor-not-allowed' : 'bg-white border-stone-300 focus:ring-2 focus:ring-orange-200 text-stone-800'}`}
              />
            </div>

            {/* Role - Changed to Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
                <Briefcase size={14} /> Role
              </label>
              <input 
                required
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                placeholder="e.g. Welder"
                // Added text-stone-800
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm text-stone-800"
              />
            </div>
          </div>

          {/* Device ID (Now Editable) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              <Smartphone size={14} /> Device Serial (ESP32)
            </label>
            <input 
              required
              type="text" 
              value={formData.deviceId}
              onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
              placeholder="HS-..." 
              // text-stone-800 was already here
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm font-mono"
            />
            <p className="text-[10px] text-orange-600">
              {isEditMode ? "Warning: changing this reassigns the device." : "Enter the serial number printed on the device."}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 font-medium rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-stone-900 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />}
              {isEditMode ? 'Save Changes' : 'Add Worker'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};