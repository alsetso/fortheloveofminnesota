'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type RefObject } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useToast } from '@/features/ui/hooks/useToast';
import { updateCivicFieldWithLogging } from '../utils/civicEditLogger';
import type { CivicTable } from '../utils/permissions';

interface InlineEditFieldProps {
  table: CivicTable;
  recordId: string;
  field: string;
  value: string | null;
  label?: string;
  type?: 'text' | 'textarea' | 'url' | 'email' | 'tel' | 'date';
  accountId: string;
  onUpdate?: () => void;
  className?: string;
  placeholder?: string;
}

export default function InlineEditField({
  table,
  recordId,
  field,
  value,
  label,
  type = 'text',
  accountId,
  onUpdate,
  className = '',
  placeholder,
}: InlineEditFieldProps) {
  const supabase = useSupabaseClient();
  const { success, error: showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'textarea') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleStartEdit = () => {
    setEditValue(value || '');
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const newValue = editValue.trim() || null;
    
    // Don't save if value hasn't changed
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await updateCivicFieldWithLogging({
        table,
        recordId,
        field,
        newValue,
        accountId,
        supabase,
      });

      if (updateError) {
        throw updateError;
      }

      setIsEditing(false);
      const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      success('Updated', `${fieldLabel} saved successfully`);
      onUpdate?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update';
      setError(errorMessage);
      showError('Update failed', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label className="block text-[10px] font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="flex items-start gap-1.5">
          {type === 'textarea' ? (
            <textarea
              ref={inputRef as RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              rows={3}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none disabled:opacity-50"
              placeholder={placeholder}
            />
          ) : (
            <input
              ref={inputRef as RefObject<HTMLInputElement>}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              disabled={saving}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none disabled:opacity-50"
              placeholder={placeholder}
            />
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              <CheckIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
              title="Cancel"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
        {saving && (
          <p className="text-[10px] text-gray-500">Saving...</p>
        )}
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-1.5 ${className}`}>
      <span className="text-xs text-gray-900 flex-1">
        {value || <span className="text-gray-400 italic">(empty)</span>}
      </span>
      <button
        onClick={handleStartEdit}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-all"
        title="Edit"
      >
        <PencilIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

