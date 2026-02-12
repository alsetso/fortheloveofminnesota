/**
 * Data formatting utilities for admin database viewer
 * Formats various data types for better readability
 */

export function formatCellValue(value: any, columnName?: string): string {
  if (value === null || value === undefined) {
    return '—';
  }

  // Handle objects (JSONB)
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  // Handle strings
  if (typeof value === 'string') {
    // Check if it's a UUID
    if (isUUID(value)) {
      return value;
    }

    // Check if it's a URL
    if (isURL(value)) {
      return value;
    }

    // Check if it's a date string
    if (isDateString(value)) {
      return formatDate(value);
    }

    // Check if it's a boolean string
    if (value === 'true' || value === 'false') {
      return value;
    }

    return value;
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Handle numbers
  if (typeof value === 'number') {
    // Check if it's a timestamp (milliseconds or seconds)
    if (columnName?.includes('timestamp') || columnName?.includes('created_at') || columnName?.includes('updated_at')) {
      const date = new Date(value > 1000000000000 ? value : value * 1000);
      if (!isNaN(date.getTime())) {
        return formatDate(date.toISOString());
      }
    }
    return value.toString();
  }

  return String(value);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // Format as: YYYY-MM-DD HH:MM:SS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateString;
  }
}

export function formatJSON(value: any): string {
  try {
    if (typeof value === 'string') {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isDateString(value: string): boolean {
  // Check for ISO date strings or common date formats
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
  if (dateRegex.test(value)) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

export function getColumnType(value: any, columnName?: string): 'text' | 'number' | 'boolean' | 'date' | 'uuid' | 'url' | 'json' | 'null' {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    if (columnName?.includes('timestamp') || columnName?.includes('created_at') || columnName?.includes('updated_at')) {
      return 'date';
    }
    return 'number';
  }

  if (typeof value === 'string') {
    if (isUUID(value)) {
      return 'uuid';
    }
    if (isURL(value)) {
      return 'url';
    }
    if (isDateString(value)) {
      return 'date';
    }
    return 'text';
  }

  if (typeof value === 'object') {
    return 'json';
  }

  return 'text';
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}
