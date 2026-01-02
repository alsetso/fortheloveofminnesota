'use client';

import { useState, type KeyboardEvent } from 'react';

interface EditableCellProps {
  id: string;
  field: string;
  value: string | null;
  type?: string;
  editing: { id: string; field: string } | null;
  tempValue: string;
  onFocus: (id: string, field: string, currentValue: string | null) => void;
  onBlur: (id: string, field: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, id: string, field: string) => void;
  onTempValueChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export default function EditableCell({
  id,
  field,
  value,
  type = 'text',
  editing,
  tempValue,
  onFocus,
  onBlur,
  onKeyDown,
  onTempValueChange,
  className = '',
  placeholder,
}: EditableCellProps) {
  const isEditing = editing?.id === id && editing.field === field;
  const displayValue = value ?? '';
  const isEmpty = !displayValue || displayValue.trim() === '';

  return isEditing ? (
    <input
      type={type}
      value={tempValue}
      onChange={(e) => onTempValueChange(e.target.value)}
      onBlur={() => onBlur(id, field)}
      onKeyDown={(e) => onKeyDown(e, id, field)}
      className={`w-full bg-blue-50 border border-blue-300 rounded px-1 py-0.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      autoFocus
      placeholder={placeholder}
    />
  ) : (
    <div
      onClick={() => onFocus(id, field, value)}
      className={`cursor-text hover:bg-gray-100 rounded px-1 py-0.5 min-h-[20px] ${className}`}
      title={isEmpty ? 'Click to edit' : displayValue}
    >
      {isEmpty ? <span className="text-gray-400 italic">empty</span> : displayValue}
    </div>
  );
}

