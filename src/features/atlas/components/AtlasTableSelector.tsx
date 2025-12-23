'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface AtlasTable {
  id: string;
  name: string;
  icon: string;
}

const ATLAS_TABLES: AtlasTable[] = [
  { id: 'neighborhoods', name: 'Neighborhoods', icon: '🏘️' },
  { id: 'schools', name: 'Schools', icon: '🎓' },
  { id: 'parks', name: 'Parks', icon: '🌳' },
  { id: 'lakes', name: 'Lakes', icon: '💧' },
  { id: 'watertowers', name: 'Watertowers', icon: '🗼' },
  { id: 'cemeteries', name: 'Cemeteries', icon: '🪦' },
  { id: 'golf_courses', name: 'Golf Courses', icon: '⛳' },
  { id: 'hospitals', name: 'Hospitals', icon: '🏥' },
  { id: 'airports', name: 'Airports', icon: '✈️' },
  { id: 'churches', name: 'Churches', icon: '⛪' },
  { id: 'municipals', name: 'Municipals', icon: '🏛️' },
  { id: 'roads', name: 'Roads', icon: '🛣️' },
  { id: 'radio_and_news', name: 'Radio & News', icon: '📻' },
];

interface AtlasTableSelectorProps {
  selectedTables: string[];
  onToggleTable: (tableId: string) => void;
}

export default function AtlasTableSelector({
  selectedTables,
  onToggleTable,
}: AtlasTableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedCount = selectedTables.length;

  return (
    <div ref={dropdownRef} className="relative z-30">
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
      >
        <span className="text-xs">Atlas</span>
        {selectedCount > 0 && (
          <span className="text-[10px] text-gray-500">({selectedCount})</span>
        )}
        {isOpen ? (
          <ChevronUpIcon className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden min-w-[180px] max-h-[400px] overflow-y-auto">
          {ATLAS_TABLES.map((table) => {
            const isSelected = selectedTables.includes(table.id);
            return (
              <label
                key={table.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleTable(table.id)}
                  className="w-3 h-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-xs">{table.icon}</span>
                <span className="text-xs text-gray-900 flex-1">{table.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
