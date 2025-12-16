// Address extraction service to parse all addresses from session data
import { NodeData } from '@/features/session/services/sessionStorage';
import { GeocodingService } from './geocodingService';

export interface ExtractedAddress {
  id: string;
  type: 'search' | 'current' | 'previous';
  street: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  source: string;
  nodeId: string;
  personId?: string;
  dateRange?: string;
  timespan?: string;
  county?: string;
}

export interface AddressSummary {
  total: number;
  search: number;
  current: number;
  previous: number;
  withCoordinates: number;
  addresses: ExtractedAddress[];
}

// ---------- helpers ----------
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const zipSafe = (v: unknown) => s(v);
const stateSafe = (v: unknown) => s(v).toUpperCase();
const citySafe = (v: unknown) => s(v);
const streetSafe = (v: unknown) => s(v);

const makeKey = (a: { street: string; city: string; state: string; zip: string }) =>
  `${a.street.toLowerCase()}|${a.city.toLowerCase()}|${a.state.toUpperCase()}|${a.zip}`;

const fmtFull = (street: string, city: string, state: string, zip: string) =>
  [street, city, state, zip].filter(Boolean).join(', ').replace(/\s+,/g, ',');

function pushIfValid(arr: ExtractedAddress[], item: Omit<ExtractedAddress, 'fullAddress'>) {
  const street = streetSafe(item.street);
  const city = citySafe(item.city);
  const state = stateSafe(item.state);
  const zip = zipSafe(item.zip);
  if (!street || !city || !state) return; // minimal fields
  arr.push({ ...item, street, city, state, zip, fullAddress: fmtFull(street, city, state, zip) });
}

// normalize personData arrays that may come in mixed shapes
function asArray<T = Record<string, unknown>>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  return [];
}

export class AddressExtractor {
  // Extract all addresses from session nodes
  static extractAllAddresses(nodes: NodeData[]): ExtractedAddress[] {
    const addresses: ExtractedAddress[] = [];

    for (const node of nodes) {
      // 1) Search/start nodes with node.address
      const nodeWithAddress = node as NodeData & { address?: { street?: string; city?: string; state?: string; zip?: string; coordinates?: { latitude: number; longitude: number } }; apiName?: string };
      if (nodeWithAddress.address) {
        const addr = nodeWithAddress.address;

        pushIfValid(addresses, {
          id: `search-${node.id}`,
          type: 'search',
          street: streetSafe(addr.street),
          city: citySafe(addr.city),
          state: stateSafe(addr.state),
          zip: zipSafe(addr.zip),
          coordinates: addr.coordinates,
          source: nodeWithAddress.apiName || 'start',
          nodeId: node.id,
        });
      }

      // 2) People nodes: current/previous address lists (two schema possibilities)
      const nodeWithPersonData = node as NodeData & { personData?: Record<string, unknown>; personId?: string };
      if (node.type === 'people-result' && nodeWithPersonData.personData) {
        const pd = nodeWithPersonData.personData;

        // "Current Address Details List" (snake-like keys)
        const currentList = asArray<Record<string, unknown>>(pd['Current Address Details List']);
        currentList.forEach((addr, index) => {
          const street = streetSafe(addr['street_address']);
          const city = citySafe(addr['address_locality']);
          const state = stateSafe(addr['address_region']);
          const zip = zipSafe(addr['postal_code']);
          if (!street || !city || !state) return;
          pushIfValid(addresses, {
            id: `current-${node.id}-${index}`,
            type: 'current',
            street,
            city,
            state,
            zip,
            coordinates: undefined,
            source: s(pd['Source']) || 'people-api',
            nodeId: node.id,
            personId: nodeWithPersonData.personId,
            dateRange: s(addr['date_range']),
            county: s(addr['county']),
          });
        });

        // "Previous Address Details" (camel-like keys)
        const prevList = asArray<Record<string, unknown>>(pd['Previous Address Details']);
        prevList.forEach((addr, index) => {
          const street = streetSafe(addr['streetAddress']);
          const city = citySafe(addr['addressLocality']);
          const state = stateSafe(addr['addressRegion']);
          const zip = zipSafe(addr['postalCode']);
          if (!street || !city || !state) return;
          pushIfValid(addresses, {
            id: `previous-${node.id}-${index}`,
            type: 'previous',
            street,
            city,
            state,
            zip,
            coordinates: undefined,
            source: s(pd['Source']) || 'people-api',
            nodeId: node.id,
            personId: nodeWithPersonData.personId,
            timespan: s(addr['timespan']),
            county: s(addr['county']),
          });
        });
      }
    }

    return addresses;
  }

