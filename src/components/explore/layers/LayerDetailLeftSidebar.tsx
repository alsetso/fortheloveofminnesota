'use client';

import { useState, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getLayerConfigBySlug } from '@/features/map/config/layersConfig';

interface LayerDetailLeftSidebarProps {
  layerSlug: string;
  /** Record id from /explore/[table]/[slug] path */
  selectedRecordId?: string;
  onRecordSelect?: (record: {
    layer: 'state' | 'county' | 'ctu' | 'district';
    id: string;
    name: string;
    lat: number;
    lng: number;
    details?: Record<string, any>;
  }) => void;
}

interface LayerRecord {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Left Sidebar for Layer Detail Page
 * Shows all records for the layer with search functionality
 */
export default function LayerDetailLeftSidebar({
  layerSlug,
  selectedRecordId,
  onRecordSelect,
}: LayerDetailLeftSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<LayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const layerConfig = useMemo(() => {
    const config = getLayerConfigBySlug(layerSlug);
    if (!config) return null;
    return {
      apiEndpoint: config.apiEndpoint,
      nameField: config.nameField,
      displayName: config.label,
      icon: config.icon,
    };
  }, [layerSlug]);

  // Fetch records
  useEffect(() => {
    if (!layerConfig) return;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        const response = await fetch(layerConfig.apiEndpoint);
        if (response.ok) {
          const data = await response.json();
          // Handle single object (state) vs array
          const recordsList = Array.isArray(data) ? data : [data];
          
          // Transform to LayerRecord format
          const transformed = recordsList.map((record: any) => ({
            id: record.id || record.county_id || record.district_number?.toString() || '',
            name: record[layerConfig.nameField] || record.feature_name || record.county_name || `District ${record.district_number}` || 'Unknown',
            ...record,
          }));

          // Sort by name
          transformed.sort((a, b) => {
            const nameA = String(a.name || '').toLowerCase();
            const nameB = String(b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          setRecords(transformed);
        }
      } catch (error) {
        console.error('Error fetching layer records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [layerConfig]);

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    
    const query = searchQuery.toLowerCase();
    return records.filter((record) => {
      const name = String(record.name || '').toLowerCase();
      // Also search in county_name for cities
      const countyName = String(record.county_name || '').toLowerCase();
      return name.includes(query) || countyName.includes(query);
    });
  }, [records, searchQuery]);

  const handleRecordClick = (record: LayerRecord) => {
    const layerType =
      layerSlug === 'state' ? 'state' : layerSlug === 'counties' ? 'county' : layerSlug === 'cities-and-towns' ? 'ctu' : 'district';
    onRecordSelect?.({
      layer: layerType,
      id: record.id,
      name: record.name || 'Unknown',
      lat: 0,
      lng: 0,
    });
  };

  if (!layerConfig) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-xs text-foreground-muted">Invalid layer</div>
      </div>
    );
  }

  const Icon = layerConfig.icon;

  return (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-lake-blue" />
          <h2 className="text-sm font-semibold text-foreground">{layerConfig.displayName}</h2>
        </div>
        <p className="text-[10px] text-foreground-muted">{records.length.toLocaleString()} total</p>
      </div>

      {/* Search */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 px-3 pl-9 bg-surface-accent rounded-lg text-xs text-foreground placeholder:text-foreground-muted border-none focus:outline-none focus:ring-2 focus:ring-lake-blue"
          />
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        </div>
      </div>

      {/* Records List */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="p-[10px]">
            <div className="text-xs text-foreground-muted">Loading...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-[10px]">
            <div className="text-xs text-foreground-muted">
              {searchQuery ? 'No results found' : 'No records available'}
            </div>
          </div>
        ) : (
          <div className="p-[10px] space-y-0.5">
            {filteredRecords.map((record) => {
              const isSelected = selectedRecordId === record.id;
              const displayName = record.name || 'Unknown';
              const countyName = record.county_name;
              
              return (
                <button
                  key={record.id}
                  onClick={() => handleRecordClick(record)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                    isSelected
                      ? 'bg-lake-blue/20 text-foreground border border-lake-blue/40'
                      : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                  }`}
                >
                  <div className="font-medium truncate">{displayName}</div>
                  {countyName && (
                    <div className="text-[10px] text-foreground-subtle truncate">{countyName}</div>
                  )}
                  {record.ctu_class && (
                    <div className="text-[10px] text-foreground-subtle truncate">{record.ctu_class}</div>
                  )}
                  {record.population && (
                    <div className="text-[10px] text-foreground-subtle">
                      {record.population.toLocaleString()} people
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
