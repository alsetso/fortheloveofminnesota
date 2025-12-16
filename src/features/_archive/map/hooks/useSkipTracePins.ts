'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { NodeData } from '@/features/session/services/sessionStorage';
import { SkipTraceAddressExtractor, SkipTraceAddress } from '../services/skipTraceAddressExtractor';
import { useGeocoding } from './useGeocoding';
import { MAP_CONFIG } from '../config';
import { PersonRecord } from '@/features/api/services/peopleParse';

interface UseSkipTracePinsProps {
  nodes: NodeData[];
  addMarker: (id: string, coordinates: { lat: number; lng: number }, options?: { color?: string; element?: HTMLElement; popupContent?: string }) => void;
  removeMarker: (id: string) => void;
  mapLoaded: boolean;
  onPersonTrace?: (personId: string, personData: unknown, apiName: string, parentNodeId?: string, entityId?: string, entityData?: unknown) => void;
  updateMarkerPopup?: (id: string, popupContent: string) => void;
  sessionId?: string; // Add session ID to track session changes
}

interface UseSkipTracePinsReturn {
  skipTraceAddresses: SkipTraceAddress[];
  isLoading: boolean;
  restoreSkipTracePins: () => Promise<void>;
  clearSkipTracePins: () => void;
}

/**
 * Hook to manage skip trace pins on the map
 * Automatically restores pins when session nodes change
 */
