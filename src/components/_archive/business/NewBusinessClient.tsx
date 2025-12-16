'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';
import { Account } from '@/features/auth';
import { ImageUpload } from '@/features/ui/components/ImageUpload';
import CategoryAutocomplete from '@/features/ui/components/CategoryAutocomplete';

interface NewBusinessClientProps {
  initialAccount: Account | null;
}

interface City {
  id: string;
  name: string;
}

export default function NewBusinessClient({ initialAccount }: NewBusinessClientProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cities for service areas
  useEffect(() => {
    const loadCities = async () => {
      setIsLoadingCities(true);
      try {
        const { data, error } = await supabase
          .from('cities')
          .select('id, name')
          .order('name', { ascending: true })
          .limit(1000);

        if (error) throw error;
        setCities(data || []);
      } catch (err) {
        console.error('Error loading cities:', err);
      } finally {
        setIsLoadingCities(false);
      }
    };

    loadCities();
  }, []);

  // Geocode address when address changes
  useEffect(() => {
    if (!address.trim()) {
      setLat(null);
      setLng(null);
      return;
    }

    const geocodeAddress = async () => {
      try {
        const response = await fetch(`/api/geocode/autocomplete?query=${encodeURIComponent(address)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.suggestions && data.suggestions.length > 0) {
            const first = data.suggestions[0];
            if (first.lat && first.lng) {
              setLat(first.lat);
              setLng(first.lng);
            }
          }
        }
      } catch (err) {
        // Silently fail - coordinates are optional
        console.error('Geocoding error:', err);
      }
    };

    const timeoutId = setTimeout(geocodeAddress, 500);
    return () => clearTimeout(timeoutId);
  }, [address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Page name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to register a business');
        return;
      }

      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          category_id: categoryId,
          address: address.trim() || null,
          lat,
          lng,
          email: email.trim() || null,
          phone: phone.trim() || null,
          hours: hours.trim() || null,
          service_areas: selectedCities.length > 0 ? selectedCities : null,
          logo_url: logoUrl || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to register business');
      }

      const data = await response.json();
      // Redirect to the new business detail page
      router.push(`/page/${data.business.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register business');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCity = (cityId: string) => {
    setSelectedCities((prev) =>
      prev.includes(cityId)
        ? prev.filter((id) => id !== cityId)
        : [...prev, cityId]
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-[10px]">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-[10px] bg-red-50 border border-red-200 rounded-md text-red-800 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Logo Upload */}
          <div className="md:col-span-2">
            <ImageUpload
              value={logoUrl}
              onChange={(url) => setLogoUrl(typeof url === 'string' ? url : null)}
              bucket="logos"
              table="businesses"
              column="logo_url"
              label="Page Logo"
              className="mb-3"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="name" className="block text-xs font-medium text-gray-900">
              Page Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 text-xs text-gray-600"
              placeholder="Enter business name"
            />
          </div>

          <div className="space-y-1.5">
            <CategoryAutocomplete
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Search for a category (e.g., Developer, Contractor, Realtor)"
              label="Category"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="address" className="block text-xs font-medium text-gray-900">
              Page Address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full business address"
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 text-xs text-gray-600"
            />
            {lat && lng && (
              <p className="text-[10px] text-gray-500">
                Coordinates detected: {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="block text-xs font-medium text-gray-900">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 text-xs text-gray-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium text-gray-900">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@business.com"
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 text-xs text-gray-600"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label htmlFor="hours" className="block text-xs font-medium text-gray-900">
              Page Hours
            </label>
            <textarea
              id="hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g., Mon-Fri: 9am-5pm&#10;Sat: 10am-2pm&#10;Sun: Closed"
              rows={4}
              className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 text-xs text-gray-600"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-medium text-gray-900">
              Service Areas (Cities)
            </label>
            {isLoadingCities ? (
              <p className="text-xs text-gray-500 py-2">Loading cities...</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-[10px] bg-gray-50">
                <div className="space-y-0.5">
                  {cities.map((city) => (
                    <label
                      key={city.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-[10px] rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city.id)}
                        onChange={() => toggleCity(city.id)}
                        className="rounded border-gray-300 text-gray-900 focus:border-gray-900 w-3 h-3"
                      />
                      <span className="text-xs text-gray-600">{city.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {selectedCities.length > 0 && (
              <p className="text-xs text-gray-500">
                {selectedCities.length} city{selectedCities.length !== 1 ? 'ies' : 'y'} selected
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-[10px] bg-gray-900 text-white font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Registering...
              </>
            ) : (
              <>
                <CheckIcon className="w-3 h-3" />
                Register Page
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/business')}
            className="px-3 py-[10px] border border-gray-200 text-gray-600 font-medium rounded-md hover:bg-gray-50 transition-colors text-xs"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

