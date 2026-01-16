/**
 * Address autocomplete API endpoint for Minnesota properties
 * Uses Mapbox Geocoding API for reliable address suggestions
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Request size limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const autocompleteQuerySchema = z.object({
  q: z.string().min(3).max(200),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      // Validate query parameters
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, autocompleteQuerySchema);
      if (!validation.success) {
        return validation.error;
      }
      
      const { q: query } = validation.data;

  try {
    // Use Mapbox Geocoding API (designed for autocomplete, has generous free tier)
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN;
    
    if (!mapboxToken) {
      console.warn('No Mapbox token found, using fallback suggestions');
      throw new Error('No Mapbox token configured');
    }

    // Mapbox bounding box for Minnesota: [west, south, east, north]
    const mnBounds = '-97.2,43.5,-89.5,49.4';
    
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `access_token=${mapboxToken}&` +
      `country=us&` +
      `bbox=${mnBounds}&` +
      `types=address&` +
      `limit=8&` +
      `autocomplete=true`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Mapbox API error:', response.status, response.statusText);
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Format Mapbox results
    const suggestions = (data.features || [])
      .filter((feature: { context?: Array<{ id?: string; short_code?: string; text?: string }> }) => {
        // Ensure the result is in Minnesota
        const context = feature.context || [];
        const stateContext = context.find((c) => c.id && c.id.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' || 
          stateContext.text === 'Minnesota'
        );
      })
      .map((feature: { 
        place_name?: string; 
        text?: string; 
        center?: [number, number]; 
        context?: Array<{ id?: string; text?: string }> 
      }) => {
        const context = feature.context || [];
        const place = context.find((c) => c.id && c.id.startsWith('place.'));
        const postcode = context.find((c) => c.id && c.id.startsWith('postcode.'));
        
        return {
          text: feature.place_name || feature.text || '',
          address: feature.place_name || feature.text || '',
          city: place?.text || '',
          state: 'MN',
          zipcode: postcode?.text || '',
          zpid: null,
          latitude: feature.center?.[1],
          longitude: feature.center?.[0]
        };
      })
      .slice(0, 8);
    
      return NextResponse.json({ suggestions });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching address autocomplete:', error);
      }
      
      // Fallback: Generate pattern-based suggestions for testing
      const patterns = [
        { prefix: '', cities: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'] },
        { prefix: 'Main', cities: ['Minneapolis', 'Saint Paul'] },
        { prefix: 'Oak', cities: ['Minneapolis', 'Rochester'] },
        { prefix: 'Lake', cities: ['Duluth', 'Minneapolis'] },
        { prefix: 'Park', cities: ['Saint Paul', 'Rochester'] }
      ];
      
      const queryLower = query.toLowerCase();
      const matchingPatterns = patterns.filter(p => 
        queryLower.includes(p.prefix.toLowerCase()) || p.prefix === ''
      );
      
      const fallbackSuggestions: Array<{
        text: string;
        address: string;
        city: string;
        state: string;
        zipcode: string;
        zpid: null;
      }> = [];
      
      matchingPatterns.forEach(pattern => {
        pattern.cities.forEach((city, idx) => {
          if (fallbackSuggestions.length < 8) {
            const streetNum = Math.floor(Math.random() * 9000) + 1000;
            const streets = ['Main St', 'Oak Ave', 'Lake St', 'Park Ave', 'Elm St'];
            const street = streets[idx % streets.length];
            const zips = ['55401', '55102', '55904', '55802', '55420'];
            const zip = zips[idx % zips.length];
            
            fallbackSuggestions.push({
              text: `${streetNum} ${street}, ${city}, MN ${zip}`,
              address: `${streetNum} ${street}, ${city}, MN ${zip}`,
              city: city,
              state: 'MN',
              zipcode: zip,
              zpid: null
            });
          }
        });
      });
      
      return NextResponse.json({ 
        suggestions: fallbackSuggestions.filter(s => 
          s.text.toLowerCase().includes(queryLower)
        ).slice(0, 8)
      });
    }
    },
    {
      rateLimit: 'public', // 100 requests/minute
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
