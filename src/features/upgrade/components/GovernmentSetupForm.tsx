'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface GovernmentSetupFormProps {
  onBack: () => void;
  onSubmit?: (data: GovernmentFormData) => void;
}

export interface GovernmentFormData {
  organizationName: string;
  description: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  selectedCTU: CTUData | null;
}

export interface CTUData {
  id: string;
  ctu_class: string;
  feature_name: string;
  county_name: string;
  population?: number;
  acres?: number;
  gnis_feature_id?: string;
  county_code?: string;
}

export default function GovernmentSetupForm({ onBack, onSubmit }: GovernmentSetupFormProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCTU, setSelectedCTU] = useState<CTUData | null>(null);

  const [formData, setFormData] = useState<GovernmentFormData>({
    organizationName: '',
    description: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    selectedCTU: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token not configured');
      return;
    }

    const initMap = async () => {
      try {
        // Import Mapbox CSS
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapboxgl = await loadMapboxGL();
        
        // Set access token
        mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;
        
        if (!mounted || !mapContainer.current) return;

        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.MIN_ZOOM_MN,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        }) as MapboxMapInstance;

        map.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
          }
        });

        // Handle CTU click - DISABLED: Government signups are currently disabled
        // map.on('click', async (e: any) => {
        //   if (!mounted) return;
        //   // Signups disabled - do nothing
        // });

        mapInstance.current = map;
      } catch (err) {
        console.error('Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (err) {
          // Ignore
        }
        mapInstance.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Government signups are disabled
    alert('Government account signups are currently disabled. Please check back later.');
    return;
    
    if (isSubmitting) return;

    // Validate CTU is selected
    if (!formData.selectedCTU) {
      alert('Please select a CTU (City, Township, or Unorganized Territory) on the map');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        // TypeScript guard: onSubmit is defined here
        await onSubmit!(formData);
        setIsSubmitting(false);
        return;
      }
      // Default: send email with government details
      const subject = 'Government Account Setup Request';
      let ctuInfo = '';
      const selectedCTU = formData.selectedCTU;
      if (selectedCTU) {
        // TypeScript guard: selectedCTU is non-null here - use non-null assertion
        ctuInfo = `\n\nSelected CTU:\n- Name: ${selectedCTU!.feature_name}\n- Type: ${selectedCTU!.ctu_class}\n- County: ${selectedCTU!.county_name}\n- Population: ${selectedCTU!.population ?? 'N/A'}\n- Acres: ${selectedCTU!.acres ?? 'N/A'}`;
      }
      const body = `Organization Name: ${formData.organizationName}\n\nDescription: ${formData.description}\n\nContact Name: ${formData.contactName}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nWebsite: ${formData.website}${ctuInfo}`;
      window.location.href = `mailto:loveofminnesota@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
      console.error('Error submitting government setup:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Set up your Government admin account</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Select your CTU on the map and share your organization details.
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20">
        {/* Warning Banner */}
        <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-[10px] text-yellow-800 font-medium">
            Government account signups are currently disabled. Please check back later.
          </p>
        </div>

        {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CTU Selection Map */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Select CTU (City, Township, or Unorganized Territory) *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Click on a CTU boundary on the map to select it.
          </p>
          <div className="border border-gray-300 rounded overflow-hidden relative" style={{ height: '400px' }}>
            <div ref={mapContainer} className="w-full h-full" />
            <CTUBoundariesLayer
              map={mapInstance.current}
              mapLoaded={mapLoaded}
              visible={true}
            />
            <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-600 font-medium">Map selection disabled</p>
            </div>
          </div>
          {selectedCTU && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Selected CTU:</h3>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Name:</span> {selectedCTU.feature_name}</p>
                <p><span className="font-medium">Type:</span> {selectedCTU.ctu_class}</p>
                <p><span className="font-medium">County:</span> {selectedCTU.county_name}</p>
                {selectedCTU.population !== null && selectedCTU.population !== undefined && (
                  <p><span className="font-medium">Population:</span> {selectedCTU.population.toLocaleString()}</p>
                )}
                {selectedCTU.acres !== null && selectedCTU.acres !== undefined && (
                  <p><span className="font-medium">Acres:</span> {selectedCTU.acres.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Organization Name */}
        <div>
          <label htmlFor="organizationName" className="block text-xs font-medium text-gray-700 mb-1.5">
            Organization Name *
          </label>
          <input
            type="text"
            id="organizationName"
            required
            value={formData.organizationName}
            onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
            placeholder="Enter your organization name"
            disabled={true}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1.5">
            Organization Description *
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none bg-gray-100 cursor-not-allowed"
            placeholder="Describe your organization and its role"
            disabled={true}
          />
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contactName" className="block text-xs font-medium text-gray-700 mb-1.5">
              Contact Name *
            </label>
            <input
              type="text"
              id="contactName"
              required
              value={formData.contactName}
              onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
              placeholder="Your name"
              disabled={true}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
              Email *
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
              placeholder="your@email.com"
              disabled={true}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
              placeholder="(555) 123-4567"
              disabled={true}
            />
          </div>
          <div>
            <label htmlFor="website" className="block text-xs font-medium text-gray-700 mb-1.5">
              Website
            </label>
            <input
              type="url"
              id="website"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
              placeholder="https://yourwebsite.com"
              disabled={true}
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={true}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-400 rounded transition-colors cursor-not-allowed"
          >
            Signups Currently Disabled
          </button>
        </div>
      </form>

        {/* Floating Terms Footer */}
        <footer className="mt-6 pt-4 border-t border-gray-200">
          <div className="w-full flex items-center justify-between">
            <div className="text-xs text-gray-500">
              All payments are final
            </div>
            <div className="text-xs text-gray-500">
              <a href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
