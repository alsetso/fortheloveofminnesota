'use client';

import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AtlasTableRecordList from './AtlasTableRecordList';

interface AtlasTableSearchProps {
  tableName: string;
  records: Record<string, any>[];
  isAdmin: boolean;
}

export default function AtlasTableSearch({
  tableName,
  records,
  isAdmin,
}: AtlasTableSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter records based on search query (fuzzy search on name and city_name)
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) {
      return records;
    }

    const query = searchQuery.toLowerCase().trim();
    return records.filter((record) => {
      const nameMatch = record.name?.toLowerCase().includes(query);
      const cityMatch = record.city_name?.toLowerCase().includes(query);
      return nameMatch || cityMatch;
    });
  }, [records, searchQuery]);

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
        />
      </div>
      {searchQuery.trim() && (
        <p className="text-xs text-gray-500">
          Showing {filteredRecords.length} of {records.length} records
        </p>
      )}

      {/* Records List */}
      <AtlasTableRecordList
        tableName={tableName}
        records={filteredRecords}
        isAdmin={isAdmin}
      />
    </div>
  );
}

