'use client';

import { useState, useEffect } from 'react';
import { CameraIcon, MapIcon, ShareIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function ToolsContent() {
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Use white text when transparent blur + satellite map (same logic as MapTopContainer)
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };

    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  const tools = [
    {
      id: 'screenshot',
      name: 'Screenshot',
      description: 'Capture the current map view',
      icon: CameraIcon,
      action: () => console.log('Screenshot tool'),
    },
    {
      id: 'measure',
      name: 'Measure Distance',
      description: 'Measure distances on the map',
      icon: MapIcon,
      action: () => console.log('Measure tool'),
    },
    {
      id: 'share',
      name: 'Share Location',
      description: 'Share a specific location',
      icon: ShareIcon,
      action: () => console.log('Share tool'),
    },
    {
      id: 'export',
      name: 'Export Data',
      description: 'Export map data',
      icon: ArrowDownTrayIcon,
      action: () => console.log('Export tool'),
    },
  ];

  return (
    <div className="space-y-2 p-2">
      {tools.map((tool) => {
        const IconComponent = tool.icon;
        return (
          <button
            key={tool.id}
            onClick={tool.action}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded transition-colors ${
              useBlurStyle
                ? 'hover:bg-white/10'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className={`p-2 rounded ${
              useBlurStyle
                ? 'bg-white/10'
                : 'bg-gray-100'
            }`}>
              <IconComponent className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-700'}`} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                  {tool.name}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-yellow-500/20 text-yellow-600">
                  Coming Soon
                </span>
              </div>
              <div className={`text-[10px] ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
                {tool.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

