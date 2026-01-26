'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XMarkIcon, MapPinIcon, PencilSquareIcon, TrashIcon, PencilIcon, CheckIcon, CameraIcon, Squares2X2Icon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import EmojiPicker from './EmojiPicker';
import { useMapboxMap } from '../hooks/useMapboxMap';
import { MAP_CONFIG } from '@/features/map/config';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface MapArea {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  created_at: string;
  updated_at: string;
}

interface MapLayerPolygon {
  layerId: string;
  title: string;
  subtitle?: string | null;
  properties: Record<string, unknown>;
  geometryType?: string | null;
  geometry?: GeoJSON.Geometry | GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

type MapEntityType = 'pin' | 'area' | 'layer';
type MapEntity = MapPin | MapArea | MapLayerPolygon;

interface MapEntitySlideUpProps {
  isOpen: boolean;
  onClose: () => void;
  entity: MapEntity | null;
  entityType: MapEntityType | null;
  isOwner: boolean;
  mapId: string;
  onEntityDeleted?: () => void;
  onEntityUpdated?: (updatedEntity: MapPin | MapArea) => void;
  visibility?: 'public' | 'private' | 'shared';
}

export default function MapEntitySlideUp({
  isOpen,
  onClose,
  entity,
  entityType,
  isOwner,
  mapId,
  onEntityDeleted,
  onEntityUpdated,
  visibility = 'private',
}: MapEntitySlideUpProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToastContext();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const entityMapContainer = useRef<HTMLDivElement>(null);
  const [entityMapLoaded, setEntityMapLoaded] = useState(false);
  const entityMapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<MapPin>>({});
  const [showLatLngEdit, setShowLatLngEdit] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states when modal closes or entity changes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setIsEditing(false);
      setShowLatLngEdit(false);
      setEditData({});
      setShowEmojiPicker(false);
      setShowEmojiInput(false);
    } else if (entity && entityType === 'pin') {
      // Initialize edit data with current pin values
      const pin = entity as MapPin;
      setEditData({
        emoji: pin.emoji || '',
        caption: pin.caption || '',
        image_url: pin.image_url || '',
        video_url: pin.video_url || '',
        lat: pin.lat,
        lng: pin.lng,
      });
    }
  }, [isOpen, entity, entityType]);

  const handleDelete = async () => {
    if (!entity || !showDeleteConfirm || entityType === 'layer') return;

    setIsDeleting(true);
    try {
      const endpoint = entityType === 'pin' 
        ? `/api/maps/${mapId}/pins/${(entity as any).id}`
        : `/api/maps/${mapId}/areas/${(entity as any).id}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      if (onEntityDeleted) {
        onEntityDeleted();
      }
      onClose();
      addToast(createToast('success', 'Entity deleted successfully', {
        duration: 3000,
      }));
    } catch (err) {
      addToast(createToast('error', 'Failed to delete. Please try again.', {
        duration: 4000,
      }));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!entity || entityType !== 'pin' || !isOwner) return;

    setIsSaving(true);
    try {
      const pin = entity as MapPin;
      const updatePayload: any = {};

      if (editData.emoji !== undefined) {
        updatePayload.emoji = editData.emoji?.trim() || null;
      }
      if (editData.caption !== undefined) {
        updatePayload.caption = editData.caption?.trim() || null;
      }
      if (editData.image_url !== undefined) {
        updatePayload.image_url = editData.image_url?.trim() || null;
      }
      if (editData.video_url !== undefined) {
        updatePayload.video_url = editData.video_url?.trim() || null;
      }
      if (showLatLngEdit && editData.lat !== undefined && editData.lng !== undefined) {
        updatePayload.lat = parseFloat(editData.lat.toString());
        updatePayload.lng = parseFloat(editData.lng.toString());
      }

      const response = await fetch(`/api/maps/${mapId}/pins/${pin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update pin');
      }

      const updatedPin = await response.json();
      if (onEntityUpdated) {
        onEntityUpdated(updatedPin);
      }
      setIsEditing(false);
      setShowLatLngEdit(false);
      setShowEmojiPicker(false);
      setShowEmojiInput(false);
      addToast(createToast('success', 'Pin updated successfully', {
        duration: 3000,
      }));
    } catch (err) {
      addToast(createToast('error', err instanceof Error ? err.message : 'Failed to save. Please try again.', {
        duration: 4000,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!entity || entityType !== 'pin' || !isOwner) return;

    setIsUploading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Please sign in to upload media');
      }

      const pin = entity as MapPin;
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) {
        throw new Error('Please select a valid image or video file');
      }

      // Determine bucket and validate file size
      const bucket = isVideo ? 'user-map-video-storage' : 'user-map-image-storage';
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for video, 10MB for image

      if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        throw new Error(`File exceeds maximum size of ${maxSizeMB}MB`);
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${user.id}/map-pins/${pin.id}/${timestamp}-${random}.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get URL for uploaded file');
      }

      // Update edit data
      if (isVideo) {
        setEditData(prev => ({ ...prev, video_url: urlData.publicUrl, image_url: null }));
      } else {
        setEditData(prev => ({ ...prev, image_url: urlData.publicUrl, video_url: null }));
      }

      // Auto-save if in edit mode
      if (isEditing) {
        const updatePayload: any = {
          [isVideo ? 'video_url' : 'image_url']: urlData.publicUrl,
          [isVideo ? 'image_url' : 'video_url']: null,
        };

        const response = await fetch(`/api/maps/${mapId}/pins/${pin.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        if (response.ok) {
          const updatedPin = await response.json();
          if (onEntityUpdated) {
            onEntityUpdated(updatedPin);
          }
        }
      }
      addToast(createToast('success', 'File uploaded successfully', {
        duration: 3000,
      }));
    } catch (err) {
      addToast(createToast('error', err instanceof Error ? err.message : 'Failed to upload file. Please try again.', {
        duration: 4000,
      }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Compute entity variables before early return (needed for useEffect dependencies)
  const isPin = entityType === 'pin';
  const isLayer = entityType === 'layer';
  const pin = isPin && entity ? (entity as MapPin) : null;
  const area = !isPin && !isLayer && entity ? (entity as MapArea) : null;
  const layer = isLayer && entity ? (entity as MapLayerPolygon) : null;

  const layerProperties = layer?.properties ? Object.entries(layer.properties) : [];
  const displayLayerProps = layerProperties
    .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, 16);

  // Update URL when entity is selected
  useEffect(() => {
    if (isOpen && entity) {
      const params = new URLSearchParams(searchParams.toString());
      if (entityType === 'pin' && pin) {
        params.set('entity', 'pin');
        params.set('entityId', pin.id);
      } else if (entityType === 'area' && area) {
        params.set('entity', 'area');
        params.set('entityId', area.id);
      } else if (entityType === 'layer' && layer) {
        params.set('entity', 'layer');
        params.set('entityId', layer.layerId || '');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    } else if (!isOpen) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('entity');
      params.delete('entityId');
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [isOpen, entity, entityType, pin, area, layer, router, searchParams]);

  // Initialize mapbox map for entity display
  useEffect(() => {
    if (!isOpen || !entity || !entityMapContainer.current) return;

    let mounted = true;

    const initEntityMap = async () => {
      if (!MAP_CONFIG.MAPBOX_TOKEN || !entityMapContainer.current || !mounted) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!entityMapContainer.current || !mounted) return;

        // Determine center and zoom based on entity type
        let center: [number, number] = MAP_CONFIG.DEFAULT_CENTER;
        let zoom: number = MAP_CONFIG.DEFAULT_ZOOM;

        if (isPin && pin) {
          center = [pin.lng, pin.lat];
          zoom = 15;
        } else if (area && area.geometry) {
          // Calculate center from area geometry
          const coords = area.geometry.type === 'Polygon' 
            ? area.geometry.coordinates[0]
            : area.geometry.coordinates[0][0];
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          center = [centerLng, centerLat];
          zoom = 12;
        } else if (layer && layer.geometry) {
          // Calculate center from layer geometry
          if (layer.geometry.type === 'Point') {
            const coords = (layer.geometry as GeoJSON.Point).coordinates;
            center = [coords[0], coords[1]];
            zoom = 15;
          } else if (layer.geometry.type === 'Polygon') {
            const coords = (layer.geometry as GeoJSON.Polygon).coordinates[0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            center = [centerLng, centerLat];
            zoom = 12;
          } else if (layer.geometry.type === 'MultiPolygon') {
            const coords = (layer.geometry as GeoJSON.MultiPolygon).coordinates[0][0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            center = [centerLng, centerLat];
            zoom = 12;
          }
        }

        const mapInstance = new mapbox.Map({
          container: entityMapContainer.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center,
          zoom,
          pitch: 60,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        entityMapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (!mounted) return;
          setEntityMapLoaded(true);

          const mapboxMap = mapInstance as any;

          // Add entity to map
          if (isPin && pin) {
            // Add pin point
            mapboxMap.addSource('entity-pin-source', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [pin.lng, pin.lat],
                },
                properties: { id: pin.id },
              },
            });

            mapboxMap.addLayer({
              id: 'entity-pin-layer',
              type: 'circle',
              source: 'entity-pin-source',
              paint: {
                'circle-radius': 8,
                'circle-color': '#ef4444',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            });

            mapboxMap.flyTo({ center: [pin.lng, pin.lat], zoom: 15, duration: 1000 });
          } else if (area && area.geometry) {
            // Add area polygon
            mapboxMap.addSource('entity-area-source', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: area.geometry,
                properties: { id: area.id },
              },
            });

            mapboxMap.addLayer({
              id: 'entity-area-fill',
              type: 'fill',
              source: 'entity-area-source',
              paint: {
                'fill-color': '#10b981',
                'fill-opacity': 0.3,
              },
            });

            mapboxMap.addLayer({
              id: 'entity-area-outline',
              type: 'line',
              source: 'entity-area-source',
              paint: {
                'line-color': '#10b981',
                'line-width': 2,
              },
            });

            // Fit bounds to area
            const coords = area.geometry.type === 'Polygon' 
              ? area.geometry.coordinates[0]
              : area.geometry.coordinates[0][0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const bounds: [[number, number], [number, number]] = [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ];
            mapboxMap.fitBounds(bounds, { padding: 20, duration: 1000 });
          } else if (layer && layer.geometry) {
            // For layers, use geometry directly from layer entity
            const geometry = layer.geometry;
            mapboxMap.addSource('entity-layer-source', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry,
                properties: layer.properties,
              },
            });

            if (geometry.type === 'Point') {
              mapboxMap.addLayer({
                id: 'entity-layer-point',
                type: 'circle',
                source: 'entity-layer-source',
                paint: {
                  'circle-radius': 8,
                  'circle-color': '#3b82f6',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#ffffff',
                },
              });
              const coords = (geometry as GeoJSON.Point).coordinates;
              mapboxMap.flyTo({ center: [coords[0], coords[1]], zoom: 15, duration: 1000 });
            } else if (geometry.type === 'Polygon') {
              mapboxMap.addLayer({
                id: 'entity-layer-fill',
                type: 'fill',
                source: 'entity-layer-source',
                paint: {
                  'fill-color': '#3b82f6',
                  'fill-opacity': 0.3,
                },
              });
              mapboxMap.addLayer({
                id: 'entity-layer-outline',
                type: 'line',
                source: 'entity-layer-source',
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 2,
                },
              });
              const coords = (geometry as GeoJSON.Polygon).coordinates[0];
              const lngs = coords.map((c: number[]) => c[0]);
              const lats = coords.map((c: number[]) => c[1]);
              const bounds: [[number, number], [number, number]] = [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ];
              mapboxMap.fitBounds(bounds, { padding: 20, duration: 1000 });
            } else if (geometry.type === 'MultiPolygon') {
              mapboxMap.addLayer({
                id: 'entity-layer-fill',
                type: 'fill',
                source: 'entity-layer-source',
                paint: {
                  'fill-color': '#3b82f6',
                  'fill-opacity': 0.3,
                },
              });
              mapboxMap.addLayer({
                id: 'entity-layer-outline',
                type: 'line',
                source: 'entity-layer-source',
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 2,
                },
              });
              const coords = (geometry as GeoJSON.MultiPolygon).coordinates[0][0];
              const lngs = coords.map((c: number[]) => c[0]);
              const lats = coords.map((c: number[]) => c[1]);
              const bounds: [[number, number], [number, number]] = [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ];
              mapboxMap.fitBounds(bounds, { padding: 20, duration: 1000 });
            }
          }
        });
      } catch (err) {
        console.error('Failed to initialize entity map:', err);
      }
    };

    initEntityMap();

    return () => {
      mounted = false;
      if (entityMapInstanceRef.current) {
        try {
          if (!(entityMapInstanceRef.current as any).removed) {
            entityMapInstanceRef.current.remove();
          }
        } catch {
          // Ignore cleanup errors
        }
        entityMapInstanceRef.current = null;
      }
      setEntityMapLoaded(false);
    };
  }, [isOpen, entity, entityType, pin, area, layer, isPin]);

  // On public maps, cover full map area; otherwise use bottom sheet
  const isPublicMap = visibility === 'public';
  const containerClass = isPublicMap
    ? `absolute inset-0 z-[100] transition-opacity duration-300 ease-out flex items-center justify-center ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`
    : `fixed bottom-0 left-1/2 -translate-x-1/2 z-[100] bg-white shadow-lg transition-transform duration-300 ease-out max-w-[800px] ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`;

  const contentStyle = isPublicMap
    ? undefined
    : { maxHeight: '80vh', maxWidth: '800px', width: '100%', borderRadius: '8px 8px 0 0' };

  if (!isOpen || !entity || !entityType) return null;

  return (
    <>
      {/* Slide-up Panel */}
      <div className={containerClass} style={isPublicMap ? undefined : contentStyle}>
        {isPublicMap ? (
          <div className="w-full max-w-[800px] h-full bg-white flex flex-col shadow-lg rounded-t-lg" style={{ borderRadius: '8px 8px 0 0' }}>
            {/* Header */}
            <div className="flex items-center px-[10px] py-[10px] border-b border-gray-200 sticky top-0 bg-white z-10">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          {/* Centered Title */}
          <div className="flex-1 text-center">
            <h3 className="text-xs font-semibold text-gray-900 truncate px-2">
              {isPin && pin
                ? pin.caption || 'Pin'
                : isLayer && layer
                ? layer.title || 'Layer'
                : area
                ? area.name || 'Area'
                : 'Details'}
            </h3>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div 
          className={`overflow-y-auto px-[10px] py-3 space-y-3 ${isPublicMap ? 'flex flex-col' : ''} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
          style={isPublicMap 
            ? { height: 'calc(100% - 60px)' } 
            : { maxHeight: 'calc(80vh - 80px)' }
          }
        >
          {/* Mapbox Map - Show entity on map */}
          <div className="w-full max-h-[400px] rounded-md overflow-hidden border border-gray-200 mb-3 flex-shrink-0 relative" style={{ height: '400px' }}>
            <div 
              ref={entityMapContainer}
              className="w-full h-full"
              style={{ minHeight: 0 }}
            />
            {!entityMapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <div className="text-center">
                  <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div className="text-gray-600 text-xs">Loading map...</div>
                </div>
              </div>
            )}
          </div>
          {/* Pin Content */}
          {isPin && pin && (
            <>
              {/* Emoji - Compact with click to edit */}
              <div className="relative">
                {isEditing && isOwner ? (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      {showEmojiInput ? (
                        <input
                          type="text"
                          value={editData.emoji || ''}
                          onChange={(e) => setEditData(prev => ({ ...prev, emoji: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded-md text-xl text-center focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                          placeholder="📍"
                          maxLength={2}
                          disabled={isSaving}
                          onBlur={() => setShowEmojiInput(false)}
                          autoFocus
                        />
                      ) : (
                        <button
                          ref={emojiButtonRef}
                          type="button"
                          onClick={() => {
                            setShowEmojiPicker(!showEmojiPicker);
                            setShowEmojiInput(false);
                          }}
                          className="w-full px-2 py-1.5 rounded-md text-xl text-center hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                          disabled={isSaving}
                        >
                          <span>{editData.emoji || pin.emoji || '📍'}</span>
                          <span className="text-[10px] text-gray-400">Click to change</span>
                        </button>
                      )}
                      {showEmojiPicker && (
                        <div className="absolute top-full left-0 mt-1 z-50">
                          <EmojiPicker
                            isOpen={showEmojiPicker}
                            onClose={() => setShowEmojiPicker(false)}
                            onSelect={(emoji) => {
                              setEditData(prev => ({ ...prev, emoji }));
                              setShowEmojiPicker(false);
                            }}
                            triggerRef={emojiButtonRef as React.RefObject<HTMLElement>}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiInput(!showEmojiInput);
                        setShowEmojiPicker(false);
                      }}
                      className="px-2 py-1.5 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      disabled={isSaving}
                    >
                      {showEmojiInput ? 'Picker' : 'Text'}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="text-2xl">{pin.emoji || '📍'}</div>
                  </div>
                )}
              </div>

              {/* Caption - No border */}
              <div>
                {isEditing && isOwner ? (
                  <textarea
                    value={editData.caption || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, caption: e.target.value }))}
                    className="w-full px-[10px] py-[10px] rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 transition-colors resize-none bg-gray-50 focus:bg-white"
                    placeholder="Add a caption..."
                    rows={3}
                    disabled={isSaving}
                  />
                ) : (
                  <div className="text-xs text-gray-900 px-[10px]">{pin.caption || <span className="text-gray-400">No caption</span>}</div>
                )}
              </div>

              {/* Media - Image/Video with Camera Upload */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-[10px] font-medium text-gray-500">Media</div>
                  {isEditing && isOwner && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving || isUploading}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
                    >
                      <CameraIcon className="w-3 h-3" />
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isSaving || isUploading}
                />
                {isEditing && isOwner ? (
                  <div className="space-y-2">
                    {(editData.image_url || pin.image_url) && (
                      <div className="relative w-full h-48 rounded-md overflow-hidden border border-gray-200">
                        <Image
                          src={editData.image_url || pin.image_url || ''}
                          alt={editData.caption || pin.caption || 'Pin image'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {editData.image_url && (
                          <button
                            type="button"
                            onClick={() => setEditData(prev => ({ ...prev, image_url: null }))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            disabled={isSaving}
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {(editData.video_url || pin.video_url) && (
                      <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
                        <video
                          src={editData.video_url || pin.video_url || ''}
                          controls
                          className="w-full"
                        />
                        {editData.video_url && (
                          <button
                            type="button"
                            onClick={() => setEditData(prev => ({ ...prev, video_url: null }))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            disabled={isSaving}
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {!editData.image_url && !editData.video_url && !pin.image_url && !pin.video_url && (
                      <div className="text-xs text-gray-400 px-[10px]">No media</div>
                    )}
                  </div>
                ) : (
                  <>
                    {pin.image_url ? (
                      <div className="relative w-full h-48 rounded-md overflow-hidden border border-gray-200">
                        <Image
                          src={pin.image_url}
                          alt={pin.caption || 'Pin image'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : pin.video_url ? (
                      <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
                        <video
                          src={pin.video_url}
                          controls
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 px-[10px]">No media</div>
                    )}
                  </>
                )}
              </div>

              {/* Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-[10px] font-medium text-gray-500">Coordinates</div>
                  {isOwner && !isEditing && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowLatLngEdit(true);
                      }}
                      className="text-[10px] text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {isEditing && isOwner && showLatLngEdit ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 mb-0.5">Latitude</div>
                      <input
                        type="number"
                        step="any"
                        value={editData.lat?.toString() || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 mb-0.5">Longitude</div>
                      <input
                        type="number"
                        step="any"
                        value={editData.lng?.toString() || ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 mb-0.5">Latitude</div>
                      <div className="text-gray-900">{pin.lat.toFixed(6)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 mb-0.5">Longitude</div>
                      <div className="text-gray-900">{pin.lng.toFixed(6)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {pin.created_at && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Created</div>
                    <div className="text-gray-600">
                      {new Date(pin.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {pin.updated_at && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Updated</div>
                    <div className="text-gray-600">
                      {new Date(pin.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Area Content */}
          {!isPin && area && (
            <>
              {/* Name */}
              <div>
                <div className="text-[10px] font-medium text-gray-500 mb-0.5">Name</div>
                <div className="text-xs font-semibold text-gray-900">{area.name}</div>
              </div>

              {/* Description */}
              {area.description && (
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-0.5">Description</div>
                  <div className="text-xs text-gray-900">{area.description}</div>
                </div>
              )}

              {/* Geometry Type */}
              <div>
                <div className="text-[10px] font-medium text-gray-500 mb-0.5">Type</div>
                <div className="text-xs text-gray-900 capitalize">{area.geometry.type}</div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {area.created_at && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Created</div>
                    <div className="text-gray-600">
                      {new Date(area.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {area.updated_at && (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Updated</div>
                    <div className="text-gray-600">
                      {new Date(area.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Layer Polygon Content */}
          {isLayer && layer && (
            <>
              <div>
                <div className="text-[10px] font-medium text-gray-500 mb-0.5">Layer</div>
                <div className="text-xs font-semibold text-gray-900">{layer.title}</div>
                {layer.subtitle ? (
                  <div className="text-[10px] text-gray-500 mt-0.5">{layer.subtitle}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-0.5">Layer ID</div>
                  <div className="text-gray-600 break-all">{layer.layerId}</div>
                </div>
                {layer.geometryType ? (
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Geometry</div>
                    <div className="text-gray-600">{layer.geometryType}</div>
                  </div>
                ) : null}
              </div>

              {displayLayerProps.length > 0 ? (
                <div>
                  <div className="text-[10px] font-medium text-gray-500 mb-1">Properties</div>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      {displayLayerProps.map(([k, v]) => (
                        <div key={k} className="grid grid-cols-3 gap-2 px-[10px] py-2">
                          <div className="col-span-1 text-[10px] font-medium text-gray-500 truncate">{k}</div>
                          <div className="col-span-2 text-xs text-gray-900 break-words">
                            {v === null ? '—' : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {layerProperties.length > displayLayerProps.length ? (
                    <div className="text-[10px] text-gray-500 mt-1">
                      Showing {displayLayerProps.length} of {layerProperties.length}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No properties</div>
              )}
            </>
          )}

          {/* Owner Actions */}
          {isOwner && isPin && (
            <div className="pt-3 border-t border-gray-200 space-y-2">
              {isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setShowLatLngEdit(false);
                    setShowEmojiPicker(false);
                    setShowEmojiInput(false);
                    // Reset edit data to original values
                    if (entity) {
                      const pin = entity as MapPin;
                      setEditData({
                        emoji: pin.emoji || '',
                        caption: pin.caption || '',
                        image_url: pin.image_url || '',
                        video_url: pin.video_url || '',
                        lat: pin.lat,
                        lng: pin.lng,
                      });
                    }
                  }}
                  disabled={isSaving}
                  className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isEditing}
                  className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-red-200 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <TrashIcon className="w-3 h-3" />
                  Delete Pin
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 text-center">
                    Are you sure you want to delete this pin?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-red-200 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
          </div>
        ) : (
          <>
            {/* Drag Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center px-[10px] py-[10px] border-b border-gray-200">
              {/* Back Button */}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>

              {/* Centered Title */}
              <div className="flex-1 text-center">
                <h3 className="text-xs font-semibold text-gray-900 truncate px-2">
                  {isPin && pin
                    ? pin.caption || 'Pin'
                    : isLayer && layer
                    ? layer.title || 'Layer'
                    : area
                    ? area.name || 'Area'
                    : 'Details'}
                </h3>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div 
              className="overflow-y-auto px-[10px] py-3 space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              style={{ maxHeight: 'calc(80vh - 80px)' }}
            >
              {/* Pin Content */}
              {isPin && pin && (
                <>
                  {/* Emoji */}
                  <div className="flex justify-center">
                    <div className="text-2xl">{pin.emoji || '📍'}</div>
                  </div>

                  {/* Caption */}
                  <div>
                    <div className="text-xs text-gray-900 px-[10px]">{pin.caption || <span className="text-gray-400">No caption</span>}</div>
                  </div>

                  {/* Media */}
                  <div>
                    {pin.image_url ? (
                      <div className="relative w-full h-48 rounded-md overflow-hidden border border-gray-200">
                        <Image
                          src={pin.image_url}
                          alt={pin.caption || 'Pin image'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : pin.video_url ? (
                      <div className="relative w-full rounded-md overflow-hidden border border-gray-200">
                        <video
                          src={pin.video_url}
                          controls
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 px-[10px]">No media</div>
                    )}
                  </div>

                  {/* Coordinates */}
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Coordinates</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] font-medium text-gray-500 mb-0.5">Latitude</div>
                        <div className="text-gray-900">{pin.lat.toFixed(6)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-gray-500 mb-0.5">Longitude</div>
                        <div className="text-gray-900">{pin.lng.toFixed(6)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Area Content */}
              {!isPin && area && (
                <>
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Name</div>
                    <div className="text-xs font-semibold text-gray-900">{area.name}</div>
                  </div>
                  {area.description && (
                    <div>
                      <div className="text-[10px] font-medium text-gray-500 mb-0.5">Description</div>
                      <div className="text-xs text-gray-900">{area.description}</div>
                    </div>
                  )}
                </>
              )}

              {/* Layer Content */}
              {isLayer && layer && (
                <>
                  <div>
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Layer</div>
                    <div className="text-xs font-semibold text-gray-900">{layer.title}</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

