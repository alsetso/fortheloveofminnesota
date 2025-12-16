'use client';

import { useState, useEffect, useCallback } from 'react';
import { TagService } from '@/features/tags/services/tagService';
import type { PinCategory } from '@/features/pins/services/pinService';
import { Pin } from '@/features/pins/services/pinService';
import { useAuth } from '@/features/auth';
import { EyeIcon, EyeSlashIcon, GlobeAltIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface MapFiltersProps {
  map: import('mapbox-gl').Map | null;
  pins: Pin[];
  onFilteredPinsChange?: (filteredPins: Pin[]) => void;
  onCategoryIdsChange?: (categoryIds: string[]) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  currentMapStyle?: 'dark' | 'satellite';
  onMapStyleToggle?: () => void;
}

interface FilterState {
  selectedCategories: Set<string>;
  additionalCategories: Set<string>;
  showMyPins: boolean;
  showOthersPins: boolean;
  showAreas: boolean;
}

export function MapFilters({ map, pins, onFilteredPinsChange, onCategoryIdsChange, onLayerVisibilityChange, currentMapStyle = 'dark', onMapStyleToggle }: MapFiltersProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<PinCategory[]>([]);
  const [allActiveCategories, setAllActiveCategories] = useState<PinCategory[]>([]);
  const [isAdditionalLayersOpen, setIsAdditionalLayersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    selectedTags: new Set(),
    additionalTags: new Set(),
    showMyPins: true,
    showOthersPins: true,
    showAreas: true,
  });
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Load public categories for map filters
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const [publicCategories, allActive] = await Promise.all([
          TagService.getPublicTagsByEntityType('pin'),
          TagService.getTagsByEntityType('pin'), // Gets all active categories
        ]);
        setCategories(publicCategories);
        setAllActiveCategories(allActive);
        // Select all public categories by default
        const defaultCategoryIds = publicCategories.map(c => c.id);
        setFilters(prev => ({
          ...prev,
          selectedCategories: new Set(defaultCategoryIds),
        }));
        // Immediately notify parent of default categories
        if (onCategoryIdsChange && defaultCategoryIds.length > 0) {
          onCategoryIdsChange(defaultCategoryIds);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, [onCategoryIdsChange, setCategories, setAllActiveCategories]);

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    if (!map) return;

    const layer = map.getLayer(layerId);
    if (layer) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      onLayerVisibilityChange?.(layerId, visible);
    }
  }, [map, onLayerVisibilityChange]);

  // Update area layers visibility
  useEffect(() => {
    if (!map) return;

    const areaLayers = ['saved-areas-fill', 'saved-areas-outline', 'saved-areas-labels'];
    areaLayers.forEach(layerId => {
      const layer = map.getLayer(layerId);
      if (layer) {
        map.setLayoutProperty(layerId, 'visibility', filters.showAreas ? 'visible' : 'none');
      }
    });
  }, [map, filters.showAreas]);

  // Notify parent of selected category IDs for server-side filtering
  useEffect(() => {
    if (isLoadingCategories || !onCategoryIdsChange) return;

    const allSelectedCategoryIds = Array.from(new Set([
      ...Array.from(filters.selectedCategories),
      ...Array.from(filters.additionalCategories),
    ]));

    onCategoryIdsChange(allSelectedCategoryIds);
  }, [filters.selectedCategories, filters.additionalCategories, isLoadingCategories]);

  // Filter pins by ownership (client-side, since server already filtered by category)
  useEffect(() => {
    if (!onFilteredPinsChange || isLoadingCategories) return;

    let filtered = pins;

    // Filter by ownership
    if (user) {
      if (filters.showMyPins && !filters.showOthersPins) {
        filtered = filtered.filter(pin => pin.user_id === user.id);
      } else if (!filters.showMyPins && filters.showOthersPins) {
        filtered = filtered.filter(pin => pin.user_id !== user.id);
      } else if (!filters.showMyPins && !filters.showOthersPins) {
        filtered = [];
      }
    } else {
      // Anonymous users only see public pins (already filtered by service)
      if (!filters.showOthersPins) {
        filtered = [];
      }
    }

    onFilteredPinsChange(filtered);
  }, [pins, filters.showMyPins, filters.showOthersPins, user, isLoadingCategories]);

  const toggleCategory = (categoryId: string) => {
    setFilters(prev => {
      const newSelected = new Set(prev.selectedCategories);
      if (newSelected.has(categoryId)) {
        newSelected.delete(categoryId);
      } else {
        newSelected.add(categoryId);
      }
      return { ...prev, selectedCategories: newSelected };
    });
  };

  const toggleAllCategories = () => {
    setFilters(prev => {
      const allSelected = prev.selectedCategories.size === categories.length;
      return {
        ...prev,
        selectedCategories: allSelected ? new Set() : new Set(categories.map(c => c.id)),
      };
    });
  };

  const toggleAdditionalCategory = (categoryId: string) => {
    setFilters(prev => {
      const newSelected = new Set(prev.additionalCategories);
      if (newSelected.has(categoryId)) {
        newSelected.delete(categoryId);
      } else {
        newSelected.add(categoryId);
      }
      return { ...prev, additionalCategories: newSelected };
    });
  };

  // Get additional categories (active but not public)
  const additionalCategories = allActiveCategories.filter(
    cat => !categories.some(publicCat => publicCat.id === cat.id)
  );

  return (
    <div className="pointer-events-auto w-full space-y-3.5">
      <div className="text-white font-semibold text-sm mb-2.5">Map Filters</div>

      {/* Pin Categories */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-white/90 text-xs font-medium">Pin Categories</label>
          <button
            onClick={toggleAllCategories}
            className="text-white/70 hover:text-white text-xs underline transition-colors"
          >
            {filters.selectedCategories.size === categories.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {isLoadingCategories ? (
          <div className="text-white/60 text-xs py-1">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="text-white/60 text-xs py-1">No categories available</div>
        ) : (
          <div className="space-y-1">
            {categories.map(category => (
              <label
                key={category.id}
                className={`flex items-center gap-2.5 cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5 ${
                  !category.is_active ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.selectedCategories.has(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-gold-500 focus:ring-gold-500 focus:ring-1.5 transition-all"
                />
                <span className="text-base leading-none">{category.emoji}</span>
                <span className="text-white/90 text-xs flex-1">{category.label}</span>
                {!category.is_active && (
                  <span className="text-white/50 text-[10px]">(inactive)</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Additional Pin Layers Accordion */}
      {additionalCategories.length > 0 && (
        <div className="space-y-2 border-t border-white/20 pt-2.5">
          <button
            onClick={() => setIsAdditionalLayersOpen(!isAdditionalLayersOpen)}
            className="flex items-center justify-between w-full text-left py-0.5 hover:bg-white/5 rounded transition-colors"
          >
            <label className="text-white/90 text-xs font-medium cursor-pointer">
              Additional Pin Layers
            </label>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 text-white/60 transition-transform ${
                isAdditionalLayersOpen ? 'transform rotate-180' : ''
              }`}
            />
          </button>
          {isAdditionalLayersOpen && (
            <div className="space-y-1 mt-1.5">
              {additionalCategories.map(category => (
                <label
                  key={category.id}
                  className="flex items-center gap-2.5 cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={filters.additionalCategories.has(category.id)}
                    onChange={() => toggleAdditionalCategory(category.id)}
                    className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-gold-500 focus:ring-gold-500 focus:ring-1.5 transition-all"
                  />
                  <span className="text-base leading-none">{category.emoji}</span>
                  <span className="text-white/90 text-xs flex-1">{category.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pin Ownership Filters */}
      {user && (
        <div className="space-y-2 border-t border-white/20 pt-2.5">
          <label className="text-white/90 text-xs font-medium block mb-1.5">Pin Visibility</label>
          <div className="space-y-1">
            <label className="flex items-center gap-2.5 cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5">
              <input
                type="checkbox"
                checked={filters.showMyPins}
                onChange={(e) => setFilters(prev => ({ ...prev, showMyPins: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-gold-500 focus:ring-gold-500 focus:ring-1.5 transition-all"
              />
              <span className="text-white/90 text-xs">My Pins</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5">
              <input
                type="checkbox"
                checked={filters.showOthersPins}
                onChange={(e) => setFilters(prev => ({ ...prev, showOthersPins: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-gold-500 focus:ring-gold-500 focus:ring-1.5 transition-all"
              />
              <span className="text-white/90 text-xs">Others&apos; Pins</span>
            </label>
          </div>
        </div>
      )}

      {/* Layer Visibility */}
      <div className="space-y-2 border-t border-white/20 pt-2.5">
        <label className="text-white/90 text-xs font-medium block mb-1.5">Layers</label>
        <div className="space-y-1">
          <label className="flex items-center gap-2.5 cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5">
            <input
              type="checkbox"
              checked={filters.showAreas}
              onChange={(e) => {
                const visible = e.target.checked;
                setFilters(prev => ({ ...prev, showAreas: visible }));
                toggleLayerVisibility('saved-areas-fill', visible);
                toggleLayerVisibility('saved-areas-outline', visible);
                toggleLayerVisibility('saved-areas-labels', visible);
              }}
              className="w-3.5 h-3.5 rounded border-white/30 bg-white/10 text-gold-500 focus:ring-gold-500 focus:ring-1.5 transition-all"
            />
            <span className="text-white/90 text-xs flex-1">Saved Areas</span>
            {filters.showAreas ? (
              <EyeIcon className="w-3.5 h-3.5 text-white/60" />
            ) : (
              <EyeSlashIcon className="w-3.5 h-3.5 text-white/60" />
            )}
          </label>
        </div>
      </div>

      {/* Map Style Toggle */}
      {onMapStyleToggle && (
        <div className="space-y-2 border-t border-white/20 pt-2.5">
          <label className="text-white/90 text-xs font-medium block mb-1.5">Map Style</label>
          <div className="space-y-1">
            <button
              onClick={onMapStyleToggle}
              className="flex items-center gap-2.5 w-full cursor-pointer group py-0.5 rounded transition-colors hover:bg-white/5"
            >
              <div className="relative w-9 h-4.5 rounded-full bg-white/20 border border-white/30 transition-colors">
                <div
                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                    currentMapStyle === 'satellite' ? 'translate-x-4.5' : ''
                  }`}
                />
              </div>
              <GlobeAltIcon className="w-3.5 h-3.5 text-white/60" />
              <span className="text-white/90 text-xs flex-1 text-left">
                {currentMapStyle === 'satellite' ? 'Satellite' : 'Dark'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Summary */}
      <div className="border-t border-white/20 pt-2.5">
        <div className="text-white/70 text-[11px] leading-relaxed">
          Showing {filters.selectedCategories.size + filters.additionalCategories.size} of {categories.length + additionalCategories.length} categories
          {user && (
            <>
              {' • '}
              {filters.showMyPins && filters.showOthersPins
                ? 'All pins'
                : filters.showMyPins
                ? 'My pins only'
                : filters.showOthersPins
                ? "Others' pins only"
                : 'No pins'}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

