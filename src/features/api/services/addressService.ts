'use client';

import { apiService } from './apiService';
import { GeocodingService } from '@/features/_archive/map/services/geocodingService';
import { NodeData } from '@/features/session/services/sessionStorage';
import { MnudaIdService } from '@/features/shared/services/mnudaIdService';

export interface AddressSearchResult {
  success: boolean;
  node?: Partial<NodeData>;
  error?: string;
}

export class AddressService {
  /**
   * Centralized address search that creates a result node
   */
  static async searchAddress(
    address: { street: string; city: string; state: string; zip: string }
  ): Promise<AddressSearchResult> {
    try {
      // Geocode the address first to get coordinates
      const geocodingResult = await GeocodingService.geocodeAddress(address);
      const addressWithCoordinates = {
        ...address,
        coordinates: geocodingResult.success ? geocodingResult.coordinates : undefined,
      };

      // Call the Skip Trace API
      console.log('AddressService - Calling Skip Trace API with address:', address);
      const response = await apiService.callSkipTraceAPI(address);
      console.log('AddressService - Skip Trace API response:', response);

      // Create the result node
      const node: Partial<NodeData> = {
        id: `api-${Date.now()}`,
        type: 'api-result',
        address: addressWithCoordinates,
        apiName: 'Skip Trace',
        response,
        timestamp: new Date().toISOString(),
        mnNodeId: MnudaIdService.generateTypedId('node'),
      };

      console.log('AddressService - Created node:', node);
      return {
        success: true,
        node
      };
    } catch (error) {
      console.error('Address search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Address search failed'
      };
    }
  }

  /**
   * Search address with toast notifications
   */
  static async searchAddressWithToast(
    address: { street: string; city: string; state: string; zip: string },
    _sessionId: string,
    withApiToast: (title: string, fn: () => Promise<unknown>, options?: Record<string, unknown>) => Promise<unknown>
  ): Promise<AddressSearchResult> {
    try {
      const result = await withApiToast(
        'Skip Trace Address Search',
        () => this.searchAddress(address),
        {
          loadingMessage: `Searching address: ${address.street}, ${address.city}, ${address.state} ${address.zip}`,
          successMessage: 'Address search completed successfully',
          errorMessage: 'Failed to search address'
        }
      );

      return result as AddressSearchResult;
    } catch (error) {
      console.error('Address search with toast error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Address search failed'
      };
    }
  }
}
