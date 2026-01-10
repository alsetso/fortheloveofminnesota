'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { XMarkIcon } from '@heroicons/react/24/outline';
import LayerGeometryMap from './LayerGeometryMap';

const OVERLAY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'location-stepper-last-shown';

interface LocationStepperOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationStepperOverlay({ isOpen, onClose }: LocationStepperOverlayProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [stateBoundary, setStateBoundary] = useState<any>(null);
  const [ctus, setCTUs] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<any>(null);
  const [selectedCTU, setSelectedCTU] = useState<any>(null);
  const [hoveredCTU, setHoveredCTU] = useState<any>(null);
  const [showCTUDetailsPopup, setShowCTUDetailsPopup] = useState(false);
  const ctuDetailsPopupRef = useRef<HTMLDivElement>(null);

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
          style: MAP_CONFIG.MAPBOX_STYLE,
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

  // Fetch state boundary for step 1
  useEffect(() => {
    if (!isOpen || step !== 1) return;

    const fetchStateBoundary = async () => {
      try {
        const response = await fetch('/api/civic/state-boundary');
        if (!response.ok) throw new Error('Failed to fetch state boundary');
        const data = await response.json();
        setStateBoundary(data);
      } catch (error) {
        console.error('[LocationStepperOverlay] Failed to fetch state boundary:', error);
      }
    };

    fetchStateBoundary();
  }, [isOpen, step]);

  // Fetch CTUs for step 2
  useEffect(() => {
    if (!isOpen || step !== 2) return;

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
  }, [isOpen, step]);

  // Render state boundary on map (step 1)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !stateBoundary || step !== 1) return;

    const mapboxMap = mapInstanceRef.current as any;
    const sourceId = 'stepper-state-boundary-source';
    const fillLayerId = 'stepper-state-boundary-fill';
    const outlineLayerId = 'stepper-state-boundary-outline';

    const setupStateBoundary = async () => {
      try {
        // Remove existing layers/sources if they exist
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: stateBoundary.geometry,
        });

        // Add fill layer
        mapboxMap.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.3,
          },
        });

        // Add outline layer
        mapboxMap.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
          },
        });

        // Fit bounds to state boundary
        const mapboxgl = await loadMapboxGL();
        if (mapboxgl && stateBoundary.geometry && stateBoundary.geometry.type === 'FeatureCollection') {
          const bounds = new mapboxgl.LngLatBounds();
          // Extract coordinates from FeatureCollection features
          stateBoundary.geometry.features.forEach((feature: any) => {
            if (feature.geometry && feature.geometry.coordinates) {
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
            }
          });
          if (bounds.getNorth() && bounds.getSouth() && bounds.getEast() && bounds.getWest()) {
            mapboxMap.fitBounds(bounds, { padding: 50, duration: 1000 });
          }
        }
      } catch (error) {
        console.error('[LocationStepperOverlay] Failed to render state boundary:', error);
      }
    };

    setupStateBoundary();

    return () => {
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [mapLoaded, stateBoundary, step]);

  // Render CTU boundaries on map (step 2)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || ctus.length === 0 || step !== 2) return;

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
  }, [mapLoaded, ctus, step]);

  // Handle CTU hover (step 2 only)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || step !== 2) return;

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
  }, [mapLoaded, step]);

  // Handle map clicks
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const mapboxMap = mapInstanceRef.current as any;

    const handleClick = async (e: any) => {
      if (step === 1) {
        // Check if clicked on state boundary
        const features = mapboxMap.queryRenderedFeatures(e.point, {
          layers: ['stepper-state-boundary-fill'],
        });

        if (features.length > 0) {
          setSelectedState(features[0]);
          // Wait a moment then advance to step 2
          setTimeout(() => {
            setStep(2);
            setSelectedState(null);
          }, 500);
        }
      } else if (step === 2) {
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
      }
    };

    mapboxMap.on('click', handleClick);

    return () => {
      mapboxMap.off('click', handleClick);
    };
  }, [mapLoaded, step, onClose, ctus]);

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
    }
  }, [showCTUDetailsPopup]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" style={{ width: '100vw', height: '100vh' }}>
      <div className="absolute inset-0" style={{ width: '100vw', height: '100vh' }}>
        <div className="relative overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>

          {/* Header - Overlay white text */}
          <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 pointer-events-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white drop-shadow-lg">
                  {step === 1 ? 'Select Your State' : 'Select Your CTU'}
                </h2>
                <p className="text-sm text-white/90 drop-shadow-md mt-1">
                  {step === 1
                    ? 'Click on Minnesota to continue'
                    : 'Click on your City, Township, or Unorganized Territory to continue'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/40'}`} />
                <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/40'}`} />
              </div>
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

          {/* Hover card - bottom right */}
          {hoveredCTU && step === 2 && (
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
              {/* Backdrop - hidden on desktop */}
              <div
                className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-300 xl:hidden"
                onClick={() => {
                  setShowCTUDetailsPopup(false);
                  setSelectedCTU(null);
                }}
              />
              
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
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedCTU.ctuData?.feature_name || selectedCTU.properties?.feature_name || 'Area Details'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {selectedCTU.ctuData?.ctu_class === 'CITY' ? 'City' : 
                       selectedCTU.ctuData?.ctu_class === 'TOWNSHIP' ? 'Township' : 
                       'Unorganized Territory'} • {selectedCTU.ctuData?.county_name || selectedCTU.properties?.county_name || 'Unknown'} County
                    </p>
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
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {/* Area Details */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-900">Area Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Type:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {selectedCTU.ctuData?.ctu_class === 'CITY' ? 'City' : 
                           selectedCTU.ctuData?.ctu_class === 'TOWNSHIP' ? 'Township' : 
                           'Unorganized Territory'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">County:</span>
                        <span className="ml-2 text-gray-900 font-medium">
                          {selectedCTU.ctuData?.county_name || selectedCTU.properties?.county_name || 'Unknown'}
                        </span>
                      </div>
                      {selectedCTU.ctuData?.population && (
                        <div>
                          <span className="text-gray-600">Population:</span>
                          <span className="ml-2 text-gray-900 font-medium">
                            {selectedCTU.ctuData.population.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {selectedCTU.ctuData?.acres && (
                        <div>
                          <span className="text-gray-600">Area:</span>
                          <span className="ml-2 text-gray-900 font-medium">
                            {selectedCTU.ctuData.acres.toLocaleString()} acres
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Map */}
                  {selectedCTU.geometry && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-900">Boundary Map</h4>
                      <div className="rounded-md border border-gray-200 overflow-hidden">
                        <LayerGeometryMap
                          geometry={selectedCTU.geometry}
                          height="300px"
                          fillColor={
                            selectedCTU.ctuData?.ctu_class === 'CITY' ? '#4A90E2' :
                            selectedCTU.ctuData?.ctu_class === 'TOWNSHIP' ? '#7ED321' :
                            '#F5A623'
                          }
                          outlineColor={
                            selectedCTU.ctuData?.ctu_class === 'CITY' ? '#4A90E2' :
                            selectedCTU.ctuData?.ctu_class === 'TOWNSHIP' ? '#7ED321' :
                            '#F5A623'
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Mark as Primary Button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        // TODO: Implement mark as primary functionality
                        console.log('Mark as primary:', selectedCTU);
                        setShowCTUDetailsPopup(false);
                        setSelectedCTU(null);
                        onClose();
                        setStep(1);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors"
                    >
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

