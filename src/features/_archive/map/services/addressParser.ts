// Address parsing service for Mapbox features
import { Address, MapboxFeature } from '../types';

export class AddressParser {
  private static trim(v?: string) { return (v ?? '').trim(); }
  private static upper2(v?: string) { return this.trim(v).toUpperCase(); }

  /**
   * Parse a Mapbox feature into a standardized Address object
   */
  static parseMapboxFeature(feature: MapboxFeature): Pick<Address, 'street' | 'city' | 'state' | 'zip'> {
    const p = feature?.properties ?? {};

    // Debug logging
    console.log('Parsing Mapbox feature:', {
      properties: p,
      context: feature?.context,
      text: feature?.text,
      place_name: feature?.place_name
    });

    // street - try multiple approaches to get the full address
    let street = '';
    
    // First try: extract from place_name (most complete address)
    if (feature?.place_name) {
      const placeName = feature.place_name;
      // Extract the first part before the first comma (usually the street address)
      const firstPart = placeName.split(',')[0];
      if (firstPart) {
        street = firstPart;
      }
    }
    // Second try: use the full address if available
    else if (p.address) {
      street = String(p.address);
    }
    // Third try: combine house number and street name
    else if (p.housenumber && p.street) {
      street = `${p.housenumber} ${p.street}`;
    }
    // Fourth try: use street name only
    else if (p.street) {
      street = String(p.street);
    }
    // Fifth try: use the main text property
    else if (feature?.text) {
      street = feature.text;
    }

    // city
    let city = '';
    const placeContext = feature?.context?.find((c) => String(c.id).startsWith('place'));
    if (placeContext) city = placeContext.text;
    else if (p.locality) city = String(p.locality);
    else if (p.city) city = String(p.city);

    // state
    let state = '';
    const regionContext = feature?.context?.find((c) => String(c.id).startsWith('region'));
    if (regionContext) state = regionContext.text;
    else if (p.region) state = String(p.region);
    else if (p.state) state = String(p.state);

    // zip
    let zip = '';
    const postcodeContext = feature?.context?.find((c) => String(c.id).startsWith('postcode'));
    if (postcodeContext) zip = postcodeContext.text;
    else if (p.postcode) zip = String(p.postcode);

    const result = {
      street: this.trim(street),
      city: this.trim(city),
      state: this.upper2(state),
      zip: this.trim(zip),
    };

    console.log('Parsed address result:', result);
    return result;
  }

  /**
   * Parse a raw address string into components
   * Avoids forcing fake ZIPs; prefers empty string over "00000".
   */
  static parseAddressString(addressString: string): Partial<Address> {
    const parts = addressString.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [street, city, stateZip] = parts;
      const m = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (m) {
        return { street, city, state: m[1].toUpperCase(), zip: m[2] };
      }
      return { street, city, state: stateZip.toUpperCase(), zip: '' };
    }

    if (parts.length === 2) {
      const [street, city] = parts;
      return { street, city, state: '', zip: '' };
    }

    if (parts.length === 1) {
      return { street: parts[0], city: '', state: '', zip: '' };
    }

    return { street: addressString };
  }

  /**
   * Format an address object to a string
   */
  static formatAddress(address: Address): string {
    const parts = [address.street, address.city, address.state, address.zip].map((p) => (p ?? '').trim()).filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Validate if an address has the minimum required fields
   */
  static isValidAddress(address: Partial<Address>): boolean {
    return Boolean(address.street && address.city && address.state);
  }

  /**
   * Create a fallback address from coordinates
   */
  static createFallbackAddress(coordinates: { lat: number; lng: number }): Address {
    return {
      street: 'Dropped Pin',
      city: '',
      state: '',
      zip: '',
      coordinates: { latitude: coordinates.lat, longitude: coordinates.lng },
    };
  }

  /** Optional helpers you can use elsewhere */
  static normalize(a: Partial<Address>): Address {
    return {
      street: this.trim(a.street || ''),
      city: this.trim(a.city || ''),
      state: this.upper2(a.state || ''),
      zip: this.trim(a.zip || ''),
      coordinates: a.coordinates ? {
        latitude: Number(a.coordinates.latitude),
        longitude: Number(a.coordinates.longitude),
      } : undefined,
    };
  }

  static makeAddressKey(a: Partial<Address>): string {
    const street = this.trim(a.street || '').toLowerCase();
    const city = this.trim(a.city || '').toLowerCase();
    const state = this.upper2(a.state || '');
    const zip = this.trim(a.zip || '');
    return `${street}|${city}|${state}|${zip}`;
  }
}
