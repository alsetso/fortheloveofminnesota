'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface AtlasTableRecordListProps {
  tableName: string;
  records: Record<string, any>[];
  isAdmin: boolean;
}

export default function AtlasTableRecordList({
  tableName,
  records,
  isAdmin,
}: AtlasTableRecordListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/admin/atlas/${tableName}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete record' }));
        throw new Error(errorData.error || 'Failed to delete record');
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };



  if (records.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">No records found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {records.map((record, index) => {
        const isEditing = editingId === record.id;
        const isDeleting = deletingId === record.id;

        // Build array of field elements with separators
        // Use record.id with index fallback to ensure uniqueness
        const recordId = record.id || `record-${index}`;
        const fieldElements: React.ReactElement[] = [];
        
        // Add name (as link to detail page)
        if (record.name) {
          fieldElements.push(
            <Link
              key={`${recordId}-name`}
              href={`/explore/atlas/${tableName}/${record.id}`}
              className="text-xs font-semibold text-gray-900 truncate hover:text-gray-700 underline"
            >
              {record.name}
            </Link>
          );
        }

        // Add city name if available
        if (record.city_name) {
          if (fieldElements.length > 0) {
            fieldElements.push(
              <span key={`${recordId}-city-sep`} className="text-gray-300">•</span>
            );
          }
          fieldElements.push(
            <span key={`${recordId}-city`} className="text-xs text-gray-600 truncate">
              {record.city_name}
            </span>
          );
        }

        return (
          <div
            key={recordId}
            className="bg-white rounded-md border border-gray-200 p-[10px] hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                {fieldElements}
              </div>

              {/* Admin Actions - Only visible if accounts.role = 'admin' */}
              {isAdmin === true && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={`/admin/atlas/${tableName}/${record.id}`}
                    className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                    title="Edit record"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => handleDelete(record.id)}
                    disabled={isDeleting}
                    className="p-1 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete record"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

