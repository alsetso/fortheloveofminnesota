'use client';

import { MapPinIcon, PencilIcon, CheckIcon, XMarkIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

interface MapPageDrawingControlsProps {
  isDrawingMode: 'idle' | 'pin' | 'area';
  hasData: boolean;
  dataLogCount: number;
  onStartPin: () => void;
  onStartArea: () => void;
  onStop: () => void;
  onClear: () => void;
  onSaveAndComplete: () => void;
  onOpenDataLog: () => void;
}

export default function MapPageDrawingControls({
  isDrawingMode,
  hasData,
  dataLogCount,
  onStartPin,
  onStartArea,
  onStop,
  onClear,
  onSaveAndComplete,
  onOpenDataLog,
}: MapPageDrawingControlsProps) {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2">
      {isDrawingMode === 'idle' ? (
        <>
          <button
            onClick={onStartPin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
            aria-label="Drop pin"
          >
            <MapPinIcon className="w-4 h-4" />
            <span>Pin</span>
          </button>
          <button
            onClick={onStartArea}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
            aria-label="Draw area"
          >
            <PencilIcon className="w-4 h-4" />
            <span>Area</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-xs font-medium"
            aria-label="Stop drawing"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Stop</span>
          </button>
        </>
      )}
      
      {hasData && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium"
            aria-label="Clear all"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Clear</span>
          </button>
          <button
            onClick={onSaveAndComplete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
            aria-label="Save and complete"
          >
            <CheckIcon className="w-4 h-4" />
            <span>Save & Complete</span>
          </button>
        </>
      )}
      
      {/* Data Log Button - Always visible */}
      <div className="w-px h-6 bg-gray-300" />
      <button
        onClick={onOpenDataLog}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-xs font-medium relative"
        aria-label="Data log"
      >
        <ClipboardDocumentListIcon className="w-4 h-4" />
        <span>Data Log</span>
        {dataLogCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
            {dataLogCount > 9 ? '9+' : dataLogCount}
          </span>
        )}
      </button>
    </div>
  );
}

