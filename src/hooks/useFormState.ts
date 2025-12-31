'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Shared hook for managing form state with initialization from props
 */
export function useFormState<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  return {
    formData,
    setFormData,
    updateField,
    reset,
  };
}

