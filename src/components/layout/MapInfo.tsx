'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { MapIcon, XMarkIcon, CameraIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MentionService } from '@/features/mentions/services/mentionService';
import { supabase } from '@/lib/supabase';
import confetti from 'canvas-confetti';

type MentionType = { id: string; emoji: string; name: string };

export interface MapInfoLocation {
  lat: number;
  lng: number;
  address: string | null;
  mapMeta?: Record<string, any> | null;
}

const ZOOM_FOR_PINS = 12;

/** Safe numeric coords for display; avoids TypeError when lat/lng are strings or undefined. */
function safeLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return {
    lat: Number.isFinite(latNum) ? latNum : 0,
    lng: Number.isFinite(lngNum) ? lngNum : 0,
  };
}

export interface MapInfoMentionType {
  id: string;
  emoji: string;
  name: string;
}

interface MapInfoProps {
  /** Location selected on map (null when none) */
  location: MapInfoLocation | null;
  /** Optional placeholder when no location selected */
  emptyLabel?: string;
  /** Current map zoom; when &lt; ZOOM_FOR_PINS and no emptyLabel, shows zoom hint for dropping pins */
  zoom?: number;
  /** When set and zoom >= 12, show "Add to map" button; called with current location and optional mention type id */
  onAddToMap?: (location: MapInfoLocation, mentionTypeId?: string) => void;
  /** When set with location, show mention type card in location area and "Add [Type] to map" button */
  mentionType?: MapInfoMentionType | null;
  /** When set, show close icon on the card; called when user closes (clears selection and URL on live). */
  onClose?: () => void;
  /** Called when mention is successfully created */
  onMentionCreated?: (mention: any) => void;
  /** When true, show only location/coords and close; no create-pin form (e.g. on /maps). */
  readOnly?: boolean;
}

function getMapMetaCardInfo(mapMeta: Record<string, any> | null | undefined): { emoji: string; name: string } | null {
  if (!mapMeta) return null;
  // Boundary click (state / county / CTU)
  const boundaryLayer = mapMeta.boundaryLayer as string | undefined;
  const boundaryName = mapMeta.boundaryName as string | undefined;
  if (boundaryLayer && boundaryName) {
    const layerLabel =
      boundaryLayer === 'state'
        ? 'State boundary'
        : boundaryLayer === 'district'
          ? 'Congressional district'
          : boundaryLayer === 'county'
            ? 'County'
            : boundaryLayer === 'ctu'
              ? 'CTU'
              : 'Boundary';
    return { emoji: '🗺️', name: `${layerLabel}: ${boundaryName}` };
  }
  // Pin / location feature
  const f = mapMeta.feature;
  if (!f) return null;
  const name = (f.name ?? f.label ?? '') || null;
  if (!name && !f.icon) return null;
  const emoji = typeof f.icon === 'string' ? f.icon : '📍';
  return { emoji, name: name || 'Location' };
}

/** Entity details from boundary click: pick display-safe fields per layer. */
function getBoundaryDetailRows(
  boundaryLayer: string | undefined,
  details: Record<string, any> | null | undefined
): { label: string; value: string }[] {
  if (!details || typeof details !== 'object') return [];
  const rows: { label: string; value: string }[] = [];
  if (boundaryLayer === 'state') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.description != null) rows.push({ label: 'Description', value: String(details.description) });
    if (details.publisher != null) rows.push({ label: 'Publisher', value: String(details.publisher) });
    if (details.source_date != null) rows.push({ label: 'Source date', value: String(details.source_date) });
  } else if (boundaryLayer === 'district') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.district_number != null) rows.push({ label: 'District', value: String(details.district_number) });
  } else if (boundaryLayer === 'county') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.county_code != null) rows.push({ label: 'Code', value: String(details.county_code) });
    if (details.county_gnis_feature_id != null) rows.push({ label: 'GNIS ID', value: String(details.county_gnis_feature_id) });
  } else if (boundaryLayer === 'ctu') {
    if (details.id != null) rows.push({ label: 'ID', value: String(details.id) });
    if (details.ctu_class != null) rows.push({ label: 'Class', value: String(details.ctu_class) });
    if (details.county_name != null) rows.push({ label: 'County', value: String(details.county_name) });
    if (details.population != null) rows.push({ label: 'Population', value: String(details.population) });
    if (details.acres != null) rows.push({ label: 'Acres', value: String(details.acres) });
  }
  return rows;
}

