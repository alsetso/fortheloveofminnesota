// Toast notification system types and utilities

export type ToastType = 'success' | 'error' | 'loading' | 'info' | 'pro';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  apiCall?: string;
  duration?: number;
  timestamp: number;
}

export interface ToastContextType {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id' | 'timestamp'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastData>) => void;
  clearAll: () => void;
}

// Toast creation utilities
export const createToast = (
  type: ToastType,
  title: string,
  options: {
    message?: string;
    apiCall?: string;
    duration?: number;
  } = {}
): Omit<ToastData, 'id' | 'timestamp'> => ({
  type,
  title,
  message: options.message,
  apiCall: options.apiCall,
  duration: options.duration || (type === 'loading' ? 0 : 2500), // Loading toasts don't auto-dismiss, others auto-dismiss after 2.5s
});

// API call toast helpers
export const createApiToast = {
  loading: (apiCall: string, message?: string) => 
    createToast('loading', 'API Call', { message, apiCall }),
  
  success: (apiCall: string, message?: string) => 
    createToast('success', 'Success', { message, apiCall }),
  
  error: (apiCall: string, message?: string) => 
    createToast('error', 'Error', { message, apiCall }),
  
  info: (apiCall: string, message?: string) => 
    createToast('info', 'Info', { message, apiCall }),
};