  // Get address summary with counts
  static getAddressSummary(nodes: NodeData[]): AddressSummary {
    const addresses = this.extractAllAddresses(nodes);
    return {
      total: addresses.length,
      search: addresses.filter((a) => a.type === 'search').length,
      current: addresses.filter((a) => a.type === 'current').length,
      previous: addresses.filter((a) => a.type === 'previous').length,
      withCoordinates: addresses.filter((a) => a.coordinates).length,
      addresses,
    };
  }

  // Geocode addresses that don't have coordinates (deduped + key-mapped)
  static async geocodeMissingAddresses(addresses: ExtractedAddress[]): Promise<ExtractedAddress[]> {
    const missing = addresses.filter((a) => !a.coordinates);

    if (missing.length === 0) return addresses;

    // dedupe by canonical key
    const uniqueByKey = new Map<string, { street: string; city: string; state: string; zip: string }>();
    for (const a of missing) {
      const key = makeKey(a);
      if (!uniqueByKey.has(key)) {
        uniqueByKey.set(key, {
          street: a.street,
          city: a.city,
          state: a.state,
          zip: a.zip,
        });
      }
    }

    // batch geocode
    const payload = Array.from(uniqueByKey.values());
    const results = await GeocodingService.geocodeAddresses(payload);

    // map results back by key
    const keys = Array.from(uniqueByKey.keys());
    const coordByKey = new Map<string, { latitude: number; longitude: number } | undefined>();
    for (let i = 0; i < keys.length; i++) {
      const r = results[i];
      coordByKey.set(keys[i], r?.success ? r.coordinates : undefined);
    }

    // apply to originals
    return addresses.map((a) => {
      if (a.coordinates) return a;
      const key = makeKey(a);
      const coords = coordByKey.get(key);
      return coords ? { ...a, coordinates: coords } : a;
    });
  }

  // Get unique addresses (remove duplicates; prefer entries with coordinates)
  static getUniqueAddresses(addresses: ExtractedAddress[]): ExtractedAddress[] {
    const best = new Map<string, ExtractedAddress>();
    for (const a of addresses) {
      const key = makeKey(a);
      const curr = best.get(key);
      if (!curr) best.set(key, a);
      else if (!curr.coordinates && a.coordinates) best.set(key, a);
    }
    return Array.from(best.values());
  }

  // Filter addresses by type
  static filterAddressesByType(addresses: ExtractedAddress[], types: ('search' | 'current' | 'previous')[]): ExtractedAddress[] {
    return addresses.filter((a) => types.includes(a.type));
  }

  // Get addresses with coordinates only
  static getAddressesWithCoordinates(addresses: ExtractedAddress[]): ExtractedAddress[] {
    return addresses.filter((a) => a.coordinates);
  }

  // Get address statistics
  static getAddressStats(addresses: ExtractedAddress[]) {
    const stats = {
      total: addresses.length,
      byType: {
        search: addresses.filter((a) => a.type === 'search').length,
        current: addresses.filter((a) => a.type === 'current').length,
        previous: addresses.filter((a) => a.type === 'previous').length,
      },
      withCoordinates: addresses.filter((a) => a.coordinates).length,
      byState: {} as Record<string, number>,
      byCity: {} as Record<string, number>,
    };

    for (const a of addresses) {
      const state = a.state.toUpperCase();
      const city = a.city.toLowerCase();
      stats.byState[state] = (stats.byState[state] || 0) + 1;
      stats.byCity[city] = (stats.byCity[city] || 0) + 1;
    }

    return stats;
  }
}