export function useSkipTracePins({
  nodes,
  addMarker,
  removeMarker,
  mapLoaded,
  // onPersonTrace,
  sessionId,
}: UseSkipTracePinsProps): UseSkipTracePinsReturn {
  const [skipTraceAddresses, setSkipTraceAddresses] = useState<SkipTraceAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { geocodeAddress } = useGeocoding();

  // Store callback functions in refs to prevent infinite re-renders
  const addMarkerRef = useRef(addMarker);
  const removeMarkerRef = useRef(removeMarker);
  const geocodeAddressRef = useRef(geocodeAddress);
  const createSkipTracePopupRef = useRef<
    (address: SkipTraceAddress, peopleData: { people: PersonRecord[]; totalRecords: number }) => string
  >(() => "");
  const parseSkipTraceResponseRef = useRef<
    (rawResponse: unknown, nodeId: string) => { people: PersonRecord[]; totalRecords: number }
  >(() => ({ people: [], totalRecords: 0 }));
  const isRestoringRef = useRef(false);
  const lastNodesSignatureRef = useRef<string>("");

  // Update refs when callbacks change
  useEffect(() => {
    addMarkerRef.current = addMarker;
  }, [addMarker]);

  useEffect(() => {
    removeMarkerRef.current = removeMarker;
  }, [removeMarker]);

  useEffect(() => {
    geocodeAddressRef.current = geocodeAddress;
  }, [geocodeAddress]);

  // Keep helpers in refs so effects don't depend on their identities

  // Parse skip trace response to extract people data
  const parseSkipTraceResponse = useCallback((rawResponse: unknown, nodeId: string): { people: PersonRecord[]; totalRecords: number } => {
    try {
      const response = rawResponse as Record<string, unknown>;
      const people: PersonRecord[] = [];
      
      // Try to parse different response structures
      if (response.PeopleDetails && Array.isArray(response.PeopleDetails)) {
        // SkipTracePeopleResponse structure
        response.PeopleDetails.forEach((person: Record<string, unknown>) => {
          people.push({
            name: (person.Name as string) || '',
            age: (person.Age as number) || undefined,
            lives_in: (person["Lives in"] as string) || undefined,
            used_to_live_in: (person["Used to live in"] as string) || undefined,
            related_to: (person["Related to"] as string) || undefined,
            person_link: (person.Link as string) || undefined,
            apiPersonId: (person["Person ID"] as string) || undefined,
            source: typeof response.Source === 'string' ? response.Source : 'Unknown',
            mnEntityId: `person-${nodeId}-${people.length}`,
            parentNodeId: nodeId,
            isTraceable: true
          });
        });
      } else if (response["Person Details"] && Array.isArray(response["Person Details"])) {
        // SkipTracePersonDetailResponse structure
        response["Person Details"].forEach((person: Record<string, unknown>) => {
          people.push({
            name: (person.Person_name as string) || '',
            age: (person.Age as number) || undefined,
            lives_in: (person["Lives in"] as string) || undefined,
            source: typeof response.Source === 'string' ? response.Source : 'Unknown',
            mnEntityId: `person-${nodeId}-${people.length}`,
            parentNodeId: nodeId,
            isTraceable: true
          });
        });
        
        // Add relatives
        if (response["All Relatives"] && Array.isArray(response["All Relatives"])) {
          response["All Relatives"].forEach((relative: Record<string, unknown>) => {
            people.push({
              name: (relative.Name as string) || '',
              age: (relative.Age as number) || undefined,
              person_link: (relative["Person Link"] as string) || undefined,
              apiPersonId: (relative["Person ID"] as string) || undefined,
              source: typeof response.Source === 'string' ? response.Source : 'Unknown',
              mnEntityId: `relative-${nodeId}-${people.length}`,
              parentNodeId: nodeId,
              isTraceable: true
            });
          });
        }
        
        // Add associates
        if (response["All Associates"] && Array.isArray(response["All Associates"])) {
          response["All Associates"].forEach((associate: Record<string, unknown>) => {
            people.push({
              name: (associate.Name as string) || '',
              age: (associate.Age as number) || undefined,
              person_link: (associate["Person Link"] as string) || undefined,
              apiPersonId: (associate["Person ID"] as string) || undefined,
              source: typeof response.Source === 'string' ? response.Source : 'Unknown',
              mnEntityId: `associate-${nodeId}-${people.length}`,
              parentNodeId: nodeId,
              isTraceable: true
            });
          });
        }
      }
      
      return {
        people,
        totalRecords: people.length
      };
    } catch (error) {
      console.warn('Error parsing skip trace response:', error);
      return {
        people: [],
        totalRecords: 0
      };
    }
  }, []);

  // Create a custom popup with clickable person items and child node results
  const createSkipTracePopup = useCallback((address: SkipTraceAddress, peopleData: { people: PersonRecord[]; totalRecords: number }) => {
    // Find child nodes that were created from this address's people
    const childNodes = nodes.filter(node => 
      node.type === 'people-result' && 
      (node.parentNodeId === address.nodeId || 
       (node.clickedEntityId && peopleData.people.some(p => p.mnEntityId === node.clickedEntityId)))
    );

    // Create person list HTML with click handlers
    const personListHtml = peopleData.people.length > 0 
      ? peopleData.people.map((person) => {
          // Check if this person has child results
          const personChildNodes = childNodes.filter(node => 
            node.clickedEntityId === person.mnEntityId
          );
          const hasChildResults = personChildNodes.length > 0;
          
          return `<div class="px-2 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gold-50 person-item transition-colors" 
             data-person-id="${person.mnEntityId || ''}" 
             data-person-name="${person.name}" 
             data-person-data='${JSON.stringify(person)}'>
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">${person.name}</div>
                <div class="text-xs text-gray-500 mt-0.5">Click to trace</div>
              </div>
              ${hasChildResults ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">${personChildNodes.length}</span>` : ''}
            </div>
          </div>`;
        }).join('')
      : '<div class="text-xs text-gray-500 py-3 text-center">No person records found</div>';

    // Create child results section
    const childResultsHtml = childNodes.length > 0 
      ? childNodes.map(childNode => {
          // Use the structured entity data from person detail nodes
          const personData = childNode.personData as { entityCounts?: Record<string, number>; entities?: unknown[] };
          const entityCounts = personData?.entityCounts || {};
          // const entities = personData?.entities || [];
          
          // Extract person info from clickedEntityData (the original person data)
          const clickedEntityData = childNode.clickedEntityData as PersonRecord;
          const personName = clickedEntityData?.name || 'Unknown Person';
          const personAge = clickedEntityData?.age ? `, Age ${clickedEntityData.age}` : '';
          const personLivesIn = clickedEntityData?.lives_in ? `, Lives in ${clickedEntityData.lives_in}` : '';
          
          // Get entity summary
          const totalEntities = entityCounts.addresses + entityCounts.phones + entityCounts.emails + entityCounts.persons + entityCounts.properties + entityCounts.images;
          
          // Create entity breakdown
          const entityBreakdown = Object.entries(entityCounts)
            .filter(([, count]) => (count as number) > 0)
            .map(([type, count]) => `<span class="text-xs bg-gray-200 text-gray-700 px-1 rounded mr-1">${count} ${type}</span>`)
            .join('');
          
          return `
            <div class="px-2 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-green-50 child-result-item transition-colors" 
                 data-child-node-id="${childNode.id}" 
                 data-child-node-data='${JSON.stringify(childNode)}'>
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-900 mb-1 truncate">${personName}${personAge}${personLivesIn}</div>
                  <div class="text-xs text-gray-500 mb-1">${totalEntities} entities</div>
                  <div class="text-xs">${entityBreakdown}</div>
                </div>
                <div class="ml-1.5 text-xs text-gray-400 flex-shrink-0">View</div>
              </div>
            </div>
          `;
        }).join('')
      : '';

    const popupContent = `
      <style>
        .mapboxgl-popup-content {
          padding: 0 !important;
          margin: 0 !important;
        }
        .mapboxgl-popup-close-button {
          display: none !important;
        }
      </style>
      <div class="min-w-0 max-w-xs">
        <!-- Navigation Header -->
        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div class="flex items-center space-x-2 min-w-0">
            <div class="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
            <h3 class="text-sm font-semibold text-gray-800 truncate">Skip Trace Results</h3>
          </div>
          <button class="popup-close-btn p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors flex-shrink-0" title="Close">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Content Area -->
        <div class="p-3">
          <!-- Address Header -->
          <div class="mb-3">
            <div class="text-sm font-medium text-gray-800 mb-1">📍 Address</div>
            <div class="text-xs text-gray-700 mb-2">
              <div class="truncate">${address.street}</div>
              <div>${address.city}, ${address.state} ${address.zip}</div>
            </div>
            <div class="flex items-center space-x-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gold-100 text-gold-700">
                ${peopleData.totalRecords} person${peopleData.totalRecords !== 1 ? 's' : ''}
              </span>
              <span class="text-xs text-gray-500 truncate">${address.apiName}</span>
            </div>
          </div>

          <!-- People Accordion -->
          <div class="mb-3">
            <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 accordion-toggle transition-colors" data-target="people-list">
              <div class="text-sm font-medium text-gray-700 flex items-center min-w-0">
                <span class="mr-1.5">👥</span>
                <span class="truncate">People Found</span>
                <span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 flex-shrink-0">
                  ${peopleData.people.length}
                </span>
              </div>
              <svg class="w-4 h-4 text-gray-400 transform transition-transform accordion-icon flex-shrink-0" data-target="people-list" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            <div class="accordion-content hidden mt-1.5" data-target="people-list">
              <div class="border border-gray-200 rounded overflow-hidden">
                ${personListHtml}
              </div>
            </div>
          </div>

          <!-- Child Results Accordion -->
          ${childResultsHtml ? `
            <div class="mb-1">
              <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 accordion-toggle transition-colors" data-target="child-results">
                <div class="text-sm font-medium text-gray-700 flex items-center min-w-0">
                  <span class="mr-1.5">🔍</span>
                  <span class="truncate">Trace Results</span>
                  <span class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                    ${childNodes.length}
                  </span>
                </div>
                <svg class="w-4 h-4 text-gray-400 transform transition-transform accordion-icon flex-shrink-0" data-target="child-results" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              <div class="accordion-content hidden mt-1.5" data-target="child-results">
                <div class="border border-gray-200 rounded overflow-hidden">
                  ${childResultsHtml}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    return popupContent;
  }, [nodes]);

  // After callbacks are defined, sync refs to their latest implementations
  useEffect(() => {
    createSkipTracePopupRef.current = createSkipTracePopup;
  }, [createSkipTracePopup]);

  useEffect(() => {
    parseSkipTraceResponseRef.current = parseSkipTraceResponse;
  }, [parseSkipTraceResponse]);

  /**
   * Add a skip trace pin to the map
   */
  const addSkipTracePin = useCallback((address: SkipTraceAddress) => {
    if (!address.coordinates) return;

    const lat = address.coordinates.latitude;
    const lng = address.coordinates.longitude;

    // Validate coordinates
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      isNaN(lat) || isNaN(lng) ||
      !isFinite(lat) || !isFinite(lng)
    ) {
      console.warn('Invalid skip trace coordinates:', address.coordinates);
      return;
    }

    const coordinates = {
      lat,
      lng,
    };

    // Parse the response data the same way the node does
    const peopleData = parseSkipTraceResponseRef.current(address.rawResponse, address.nodeId);

    // Create popup content with clickable person items
    const popupContent = createSkipTracePopupRef.current(address, peopleData);

    // Create custom marker element - small purple circle with person count
    const markerElement = document.createElement('div');
    markerElement.className = 'skip-trace-marker';
    markerElement.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    `;

    // Create the purple circle
    const circle = document.createElement('div');
    circle.style.cssText = `
      width: 16px;
      height: 16px;
      background-color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      margin-bottom: 2px;
    `;

    // Create the person count text
    const countText = document.createElement('div');
    countText.textContent = peopleData.people.length.toString();
    countText.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
      text-align: center;
      line-height: 1;
      text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
      min-width: 8px;
    `;

    markerElement.appendChild(circle);
    markerElement.appendChild(countText);

    addMarkerRef.current(address.id, coordinates, {
      element: markerElement,
      popupContent,
    });
  }, []);


  /**
   * Restore skip trace pins from session nodes
   */
  const restoreSkipTracePins = useCallback(async () => {
    if (!mapLoaded) return;

    setIsLoading(true);
    try {
      // Extract skip trace addresses from nodes
      const addresses = SkipTraceAddressExtractor.extractSkipTraceAddresses(nodes);
      setSkipTraceAddresses(addresses);

      // Clear existing skip trace markers
      addresses.forEach(address => {
        removeMarkerRef.current(address.id);
      });

      // Process addresses with coordinates first
      const addressesWithCoords = addresses.filter(addr => addr.coordinates);
      addressesWithCoords.forEach(address => {
        addSkipTracePin(address);
      });

      // Geocode addresses without coordinates
      const addressesNeedingGeocoding = addresses.filter(addr => !addr.coordinates);
      for (const address of addressesNeedingGeocoding) {
        try {
          const geocodeResult = await geocodeAddressRef.current({
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip,
          });

          if (geocodeResult.success && geocodeResult.coordinates) {
            const addressWithCoords = {
              ...address,
              coordinates: geocodeResult.coordinates,
            };
            addSkipTracePin(addressWithCoords);
            
            // Update the address in state
            setSkipTraceAddresses(prev => 
              prev.map(addr => 
                addr.id === address.id ? addressWithCoords : addr
              )
            );
          }
        } catch (error) {
          console.warn(`Failed to geocode skip trace address: ${address.street}`, error);
        }
      }
    } catch (error) {
      console.error('Error restoring skip trace pins:', error);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, mapLoaded, addSkipTracePin]);

  /**
   * Clear all skip trace pins
   */
  const clearSkipTracePins = useCallback(() => {
    // Remove all markers first
    skipTraceAddresses.forEach(address => {
      removeMarkerRef.current(address.id);
    });
    // Then clear the state
    setSkipTraceAddresses([]);
  }, [skipTraceAddresses]);

  // Auto-restore pins when nodes change or when session changes
  useEffect(() => {
    if (!mapLoaded) return;

    const restorePins = async () => {
      // Prevent re-entrancy and no-op when nodes did not meaningfully change
      if (isRestoringRef.current) return;
      const signature = `${sessionId || "_"}|${nodes.map(n => n.id).join(',')}`;
      if (signature === lastNodesSignatureRef.current) return;
      isRestoringRef.current = true;
      lastNodesSignatureRef.current = signature;

      setIsLoading(true);
      try {
        // Extract skip trace addresses from nodes
        const addresses = SkipTraceAddressExtractor.extractSkipTraceAddresses(nodes);
        setSkipTraceAddresses(addresses);

        // Clear existing skip trace markers
        addresses.forEach(address => {
          removeMarkerRef.current(address.id);
        });

        // Process addresses with coordinates first
        const addressesWithCoords = addresses.filter(addr => addr.coordinates);
        addressesWithCoords.forEach(address => {
          // Inline the addSkipTracePin logic to avoid dependency issues
          if (!address.coordinates) return;

          const coordinates = {
            lat: address.coordinates.latitude,
            lng: address.coordinates.longitude,
          };

          // Parse the response data the same way the node does
          const peopleData = parseSkipTraceResponseRef.current(address.rawResponse, address.nodeId);

          // Create popup content with clickable person items
          const popupContent = createSkipTracePopupRef.current(address, peopleData);

          // Create custom marker element - small purple circle with person count
          const markerElement = document.createElement('div');
          markerElement.className = 'skip-trace-marker';
          markerElement.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transform: translate(-50%, -50%);
          `;

          // Create the purple circle
          const circle = document.createElement('div');
          circle.style.cssText = `
            width: 16px;
            height: 16px;
            background-color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            margin-bottom: 2px;
          `;

          // Create the person count text
          const countText = document.createElement('div');
          countText.textContent = peopleData.people.length.toString();
          countText.style.cssText = `
            font-size: 10px;
            font-weight: 600;
            color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
            text-align: center;
            line-height: 1;
            text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
            min-width: 8px;
          `;

          markerElement.appendChild(circle);
          markerElement.appendChild(countText);

          addMarkerRef.current(address.id, coordinates, {
            element: markerElement,
            popupContent,
          });
        });

        // Geocode addresses without coordinates
        const addressesNeedingGeocoding = addresses.filter(addr => !addr.coordinates);
        for (const address of addressesNeedingGeocoding) {
          try {
            const geocodeResult = await geocodeAddressRef.current({
              street: address.street,
              city: address.city,
              state: address.state,
              zip: address.zip,
            });

            if (geocodeResult.success && geocodeResult.coordinates) {
              const addressWithCoords = {
                ...address,
                coordinates: geocodeResult.coordinates,
              };
              
              // Inline the addSkipTracePin logic for geocoded addresses too
              const coordinates = {
                lat: addressWithCoords.coordinates.latitude,
                lng: addressWithCoords.coordinates.longitude,
              };

              const peopleData = parseSkipTraceResponseRef.current(addressWithCoords.rawResponse, addressWithCoords.nodeId);
              const popupContent = createSkipTracePopupRef.current(addressWithCoords, peopleData);

              const markerElement = document.createElement('div');
              markerElement.className = 'skip-trace-marker';
              markerElement.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                transform: translate(-50%, -50%);
              `;

              const circle = document.createElement('div');
              circle.style.cssText = `
                width: 16px;
                height: 16px;
                background-color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                margin-bottom: 2px;
              `;

              const countText = document.createElement('div');
              countText.textContent = peopleData.people.length.toString();
              countText.style.cssText = `
                font-size: 10px;
                font-weight: 600;
                color: ${MAP_CONFIG.MARKER_COLORS.SKIP_TRACE};
                text-align: center;
                line-height: 1;
                text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
                min-width: 8px;
              `;

              markerElement.appendChild(circle);
              markerElement.appendChild(countText);

              addMarkerRef.current(addressWithCoords.id, coordinates, {
                element: markerElement,
                popupContent,
              });
              
              // Update the address in state
              setSkipTraceAddresses(prev => 
                prev.map(addr => 
                  addr.id === address.id ? addressWithCoords : addr
                )
              );
            }
          } catch (error) {
            console.warn(`Failed to geocode skip trace address: ${address.street}`, error);
          }
        }
      } catch (error) {
        console.error('Error restoring skip trace pins:', error);
      } finally {
        setIsLoading(false);
        isRestoringRef.current = false;
      }
    };

    restorePins();
  }, [nodes, mapLoaded, sessionId]);

  // Note: Cleanup is handled by the component using this hook
  // No need for useEffect cleanup here as it causes infinite loops

  return {
    skipTraceAddresses,
    isLoading,
    restoreSkipTracePins,
    clearSkipTracePins,
  };
}
