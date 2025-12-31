'use client';

import { useMemo } from 'react';
import EditableCell from '@/features/civic/components/EditableCell';
import { useEditableCell } from '@/hooks/useEditableCell';
import type { RoleRecord } from './types';

interface RoleTableProps {
  roles: RoleRecord[];
  onUpdate: (id: string, field: keyof RoleRecord, value: string | null | boolean) => void;
  saving: string | null;
}

export default function RoleTable({ roles, onUpdate, saving }: RoleTableProps) {
  // Use Map for O(1) lookups
  const rolesMap = useMemo(() => new Map(roles.map(role => [role.id, role])), [roles]);

  const {
    editing,
    tempValue,
    setTempValue,
    handleFocus,
    handleBlur,
    handleKeyDown,
  } = useEditableCell({
    onUpdate: (id, field, value) => onUpdate(id, field, value),
    records: roles,
    getId: (role) => role.id,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
          <tr>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Title</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Person ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Org ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Start Date</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">End Date</th>
            <th className="p-1.5 text-left font-semibold text-gray-700">Current</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-1.5 text-gray-500 font-mono text-[10px] border-r border-gray-100">{role.id.slice(0, 8)}...</td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={role.id}
                  field="title"
                  value={role.title}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={role.id}
                  field="person_id"
                  value={role.person_id}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                  className="text-gray-500 font-mono text-[10px]"
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={role.id}
                  field="org_id"
                  value={role.org_id}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                  className="text-gray-500 font-mono text-[10px]"
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <input
                  type="date"
                  value={role.start_date || ''}
                  onChange={(e) => onUpdate(role.id, 'start_date', e.target.value || null)}
                  className="w-full bg-transparent border border-transparent hover:border-gray-300 rounded px-1 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving === role.id}
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <input
                  type="date"
                  value={role.end_date || ''}
                  onChange={(e) => onUpdate(role.id, 'end_date', e.target.value || null)}
                  className="w-full bg-transparent border border-transparent hover:border-gray-300 rounded px-1 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving === role.id}
                />
              </td>
              <td className="p-1.5">
                <input
                  type="checkbox"
                  checked={role.is_current}
                  onChange={(e) => onUpdate(role.id, 'is_current', e.target.checked)}
                  className="w-3 h-3 cursor-pointer"
                  disabled={saving === role.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

