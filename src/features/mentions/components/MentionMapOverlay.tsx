'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MentionMapOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
}

export default function MentionMapOverlay({ isOpen, onClose, lat, lng }: MentionMapOverlayProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || !mounted) return;

    // Initialize map
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 14,
    });

    mapRef.current = map;

    // Add marker
    const marker = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen, lat, lng, mounted]);

  if (!isOpen || !mounted) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Mention Location</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div ref={mapContainerRef} className="flex-1 w-full" />
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}
