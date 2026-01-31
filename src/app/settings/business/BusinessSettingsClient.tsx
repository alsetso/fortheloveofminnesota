'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useAuthStateSafe } from '@/features/auth';
import InlineMap from '@/components/map/InlineMap';
import { PhotoIcon } from '@heroicons/react/24/outline';

interface BusinessFormData {
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

export default function BusinessSettingsClient() {
  const { account } = useSettings();
  const { user } = useAuthStateSafe();
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
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Business Plan</h3>
        <p className="text-xs text-gray-600">
          Connect your business with Minnesota. Verified profiles and statewide visibility.
        </p>
        {account.plan === 'business' && (
          <div className="mt-2">
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded-full">
              Current Plan
            </span>
          </div>
        )}
      </div>

      {/* Warning Banner */}
      <div className="bg-white border border-yellow-200 rounded-md p-[10px] bg-yellow-50">
        <p className="text-xs text-yellow-800 font-medium">
          Business account signups are currently disabled. Please check back later.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Logo Upload */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <label className="text-xs font-medium text-gray-900">
            Business Logo
          </label>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                {formData.logoUrl ? (
                  <Image
                    src={formData.logoUrl}
                    alt="Business logo"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized={formData.logoUrl.includes('supabase.co')}
                  />
                ) : (
                  <PhotoIcon className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {/* Hover Overlay */}
              <div
                onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
              >
                {uploadingLogo ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PhotoIcon className="w-3 h-3 text-white" />
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
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">
                Click to upload or edit your business logo
              </p>
              {logoError && (
                <p className="text-[10px] text-red-600 mt-0.5">{logoError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Business Name */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <label htmlFor="businessName" className="text-xs font-medium text-gray-900">
            Business Name *
          </label>
          <input
            type="text"
            id="businessName"
            required
            value={formData.businessName}
            onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
            placeholder="Enter your business name"
            disabled={true}
          />
        </div>

        {/* Description */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5">
          <label htmlFor="description" className="text-xs font-medium text-gray-900">
            Business Description *
          </label>
          <textarea
            id="description"
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-none bg-gray-100 cursor-not-allowed"
            placeholder="Describe your business and what you offer"
            disabled={true}
          />
        </div>

        {/* Contact Information */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="contactName" className="text-xs font-medium text-gray-900">
                Contact Name *
              </label>
              <input
                type="text"
                id="contactName"
                required
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
                placeholder="Your name"
                disabled={true}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-gray-900">
                Email *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
                placeholder="your@email.com"
                disabled={true}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-gray-900">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
                placeholder="(555) 123-4567"
                disabled={true}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="website" className="text-xs font-medium text-gray-900">
                Website
              </label>
              <input
                type="url"
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
                placeholder="https://yourwebsite.com"
                disabled={true}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <label className="text-xs font-medium text-gray-900">
            Business Location *
          </label>
          <p className="text-xs text-gray-500">
            Search for your address in the map or click on the map to set your location.
          </p>
          <div className="border border-gray-200 rounded-md overflow-hidden relative" style={{ height: '200px' }}>
            <InlineMap
              lat={formData.lat?.toString()}
              lng={formData.lng?.toString()}
              onLocationSelect={() => {}} // Disabled
            />
            <div className="absolute inset-0 bg-gray-100/50 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-gray-600 font-medium">Map selection disabled</p>
            </div>
          </div>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-gray-100 cursor-not-allowed"
            placeholder="Address will be filled when you select a location on the map"
            readOnly
            disabled={true}
          />
          {formData.lat && formData.lng && (
            <p className="text-[10px] text-gray-500">
              Coordinates: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <button
            type="submit"
            disabled={true}
            className="w-full px-2 py-1.5 text-xs font-medium text-white bg-gray-400 rounded-md transition-colors cursor-not-allowed"
          >
            Signups Currently Disabled
          </button>
        </div>

        {/* Terms Footer */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              All payments are final
            </div>
            <div className="text-xs text-gray-500">
              <a href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
