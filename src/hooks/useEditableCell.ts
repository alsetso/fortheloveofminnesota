'use client';

import { useState, useCallback } from 'react';

interface UseEditableCellOptions<T> {
  onUpdate: (id: string, field: keyof T, value: string | null) => void;
  records: T[];
  getId: (record: T) => string;
}

/**
 * Shared hook for managing editable cell state in admin tables
 */
export function useEditableCell<T extends Record<string, any>>({
  onUpdate,
  records,
  getId,
}: UseEditableCellOptions<T>) {
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleFocus = useCallback((id: string, field: string, currentValue: string | null) => {
    setEditing({ id, field });
    setTempValue(currentValue || '');
  }, []);

  const handleBlur = useCallback((id: string, field: keyof T) => {
    if (editing && editing.id === id && editing.field === field) {
      const finalValue = tempValue.trim() || null;
      const currentRecord = records.find(r => getId(r) === id);
      if (currentRecord && finalValue !== (currentRecord[field] || null)) {
        onUpdate(id, field, finalValue);
      }
      setEditing(null);
    }
  }, [editing, tempValue, records, getId, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, id: string, field: keyof T) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditing(null);
      setTempValue('');
    }
  }, []);

  return {
    editing,
    tempValue,
    setTempValue,
    handleFocus,
    handleBlur,
    handleKeyDown,
  };
}

