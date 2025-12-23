'use client';

import { apiService } from './apiService';
import { NodeData } from '@/features/session/services/sessionStorage';
import { NodeIdService } from '@/features/shared/services/nodeIdService';

export interface PhoneSearchResult {
  success: boolean;
  node?: Partial<NodeData>;
  error?: string;
}

export class PhoneSearchService {
  /**
   * Centralized phone search that creates a result node
   */
  static async searchPhone(
    phone: string
  ): Promise<PhoneSearchResult> {
    try {
      // Call the Skip Trace API
      const response = await apiService.callPhoneSearchAPI(phone);

      // Create the result node
      const node: Partial<NodeData> = {
        id: `phone-${Date.now()}`,
        type: 'api-result',
        apiName: 'Skip Trace',
        response,
        timestamp: new Date().toISOString(),
        mnNodeId: NodeIdService.generateTypedId('node'),
      };

      return {
        success: true,
        node
      };
    } catch (error) {
      console.error('Phone search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Phone search failed'
      };
    }
  }

  /**
   * Search phone with toast notifications
   */
  static async searchPhoneWithToast(
    phone: string,
    _sessionId: string,
    withApiToast: (title: string, fn: () => Promise<unknown>, options?: Record<string, unknown>) => Promise<unknown>
  ): Promise<PhoneSearchResult> {
    try {
      const result = await withApiToast(
        'Phone Search',
        () => this.searchPhone(phone),
        {
          loadingMessage: `Searching phone: ${phone}`,
          successMessage: 'Phone search completed successfully',
          errorMessage: 'Failed to search phone'
        }
      );

      return result as PhoneSearchResult;
    } catch (error) {
      console.error('Phone search with toast error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Phone search failed'
      };
    }
  }
}
