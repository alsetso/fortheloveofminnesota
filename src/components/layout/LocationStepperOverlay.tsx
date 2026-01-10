'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { XMarkIcon, MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';
import LayerGeometryMap from './LayerGeometryMap';
import { useLocation } from '@/features/map/hooks/useLocation';

const OVERLAY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'location-stepper-last-shown';
const PRIMARY_LOCATION_STORAGE_KEY = 'PRIMARY_LOCATION_AREA_ONBOARDING';

interface LocationStepperOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationStepperOverlay({ isOpen, onClose }: LocationStepperOverlayProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [ctus, setCTUs] = useState<any[]>([]);
  const [selectedCTU, setSelectedCTU] = useState<any>(null);
  const [hoveredCTU, setHoveredCTU] = useState<any>(null);
  const [showCTUDetailsPopup, setShowCTUDetailsPopup] = useState(false);
  const ctuDetailsPopupRef = useRef<HTMLDivElement>(null);
  const { location, isLoading: isLocationLoading, isSupported: isLocationSupported, requestLocation } = useLocation();

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let mapboxMap: MapboxMapInstance | null = null;

    const initMap = async () => {
      try {
        const mapboxgl = await loadMapboxGL();
        if (!mapboxgl || !mapContainerRef.current) return;

        mapboxMap = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: 6,
          pitch: 0,
          bearing: 0,
        }) as MapboxMapInstance;

        mapboxMap.on('load', () => {
          setMapLoaded(true);
          mapInstanceRef.current = mapboxMap;
        });

        mapboxMap.on('error', (e) => {
          console.error('[LocationStepperOverlay] Map error:', e);
        });
      } catch (error) {
        console.error('[LocationStepperOverlay] Failed to initialize map:', error);
      }
    };

    initMap();

    return () => {
      if (mapboxMap) {
        mapboxMap.remove();
        mapboxMap = null;
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
    };
  }, [isOpen]);

  // Fetch CTUs when overlay opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchCTUs = async () => {
      try {
        const response = await fetch('/api/civic/ctu-boundaries');
        if (!response.ok) throw new Error('Failed to fetch CTU boundaries');
        const data = await response.json();
        setCTUs(data);
      } catch (error) {
        console.error('[LocationStepperOverlay] Failed to fetch CTU boundaries:', error);
      }
    };

    fetchCTUs();
  }, [isOpen]);

  // Render CTU boundaries on map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || ctus.length === 0) return;

    const mapboxMap = mapInstanceRef.current as any;
    const sourceId = 'stepper-ctu-boundaries-source';
    const fillLayerId = 'stepper-ctu-boundaries-fill';
    const outlineLayerId = 'stepper-ctu-boundaries-outline';
    const highlightFillLayerId = 'stepper-ctu-boundaries-highlight-fill';
    const highlightOutlineLayerId = 'stepper-ctu-boundaries-highlight-outline';
    const highlightSourceId = 'stepper-ctu-boundaries-highlight-source';

    const setupCTUBoundaries = async () => {
      try {
        // Remove existing layers/sources if they exist
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
        if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);

        // Combine all CTU geometries into a single FeatureCollection
        const allFeatures: any[] = [];
        ctus.forEach((ctu) => {
          const featureCollection = ctu.geometry;
          if (featureCollection && featureCollection.type === 'FeatureCollection' && featureCollection.features) {
            featureCollection.features.forEach((feature: any) => {
              // Add CTU metadata to each feature's properties (same as CTUBoundariesLayer)
              allFeatures.push({
                ...feature,
                properties: {
                  ...feature.properties,
                  ctu_id: ctu.id,
                  ctu_class: ctu.ctu_class,
                  feature_name: ctu.feature_name,
                  county_name: ctu.county_name,
                },
              });
            });
          } else if (ctu.geometry) {
            allFeatures.push({
              type: 'Feature',
              properties: {
                id: ctu.id,
                feature_name: ctu.feature_name,
                ctu_class: ctu.ctu_class,
                county_name: ctu.county_name,
              },
              geometry: ctu.geometry,
            });
          }
        });

        const featureCollection = {
          type: 'FeatureCollection',
          features: allFeatures,
        };

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: featureCollection,
        });

        // Color scheme by CTU class (same as CTUBoundariesLayer)
        const colorMap = {
          'CITY': '#4A90E2',           // Blue
          'TOWNSHIP': '#7ED321',       // Green
          'UNORGANIZED TERRITORY': '#F5A623', // Orange
        };

        // Add fill layer
        mapboxMap.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': [
              'match',
              ['get', 'ctu_class'],
              'CITY', colorMap['CITY'],
              'TOWNSHIP', colorMap['TOWNSHIP'],
              'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
              '#888888', // Default gray
            ],
            'fill-opacity': 0.3,
          },
        });

        // Add outline layer
        mapboxMap.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'match',
              ['get', 'ctu_class'],
              'CITY', colorMap['CITY'],
              'TOWNSHIP', colorMap['TOWNSHIP'],
              'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
              '#888888', // Default gray
            ],
            'line-width': 1,
          },
        });

        // Add highlight source (empty initially)
        mapboxMap.addSource(highlightSourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Add highlight fill layer (darker overlay)
        mapboxMap.addLayer({
          id: highlightFillLayerId,
          type: 'fill',
          source: highlightSourceId,
          paint: {
            'fill-color': [
              'match',
              ['get', 'ctu_class'],
              'CITY', colorMap['CITY'],
              'TOWNSHIP', colorMap['TOWNSHIP'],
              'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
              '#888888', // Default gray
            ],
            'fill-opacity': 0.5, // Darker than regular CTUs (0.3)
          },
        });

        // Add highlight outline layer
        mapboxMap.addLayer({
          id: highlightOutlineLayerId,
          type: 'line',
          source: highlightSourceId,
          paint: {
            'line-color': [
              'match',
              ['get', 'ctu_class'],
              'CITY', colorMap['CITY'],
              'TOWNSHIP', colorMap['TOWNSHIP'],
              'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
              '#888888', // Default gray
            ],
            'line-width': 2,
            'line-opacity': 1,
          },
        });

        // Fit bounds to CTUs
        const mapboxgl = await loadMapboxGL();
        if (mapboxgl) {
          const bounds = new mapboxgl.LngLatBounds();
          allFeatures.forEach((feature) => {
            if (feature.geometry.type === 'Polygon') {
              feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
                bounds.extend(coord);
              });
            } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates.forEach((polygon: any) => {
                polygon[0].forEach((coord: [number, number]) => {
                  bounds.extend(coord);
                });
              });
            }
          });
          mapboxMap.fitBounds(bounds, { padding: 50, duration: 1000 });
        }
      } catch (error) {
        console.error('[LocationStepperOverlay] Failed to render CTU boundaries:', error);
      }
    };

    setupCTUBoundaries();

    return () => {
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
        if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [mapLoaded, ctus]);

  // Handle CTU hover (disabled when area is selected)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || selectedCTU) return;

    const mapboxMap = mapInstanceRef.current as any;
    const fillLayerId = 'stepper-ctu-boundaries-fill';
    const highlightSourceId = 'stepper-ctu-boundaries-highlight-source';

    const handleMouseMove = (e: any) => {
      mapboxMap.getCanvas().style.cursor = 'pointer';

      // Query the exact feature at the cursor position
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [fillLayerId],
      });

      if (features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        // Set hovered CTU for floating card
        setHoveredCTU({
          feature_name: properties.feature_name || 'Unknown',
          ctu_class: properties.ctu_class || 'Unknown',
          county_name: properties.county_name || 'Unknown',
        });

        // Highlight this specific CTU feature (darker overlay)
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [feature],
          });
        }
      } else {
        // Clear highlight and hovered CTU when not hovering over a CTU
        setHoveredCTU(null);
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
        mapboxMap.getCanvas().style.cursor = '';
      }
    };

    const handleMouseLeave = () => {
      // Clear highlight and hovered CTU when mouse leaves the map
      setHoveredCTU(null);
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
      mapboxMap.getCanvas().style.cursor = '';
    };

    mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
    mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);

    return () => {
      mapboxMap.off('mousemove', fillLayerId, handleMouseMove);
      mapboxMap.off('mouseleave', fillLayerId, handleMouseLeave);
    };
  }, [mapLoaded, selectedCTU]);

  // Handle map clicks
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const mapboxMap = mapInstanceRef.current as any;

    const handleClick = async (e: any) => {
      // Check if clicked on CTU boundary
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: ['stepper-ctu-boundaries-fill'],
      });

      if (features.length > 0) {
          const feature = features[0];
          const properties = feature.properties || {};
          
          // Find the full CTU data from ctus array
          const fullCTU = ctus.find(ctu => 
            ctu.id === properties.ctu_id || 
            (ctu.feature_name === properties.feature_name && ctu.county_name === properties.county_name)
          );

          setSelectedCTU({
            ...feature,
            ctuData: fullCTU || {
              id: properties.ctu_id,
              feature_name: properties.feature_name,
              ctu_class: properties.ctu_class,
              county_name: properties.county_name,
            },
          });
          
          // Open details popup
          setShowCTUDetailsPopup(true);
        }
    };

    mapboxMap.on('click', handleClick);

    return () => {
      mapboxMap.off('click', handleClick);
    };
  }, [mapLoaded, onClose, ctus]);

  // Manage CTU visibility based on selectedCTU state
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const mapboxMap = mapInstanceRef.current as any;
    const fillLayerId = 'stepper-ctu-boundaries-fill';
    const outlineLayerId = 'stepper-ctu-boundaries-outline';

    if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getLayer(outlineLayerId)) return;

    if (selectedCTU) {
      // Hide all other CTUs, show only selected
      const properties = selectedCTU.properties || {};
      const selectedFeatureName = properties.feature_name || '';
      const selectedCountyName = properties.county_name || '';

      mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
        'case',
        ['all',
          ['==', ['get', 'feature_name'], selectedFeatureName],
          ['==', ['get', 'county_name'], selectedCountyName]
        ],
        0.3, // Keep selected visible
        0, // Hide all others
      ]);

      mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
        'case',
        ['all',
          ['==', ['get', 'feature_name'], selectedFeatureName],
          ['==', ['get', 'county_name'], selectedCountyName]
        ],
        1, // Keep selected visible
        0, // Hide all others
      ]);
    } else {
      // Show all CTUs
      mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.3);
      mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 1);
    }
  }, [selectedCTU, mapLoaded]);

  // Fly to selected CTU when it changes
  useEffect(() => {
    if (!selectedCTU || !mapInstanceRef.current || !mapLoaded) return;

    const mapboxMap = mapInstanceRef.current as any;
    if (mapboxMap.removed) return;

    const flyToSelectedArea = async () => {
      const mapboxgl = await loadMapboxGL();
      if (!mapboxgl || !selectedCTU.geometry) return;

      const bounds = new mapboxgl.LngLatBounds();

      // Calculate bounds from geometry
      if (selectedCTU.geometry.type === 'Polygon') {
        selectedCTU.geometry.coordinates[0].forEach((coord: [number, number]) => {
          bounds.extend(coord);
        });
      } else if (selectedCTU.geometry.type === 'MultiPolygon') {
        selectedCTU.geometry.coordinates.forEach((polygon: any) => {
          polygon[0].forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
        });
      }

      // Fly to bounds
      mapboxMap.flyTo({
        bounds: bounds,
        padding: 50,
        duration: 1000,
      });
    };

    flyToSelectedArea();
  }, [selectedCTU, mapLoaded]);

  // Center map on user location when location is received
  useEffect(() => {
    if (!location || !mapInstanceRef.current || !mapLoaded) return;

    const mapboxMap = mapInstanceRef.current as any;
    if (mapboxMap.removed) return;

    mapboxMap.flyTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(mapboxMap.getZoom(), 15),
      duration: 1000,
    });
  }, [location, mapLoaded]);

  // Animate CTU details popup slide up
  useEffect(() => {
    if (showCTUDetailsPopup && ctuDetailsPopupRef.current) {
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (ctuDetailsPopupRef.current) {
          ctuDetailsPopupRef.current.style.transform = 'translateY(0)';
        }
      });
    } else if (!showCTUDetailsPopup && ctuDetailsPopupRef.current) {
      // Reset transform when closing
      ctuDetailsPopupRef.current.style.transform = 'translateY(100%)';
      // Clear selected CTU when popup closes (this will restore all boundaries via useEffect)
      setSelectedCTU(null);
    }
  }, [showCTUDetailsPopup, mapLoaded]);

  // Handle user location button click
  const handleCenterOnLocation = () => {
    if (isLocationLoading || !isLocationSupported) return;
    requestLocation();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" style={{ width: '100vw', height: '100vh' }}>
      <div className="absolute inset-0" style={{ width: '100vw', height: '100vh' }}>
        <div className="relative overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
          {/* Top right controls container */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {/* User Location button */}
            <button
              onClick={handleCenterOnLocation}
              disabled={!isLocationSupported || isLocationLoading || !mapLoaded}
              className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Center on my location"
              title="Center on my location"
            >
              <MapPinIcon className={`w-5 h-5 text-gray-600 ${isLocationLoading ? 'animate-pulse' : ''}`} />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Header - White container with dark text */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-white rounded-md shadow-lg px-4 py-3 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Your Location
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Click an area on the map
              </p>
            </div>
          </div>

          {/* Map container */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Loading overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading map...</p>
              </div>
            </div>
          )}

          {/* Hover card - bottom right (hidden when popup is open) */}
          {hoveredCTU && !showCTUDetailsPopup && (
            <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3 border border-gray-200 pointer-events-none">
              <div className="text-sm font-semibold text-gray-900">{hoveredCTU.feature_name}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {hoveredCTU.ctu_class === 'CITY' ? 'City' : 
                 hoveredCTU.ctu_class === 'TOWNSHIP' ? 'Township' : 
                 'Unorganized Territory'} • {hoveredCTU.county_name} County
              </div>
            </div>
          )}

          {/* CTU Details Popup */}
          {showCTUDetailsPopup && selectedCTU && (
            <>
              {/* Popup - slide up from bottom on mobile, left side on desktop */}
              <div
                ref={ctuDetailsPopupRef}
                className="fixed z-[110] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col
                  /* Mobile: bottom sheet */
                  bottom-0 left-0 right-0 rounded-t-3xl
                  /* Desktop: bottom sheet with 500px width, left side, squared bottom corners */
                  xl:bottom-0 xl:left-4 xl:right-auto xl:w-[500px] xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]"
                style={{
                  transform: 'translateY(100%)',
                  minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
                  maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                {/* Handle bar - hidden on desktop */}
                <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
                  <div className="w-12 h-1 rounded-full bg-gray-300" />
                </div>

                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 xl:rounded-t-lg">
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {selectedCTU.ctuData?.feature_name || selectedCTU.properties?.feature_name || 'Area Details'}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowCTUDetailsPopup(false);
                      setSelectedCTU(null);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {/* Mark as Primary Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        // Save selected location to localStorage
                        if (selectedCTU) {
                          const locationData = {
                            ctu_id: selectedCTU.ctuData?.id || selectedCTU.properties?.ctu_id,
                            feature_name: selectedCTU.ctuData?.feature_name || selectedCTU.properties?.feature_name,
                            ctu_class: selectedCTU.ctuData?.ctu_class || selectedCTU.properties?.ctu_class,
                            county_name: selectedCTU.ctuData?.county_name || selectedCTU.properties?.county_name,
                            geometry: selectedCTU.geometry,
                            savedAt: Date.now(),
                          };
                          localStorage.setItem(PRIMARY_LOCATION_STORAGE_KEY, JSON.stringify(locationData));
                        }
                        
                        setShowCTUDetailsPopup(false);
                        setSelectedCTU(null);
                        setHoveredCTU(null);
                        onClose();
                      }}
                      className="w-full bg-white border border-gray-300 hover:bg-green-50 hover:border-green-500 text-gray-900 hover:text-green-700 font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckIcon className="w-5 h-5" />
                      Mark as Primary
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

