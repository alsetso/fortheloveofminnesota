'use client';

import { apiService } from './apiService';
import { NodeData } from '@/features/session/services/sessionStorage';
import { NodeIdService } from '@/features/shared/services/nodeIdService';

export interface NameSearchResult {
  success: boolean;
  node?: Partial<NodeData>;
  error?: string;
}

export class NameSearchService {
  /**
   * Centralized name search that creates a result node
   */
  static async searchName(
    name: { firstName: string; middleInitial?: string; lastName: string }
  ): Promise<NameSearchResult> {
    try {
      // Call the Skip Trace API
      const response = await apiService.callNameSearchAPI(name);

      // Create the result node
      const node: Partial<NodeData> = {
        id: `name-${Date.now()}`,
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
      console.error('Name search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Name search failed'
      };
    }
  }

  /**
   * Search name with toast notifications
   */
  static async searchNameWithToast(
    name: { firstName: string; middleInitial?: string; lastName: string },
    _sessionId: string,
    withApiToast: (title: string, fn: () => Promise<unknown>, options?: Record<string, unknown>) => Promise<unknown>
  ): Promise<NameSearchResult> {
    try {
      const result = await withApiToast(
        'Name Search',
        () => this.searchName(name),
        {
          loadingMessage: `Searching name: ${name.middleInitial ? `${name.firstName} ${name.middleInitial} ${name.lastName}` : `${name.firstName} ${name.lastName}`}`,
          successMessage: 'Name search completed successfully',
          errorMessage: 'Failed to search name'
        }
      );

      return result as NameSearchResult;
    } catch (error) {
      console.error('Name search with toast error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Name search failed'
      };
    }
  }
}
