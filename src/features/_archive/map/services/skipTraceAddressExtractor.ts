import { NodeData } from '@/features/session/services/sessionStorage';

export interface SkipTraceAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  nodeId: string;
  apiName: string;
  timestamp: number | string;
  entityCount: number;
  rawResponse: unknown;
}

/**
 * Service to extract skip trace addresses from session nodes
 * This identifies nodes that contain skip trace API results with addresses
 */
export class SkipTraceAddressExtractor {
  /**
   * Extract all skip trace addresses from session nodes
   * @param nodes - Array of session nodes
   * @returns Array of skip trace addresses with coordinates
   */
  static extractSkipTraceAddresses(nodes: NodeData[]): SkipTraceAddress[] {
    const addresses: SkipTraceAddress[] = [];

    for (const node of nodes) {
      // Check if this is a skip trace API result node
      if (this.isSkipTraceNode(node)) {
        const address = this.extractAddressFromNode(node);
        if (address) {
          addresses.push(address);
        }
      }
    }

    return addresses;
  }

  /**
   * Check if a node is a skip trace result node
   * @param node - The node to check
   * @returns true if the node contains skip trace data
   */
  private static isSkipTraceNode(node: NodeData): boolean {
    return (
      node.type === 'api-result' &&
      node.apiName === 'Skip Trace' &&
      !!node.address &&
      !!node.response
    );
  }

  /**
   * Extract address information from a skip trace node
   * @param node - The skip trace node
   * @returns Skip trace address or null if invalid
   */
  private static extractAddressFromNode(node: NodeData): SkipTraceAddress | null {
    if (!node.address) {
      return null;
    }

    const address = node.address;
    
    // Validate required address fields
    if (!address.street || !address.city || !address.state || !address.zip) {
      return null;
    }

    // Extract entity count from response
    let entityCount = 0;
    if (node.response && typeof node.response === 'object') {
      const response = node.response as { totalEntities?: number; entities?: unknown[] };
      entityCount = response.totalEntities || response.entities?.length || 0;
    }

    return {
      id: `skip-trace-${node.id}`,
      street: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      coordinates: address.coordinates,
      nodeId: node.id,
      apiName: node.apiName || 'Skip Trace',
      timestamp: node.timestamp,
      entityCount,
      rawResponse: node.response,
    };
  }

  /**
   * Get skip trace addresses that have coordinates (ready for pin placement)
   * @param nodes - Array of session nodes
   * @returns Array of skip trace addresses with coordinates
   */
  static extractSkipTraceAddressesWithCoordinates(nodes: NodeData[]): SkipTraceAddress[] {
    return this.extractSkipTraceAddresses(nodes).filter(
      address => address.coordinates && 
      typeof address.coordinates.latitude === 'number' && 
      typeof address.coordinates.longitude === 'number'
    );
  }

  /**
   * Get skip trace addresses that need geocoding
   * @param nodes - Array of session nodes
   * @returns Array of skip trace addresses without coordinates
   */
  static extractSkipTraceAddressesNeedingGeocoding(nodes: NodeData[]): SkipTraceAddress[] {
    return this.extractSkipTraceAddresses(nodes).filter(
      address => !address.coordinates
    );
  }
}
