'use client';

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import CreateAtlasDialog from '@/features/atlas/components/CreateAtlasDialog';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { AtlasEntityType } from '@/features/atlas/services/atlasService';

interface AtlasSecondaryContentProps {
  map: MapboxMapInstance | null;
  mapLoaded?: boolean;
}

const ATLAS_TABLES: Array<{ id: AtlasEntityType; label: string; icon: string }> = [
  { id: 'neighborhood', label: 'Neighborhoods', icon: '🏘️' },
  { id: 'school', label: 'Schools', icon: '🎓' },
  { id: 'park', label: 'Parks', icon: '🌳' },
  { id: 'lake', label: 'Lakes', icon: '💧' },
  { id: 'watertower', label: 'Watertowers', icon: '🗼' },
  { id: 'cemetery', label: 'Cemeteries', icon: '🪦' },
  { id: 'golf_course', label: 'Golf Courses', icon: '⛳' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'airport', label: 'Airports', icon: '✈️' },
  { id: 'church', label: 'Churches', icon: '⛪' },
  { id: 'municipal', label: 'Municipals', icon: '🏛️' },
  { id: 'road', label: 'Roads', icon: '🛣️' },
  { id: 'radio_and_news', label: 'Radio & News', icon: '📻' },
];

export default function AtlasSecondaryContent({ map = null, mapLoaded = false }: AtlasSecondaryContentProps) {
  const [selectedTable, setSelectedTable] = useState<AtlasEntityType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateClick = (tableId: AtlasEntityType) => {
    setSelectedTable(tableId);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedTable(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Atlas</h3>
      </div>

      <div className="space-y-2">
        {ATLAS_TABLES.map((table) => (
          <div
            key={table.id}
            className="flex items-center justify-between border border-gray-200 rounded-md p-[10px] bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{table.icon}</span>
              <span className="text-xs text-gray-900">{table.label}</span>
            </div>
            <button
              onClick={() => handleCreateClick(table.id)}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              title={`Create ${table.label}`}
            >
              <PlusIcon className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        ))}
      </div>

      {selectedTable && (
        <CreateAtlasDialog
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          map={map}
          tableName={selectedTable}
        />
      )}
    </div>
  );
}

