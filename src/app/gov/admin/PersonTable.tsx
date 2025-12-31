'use client';

import { useMemo } from 'react';
import EditableCell from '@/features/civic/components/EditableCell';
import ImageUpload from '@/features/civic/components/ImageUpload';
import { useEditableCell } from '@/hooks/useEditableCell';
import type { PersonRecord } from './types';

interface PersonTableProps {
  people: PersonRecord[];
  onUpdate: (id: string, field: keyof PersonRecord, value: string | null | boolean) => void;
  saving: string | null;
}

export default function PersonTable({ people, onUpdate, saving }: PersonTableProps) {
  // Use Map for O(1) lookups
  const peopleMap = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);

  const {
    editing,
    tempValue,
    setTempValue,
    handleFocus,
    handleBlur,
    handleKeyDown,
  } = useEditableCell({
    onUpdate: (id, field, value) => onUpdate(id, field, value),
    records: people,
    getId: (person) => person.id,
  });

  const handleImageUpload = async (personId: string, url: string) => {
    onUpdate(personId, 'photo_url', url);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
          <tr>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">ID</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Photo</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Party</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">District</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Email</th>
            <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Phone</th>
            <th className="p-1.5 text-left font-semibold text-gray-700">Address</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-1.5 text-gray-500 font-mono text-[10px] border-r border-gray-100">{person.id.slice(0, 8)}...</td>
              <td className="p-1.5 border-r border-gray-100">
                <ImageUpload
                  currentUrl={person.photo_url}
                  pathPrefix={person.id}
                  onUpload={(url) => handleImageUpload(person.id, url)}
                  onError={(err) => {
                    alert(`Failed to upload image: ${err.message}`);
                  }}
                  size="sm"
                />
              </td>
              <td className="p-1.5 border-r border-gray-100">
                <EditableCell
                  id={person.id}
                  field="name"
                  value={person.name}
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
                  id={person.id}
                  field="slug"
                  value={person.slug}
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
                  id={person.id}
                  field="party"
                  value={person.party}
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
                  id={person.id}
                  field="district"
                  value={person.district}
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
                  id={person.id}
                  field="email"
                  value={person.email}
                  type="email"
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
                  id={person.id}
                  field="phone"
                  value={person.phone}
                  type="tel"
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                />
              </td>
              <td className="p-1.5">
                <EditableCell
                  id={person.id}
                  field="address"
                  value={person.address}
                  editing={editing}
                  tempValue={tempValue}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onTempValueChange={setTempValue}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

