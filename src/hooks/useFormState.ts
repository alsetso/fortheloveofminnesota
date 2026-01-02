'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Simple deep equality check for objects
 */
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (typeof obj1[key] === 'object' && obj1[key] !== null) {
      if (!deepEqual(obj1[key], obj2[key])) return false;
    } else if (obj1[key] !== obj2[key]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Shared hook for managing form state with initialization from props
 */
export function useFormState<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData);
  const prevInitialDataRef = useRef<T | null>(null);

  useEffect(() => {
    // Only update if the actual values changed, not just the object reference
    if (!deepEqual(prevInitialDataRef.current, initialData)) {
      prevInitialDataRef.current = initialData;
      setFormData(initialData);
    }
  }, [initialData]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
    prevInitialDataRef.current = initialData;
  }, [initialData]);

  return {
    formData,
    setFormData,
    updateField,
    reset,
  };
}

