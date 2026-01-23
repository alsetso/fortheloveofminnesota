'use client';

import { useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import { createApiToast, ToastType } from '../services/toast';

export function useToast() {
  const { addToast, removeToast, updateToast, clearAll } = useToastContext();

  // Basic toast methods
  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    return addToast({
      type,
      title,
      message,
      duration: type === 'loading' ? 0 : 2000, // Shorter duration for faster dismissal
    });
  }, [addToast]);

  const success = useCallback((title: string, message?: string) => {
    return toast('success', title, message);
  }, [toast]);

  const error = useCallback((title: string, message?: string) => {
    return toast('error', title, message);
  }, [toast]);

  const loading = useCallback((title: string, message?: string) => {
    return toast('loading', title, message);
  }, [toast]);

  const info = useCallback((title: string, message?: string) => {
    return toast('info', title, message);
  }, [toast]);

  const pro = useCallback((featureName: string) => {
    return toast('pro', `Contributor feature: ${featureName}`, undefined);
  }, [toast]);

  // API-specific toast methods
  const apiToast = useCallback((apiCall: string, message?: string) => {
    return {
      loading: () => addToast(createApiToast.loading(apiCall, message)),
      success: (successMessage?: string) => addToast(createApiToast.success(apiCall, successMessage || message)),
      error: (errorMessage?: string) => addToast(createApiToast.error(apiCall, errorMessage || message)),
      info: (infoMessage?: string) => addToast(createApiToast.info(apiCall, infoMessage || message)),
    };
  }, [addToast]);

  // Async API wrapper with automatic toast management
  const withApiToast = useCallback(async <T>(
    apiCall: string,
    apiFunction: () => Promise<T>,
    options: {
      loadingMessage?: string;
      successMessage?: string;
      errorMessage?: string;
    } = {}
  ): Promise<T> => {
    const toastId = addToast(createApiToast.loading(apiCall, options.loadingMessage));
    
    try {
      const result = await apiFunction();
      
      // Update loading toast to success
      updateToast(toastId, {
        type: 'success',
        title: 'Success',
        message: options.successMessage || `${apiCall} completed successfully`,
        duration: 1500, // Shorter success duration
      });
      
      return result;
    } catch (error) {
      // Update loading toast to error
      updateToast(toastId, {
        type: 'error',
        title: 'Error',
        message: options.errorMessage || `${apiCall} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 3000, // Shorter error duration
      });
      
      throw error;
    }
  }, [addToast, updateToast]);

  return {
    // Basic methods
    toast,
    success,
    error,
    loading,
    info,
    pro,
    
    // API methods
    apiToast,
    withApiToast,
    
    // Utility methods
    remove: removeToast,
    update: updateToast,
    clearAll,
  };
}
