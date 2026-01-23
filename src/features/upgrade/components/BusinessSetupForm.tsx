'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuthStateSafe } from '@/features/auth';
import InlineMap from '@/components/map/InlineMap';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface BusinessSetupFormProps {
  onBack: () => void;
  onSubmit?: (data: BusinessFormData) => void;
}

export interface BusinessFormData {
  businessName: string;
  description: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
}

export default function BusinessSetupForm({ onBack, onSubmit }: BusinessSetupFormProps) {
  const { user, account } = useAuthStateSafe();
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<BusinessFormData>({
    businessName: '',
    description: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    lat: null,
    lng: null,
    logoUrl: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setLogoError('You must be logged in to upload images');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Image must be smaller than 5MB');
      return;
    }

    setUploadingLogo(true);
    setLogoError(null);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/businesses/logo/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get image URL');
      }

      setFormData(prev => ({ ...prev, logoUrl: urlData.publicUrl }));
    } catch (err) {
      console.error('Error uploading logo:', err);
      setLogoError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    // Reverse geocode to get address
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (token) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address',
          limit: '1',
        });
        
        const response = await fetch(`${url}?${params}`);
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const address = data.features[0].place_name || '';
            setFormData(prev => ({
              ...prev,
              lat,
              lng,
              address,
            }));
            return;
          }
        }
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
    
    // If reverse geocoding fails, just set coordinates
    setFormData(prev => ({
      ...prev,
      lat,
      lng,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Business signups are disabled
    alert('Business account signups are currently disabled. Please check back later.');
    return;
    
    if (isSubmitting) return;

    // Validate location is selected
    if (!formData.lat || !formData.lng) {
      alert('Please select a location on the map');
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
      // Default: send email with business details
      const subject = 'Business Account Setup Request';
      const body = `Business Name: ${formData.businessName}\n\nDescription: ${formData.description}\n\nContact Name: ${formData.contactName}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nWebsite: ${formData.website}\n\nAddress: ${formData.address}\nLocation: ${formData.lat}, ${formData.lng}\nLogo URL: ${formData.logoUrl || 'Not provided'}`;
      window.location.href = `mailto:loveofminnesota@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
      console.error('Error submitting business setup:', error);
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
            <h1 className="text-sm font-semibold text-gray-900">Set up your Business account</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Share your business details and location to get started.
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
            Business account signups are currently disabled. Please check back later.
          </p>
        </div>

        {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Business Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                {formData.logoUrl ? (
                  <Image
                    src={formData.logoUrl}
                    alt="Business logo"
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized={formData.logoUrl.includes('supabase.co')}
                  />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              
              {/* Hover Overlay */}
              <div
                onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
              >
                {uploadingLogo ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PhotoIcon className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Hidden File Input */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={true}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">
                Click to upload or edit your business logo
              </p>
              {logoError && (
                <p className="text-xs text-red-500">{logoError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Business Name */}
        <div>
          <label htmlFor="businessName" className="block text-xs font-medium text-gray-700 mb-1.5">
            Business Name *
          </label>
          <input
            type="text"
            id="businessName"
            required
            value={formData.businessName}
            onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
            placeholder="Enter your business name"
            disabled={true}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1.5">
            Business Description *
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none bg-gray-100 cursor-not-allowed"
            placeholder="Describe your business and what you offer"
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

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Business Location *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Search for your address in the map or click on the map to set your location.
          </p>
          <div className="border border-gray-300 rounded overflow-hidden mb-2 relative" style={{ height: '300px' }}>
            <InlineMap
              lat={formData.lat?.toString()}
              lng={formData.lng?.toString()}
              onLocationSelect={() => {}} // Disabled
            />
            <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-600 font-medium">Map selection disabled</p>
            </div>
          </div>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-gray-100 cursor-not-allowed"
            placeholder="Address will be filled when you select a location on the map"
            readOnly
            disabled={true}
          />
          {formData.lat && formData.lng && (
            <p className="mt-1 text-xs text-gray-500">
              Coordinates: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
            </p>
          )}
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
