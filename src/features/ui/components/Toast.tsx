'use client';

import React, { useState, useEffect } from 'react';
import { ToastData } from '../services/toast';
import { useToastContext } from '../contexts/ToastContext';

interface ToastProps {
  toast: ToastData;
}

export function Toast({ toast }: ToastProps) {
  const { removeToast } = useToastContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss for non-loading toasts
  useEffect(() => {
    if (toast.type !== 'loading' && toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(() => removeToast(toast.id), 200);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast.duration, toast.type, toast.id, removeToast]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-500 text-white border-emerald-400';
      case 'error':
        return 'bg-red-500 text-white border-red-400';
      case 'loading':
        return 'bg-gold-500 text-white border-gold-400';
      case 'info':
        return 'bg-slate-500 text-white border-slate-400';
      default:
        return 'bg-slate-500 text-white border-slate-400';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'loading':
        return (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        );
      case 'info':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        relative flex items-center space-x-2 px-3 py-2 rounded-md shadow-lg border
        transition-all duration-200 ease-out transform
        ${getToastStyles()}
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95'}
        ${isLeaving ? 'opacity-0 translate-x-8 scale-95' : ''}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {getIcon()}
      </div>

      {/* Content - Only show the most relevant message */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">
          {toast.message || toast.title}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-0.5 hover:bg-black hover:bg-opacity-10 rounded transition-colors"
      >
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

// Toast Container Component
export function ToastContainer() {
  const { toasts } = useToastContext();

  if (toasts.length === 0) return null;

  // Limit to 3 toasts maximum
  const displayToasts = toasts.slice(-3);

  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 space-y-2 max-w-xs">
      {displayToasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