/**
 * Container for dynamic map info (e.g. location selected on click).
 * Shows map meta card (emoji + name) when available, then location selected.
 */
function getEmptyLabel(zoom: number | undefined, explicitEmptyLabel: string | undefined): string {
  if (explicitEmptyLabel !== undefined) return explicitEmptyLabel;
  if (zoom !== undefined && zoom < ZOOM_FOR_PINS) return 'Zoom to 12 or more to drop pins.';
  return 'Tap the map to select a location';
}

export function MapInfoSkeleton({ onClose }: { onClose?: () => void }) {
  return (
    <div className="p-[10px] space-y-3" data-container="map-info-skeleton" aria-label="Loading map info">
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded bg-surface-accent animate-pulse" aria-hidden />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center p-1 text-foreground-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        <div className="h-2.5 w-20 rounded bg-surface-accent animate-pulse" aria-hidden />
        <div className="h-3.5 w-full max-w-[200px] rounded bg-surface-accent animate-pulse" aria-hidden />
        <div className="h-2.5 w-24 rounded bg-surface-accent animate-pulse" aria-hidden />
      </div>
    </div>
  );
}

export default function MapInfo({ location, emptyLabel, zoom, onAddToMap, mentionType, onClose, onMentionCreated, readOnly = false }: MapInfoProps) {
  const { user, account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingMentionTypes, setLoadingMentionTypes] = useState(true);
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(
    mentionType?.id || null
  );
  const [showMentionTypeDropdown, setShowMentionTypeDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const filteredMentionTypes = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return mentionTypes;
    return mentionTypes.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.emoji && t.emoji.toLowerCase().includes(q))
    );
  }, [mentionTypes, tagSearch]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionTypeDropdownRef = useRef<HTMLDivElement>(null);
  const lastSubmitTimeRef = useRef<number>(0);

  // Fetch mention types
  useEffect(() => {
    const fetchMentionTypes = async () => {
      setLoadingMentionTypes(true);
      try {
        const { data, error } = await supabase
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (err) {
        console.error('[MapInfo] Failed to fetch mention types:', err);
      } finally {
        setLoadingMentionTypes(false);
      }
    };

    fetchMentionTypes();
  }, []);

  // Close mention type dropdown when clicking outside
  useEffect(() => {
    if (!showMentionTypeDropdown) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionTypeDropdownRef.current && !mentionTypeDropdownRef.current.contains(event.target as Node)) {
        setShowMentionTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMentionTypeDropdown]);

  // Update selected mention type when prop changes
  useEffect(() => {
    if (mentionType?.id) {
      setSelectedMentionTypeId(mentionType.id);
    }
  }, [mentionType]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!showMentionTypeDropdown) setTagSearch('');
  }, [showMentionTypeDropdown]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      openWelcome();
      return;
    }

    // Validate file type - only images allowed
    if (!file.type.startsWith('image/')) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 5MB for images)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;

    setIsUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/mentions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('mentions-media')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('mentions-media')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      return urlData.publicUrl;
    } catch (err) {
      console.error('[MapInfo] Error uploading image:', err);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !activeAccountId) {
      openWelcome();
      return;
    }

    if (!location) {
      return;
    }

    // Rate limit: only one pin every 10 seconds
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTimeRef.current;
    if (timeSinceLastSubmit < 10000) {
      const secondsRemaining = Math.ceil((10000 - timeSinceLastSubmit) / 1000);
      setError(`Please wait ${secondsRemaining} second${secondsRemaining > 1 ? 's' : ''} before submitting again`);
      return;
    }

    // Validate description is required
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    // Validate mention type is required
    if (!selectedMentionTypeId) {
      setError('Please select a mention type');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { lat, lng } = safeLatLng(location.lat, location.lng);

      // Upload image if present
      let imageUrl: string | null = null;
      if (imageFile) {
        try {
          imageUrl = await uploadImage();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
          setError(errorMessage);
          setIsSubmitting(false);
          return;
        }
      }

      // Create mention
      const mention = await MentionService.createMention({
        lat,
        lng,
        description: description.trim(),
        mention_type_id: selectedMentionTypeId,
        visibility: 'public',
        image_url: imageUrl || undefined,
        media_type: imageUrl ? 'image' : undefined,
        full_address: location.address || undefined,
        map_meta: location.mapMeta || undefined,
      }, activeAccountId);

      // Update rate limit timestamp
      lastSubmitTimeRef.current = Date.now();

      // Dispatch events for MentionsLayer to refresh immediately
      window.dispatchEvent(new CustomEvent('mention-created', {
        detail: { mention }
      }));
      // Also trigger reload-mentions event for MentionsLayer
      window.dispatchEvent(new CustomEvent('reload-mentions'));

      // Call onMentionCreated callback if provided
      if (onMentionCreated) {
        onMentionCreated(mention);
      }

      // Trigger confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Cleanup interval after duration
      setTimeout(() => {
        clearInterval(interval);
      }, duration);

      // Clear form and close
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setSelectedMentionTypeId(mentionType?.id || null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Close MapInfo
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('[MapInfo] Error creating mention:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!location) {
    // Hide helper text - return null when no location is selected
    return null;
  }

  const { lat, lng } = safeLatLng(location.lat, location.lng);
  const mapMetaCard = getMapMetaCardInfo(location.mapMeta);
  const display = location.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const boundaryLayer = location.mapMeta?.boundaryLayer as string | undefined;
  const boundaryDetails = location.mapMeta?.boundaryDetails as Record<string, any> | null | undefined;
  const detailRows = getBoundaryDetailRows(boundaryLayer, boundaryDetails);

  return (
    <div
      className="p-[10px] space-y-3"
      data-container="map-info"
      aria-label="Map info"
    >
      {detailRows.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">Entity details</div>
          <ul className="space-y-0.5 list-none p-0 m-0 text-xs text-foreground-muted">
            {detailRows.map(({ label, value }) => (
              <li key={label} className="flex gap-2">
                <span className="text-foreground-muted flex-shrink-0">{label}:</span>
                <span className="text-foreground break-words">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Image preview - full width with no outer padding */}
      {!readOnly && imagePreview && (
        <div className="relative -mx-[10px] w-[calc(100%+20px)]">
          <div className="relative w-full aspect-video overflow-hidden bg-surface-accent">
            <Image
              src={imagePreview}
              alt="Image preview"
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              aria-label="Remove image"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!readOnly && error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md p-2">
          {error}
        </div>
      )}
      
      <div className="space-y-1">
        <div className="text-xs text-foreground break-words">{display}</div>
        
        {/* Map meta - above coordinates */}
        {mapMetaCard && (
          <div className="flex items-center gap-1.5" data-container="map-meta-card" aria-label="Map meta card">
            <span className="text-base flex-shrink-0" aria-hidden>
              {mapMetaCard.emoji}
            </span>
            <span className="text-xs font-medium text-foreground truncate">{mapMetaCard.name}</span>
          </div>
        )}
        
        <div className="text-[10px] text-foreground-muted">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
        
        {!readOnly && (
          <>
            {/* What's going on here textarea */}
            <div>
              <label htmlFor="map-info-description" className="sr-only">
                What's going on here
              </label>
              <textarea
                id="map-info-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's going on here"
                rows={3}
                className="w-full py-1.5 text-[20px] font-bold text-foreground placeholder-foreground-muted resize-none focus:outline-none"
                style={{ paddingLeft: 0, paddingRight: 0 }}
              />
            </div>
            
            {/* Hidden file input for image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isUploadingImage}
            />

            <div className="flex items-center justify-between gap-2">
              {/* Left side: Label and camera button */}
              <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                {/* Camera Icon Button - Upload image from device */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="flex-shrink-0 flex items-center justify-center h-8 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Upload image"
                >
                  <CameraIcon className="w-4 h-4" />
                </button>
                
                {/* Mention Type Selector */}
                <div className="relative" ref={mentionTypeDropdownRef}>
                  {selectedMentionTypeId ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowMentionTypeDropdown(!showMentionTypeDropdown)}
                        className="flex-shrink-0 flex items-center gap-1.5 h-8 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors"
                        aria-label="Change mention type"
                      >
                        <span className="text-base">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.emoji}</span>
                        <span className="truncate">{mentionTypes.find(t => t.id === selectedMentionTypeId)?.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMentionTypeId(null)}
                        className="flex-shrink-0 h-8 w-8 flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
                        aria-label="Remove mention type"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMentionTypeDropdown(!showMentionTypeDropdown)}
                      className="flex-shrink-0 flex items-center gap-1.5 h-8 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors"
                      aria-label="Select mention type"
                    >
                      <span className="text-xs">#</span>
                      <span>Add tag</span>
                    </button>
                  )}
                  
                  {showMentionTypeDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-border rounded-md shadow-lg min-w-[220px] overflow-hidden">
                      <div className="p-1.5 border-b border-border">
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
                          <input
                            type="text"
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            placeholder="Search tags…"
                            className="w-full h-7 pl-7 pr-2 text-xs border border-border rounded bg-surface-accent text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-gray-300"
                            aria-label="Search tags"
                          />
                        </div>
                      </div>
                      <div className="max-h-[240px] overflow-y-auto p-1.5 scrollbar-hide">
                        {loadingMentionTypes ? (
                          <div className="px-3 py-2 text-xs text-foreground-muted">Loading…</div>
                        ) : filteredMentionTypes.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-foreground-muted">
                            {mentionTypes.length === 0 ? 'Loading…' : 'No tags match'}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {filteredMentionTypes.map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMentionTypeId(type.id);
                                  setShowMentionTypeDropdown(false);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                                  selectedMentionTypeId === type.id
                                    ? 'border-lake-blue bg-lake-blue/15 text-lake-blue dark:bg-lake-blue/20 dark:border-lake-blue/50'
                                    : 'border-gray-200 dark:border-white/10 bg-white dark:bg-surface hover:bg-gray-50 dark:hover:bg-surface-accent'
                                }`}
                              >
                                <span className="text-base">{type.emoji}</span>
                                <span className="text-foreground">{type.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right side: Button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isAuthenticated ? onAddToMap ? (
                  <button
                    type="button"
                    onClick={() => onAddToMap(location, selectedMentionTypeId ?? undefined)}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1.5 max-w-fit h-8 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={selectedMentionTypeId ? `Add ${mentionTypes.find(t => t.id === selectedMentionTypeId)?.name} to map` : 'Add to map'}
                  >
                    <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    {isSubmitting ? 'Adding...' : (selectedMentionTypeId ? `Add ${mentionTypes.find(t => t.id === selectedMentionTypeId)?.name} to map` : 'Add to map')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploadingImage || !selectedMentionTypeId || !description.trim()}
                    className="flex items-center justify-center gap-1.5 max-w-fit h-8 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={selectedMentionTypeId ? `Add ${mentionTypes.find(t => t.id === selectedMentionTypeId)?.name} to map` : 'Add to map'}
                  >
                    <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    {isSubmitting ? 'Submitting...' : (selectedMentionTypeId ? `Add ${mentionTypes.find(t => t.id === selectedMentionTypeId)?.name} to map` : 'Add to map')}
                  </button>
                ) : !isAuthenticated && onAddToMap ? (
                  <button
                    type="button"
                    onClick={openWelcome}
                    className="flex items-center justify-center gap-1.5 max-w-fit h-8 px-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    aria-label="Sign in to add to map"
                  >
                    <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    Sign in to add to map
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
