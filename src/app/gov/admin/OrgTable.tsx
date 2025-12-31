'use client';

import { useMemo } from 'react';
import EditableCell from '@/features/civic/components/EditableCell';
import { useEditableCell } from '@/hooks/useEditableCell';
import type { OrgRecord } from './types';

interface OrgTableProps {
  orgs: OrgRecord[];
  onUpdate: (id: string, field: keyof OrgRecord, value: string | null) => void;
  saving: string | null;
}

export default function OrgTable({ orgs, onUpdate, saving }: OrgTableProps) {
  // Use Map for O(1) lookups
  const orgsMap = useMemo(() => new Map(orgs.map(org => [org.id, org])), [orgs]);

  const {
    editing,
    tempValue,
    setTempValue,
    handleFocus,
    handleBlur,
    handleKeyDown,
  } = useEditableCell({
    onUpdate,
    records: orgs,
    getId: (org) => org.id,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
          <tr>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Type</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Parent ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Description</th>
            <th className="p-1.5 text-left font-semibold text-gray-700">Website</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => (
            <tr key={org.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-1.5 text-gray-500 font-mono text-[10px] border-r border-gray-100">
                {org.id.slice(0, 8)}...
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={org.id}
                  field="name"
                  value={org.name}
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
                  id={org.id}
                  field="slug"
                  value={org.slug}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <select
                  value={org.org_type}
                  onChange={(e) => onUpdate(org.id, 'org_type', e.target.value)}
                  className="w-full bg-transparent border border-transparent hover:border-gray-300 rounded px-1 py-0.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving === org.id}
                >
                  <option value="branch">branch</option>
                  <option value="agency">agency</option>
                  <option value="department">department</option>
                  <option value="court">court</option>
                </select>
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={org.id}
                  field="parent_id"
                  value={org.parent_id}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                  className="text-gray-500 font-mono text-[10px]"
                  placeholder="UUID"
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={org.id}
                  field="description"
                  value={org.description}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                  className="text-gray-600"
                />
              </td>
              <td className="p-1.5">
                <EditableCell
                  id={org.id}
                  field="website"
                  value={org.website}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                  className="text-gray-600"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

