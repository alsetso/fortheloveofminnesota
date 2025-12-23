// Session storage system - localStorage removed, will be replaced with Supabase
// This is a temporary stub implementation

import { NodeIdService } from '@/features/shared/services/nodeIdService';

export interface SessionData {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: number;
  lastAccessed: number;
  nodes: NodeData[];
  sessionId?: string; // MNSESSION ID
  activeUserFoundNodeId?: string; // Track which UserFoundNode is currently active
  locationTrackingActive: boolean; // Prevent multiple GPS tracking sessions
  metadata?: Record<string, unknown>;
  // Team-related fields
  isOwned?: boolean; // true if user owns this session, false if shared via team
  team?: {
    id: string;
    name: string;
    description?: string;
  };
  sharedAt?: number; // timestamp when session was shared with team
  sharedBy?: string; // user ID who shared the session
}

export interface NodeData {
  id: string;
  sessionId: string;
  userId: string;
  type: 'userFound' | 'start' | 'api-result' | 'people-result' | 'end';
  status: 'pending' | 'ready' | 'processing' | 'completed' | 'error';
  apiName?: string;
  title?: string;
  customTitle?: string;
  hasCompleted: boolean;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  coordinates?: string;
  addressData?: unknown;
  rawResponse?: unknown;
  parsedData?: unknown;
  personData?: unknown;
  metadata: unknown;
  errorMessage?: string;
  processingTimeMs?: number;
  
  // Legacy fields for compatibility
  address?: { 
    street: string; 
    city: string; 
    state: string; 
    zip: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  response?: unknown;
  personId?: string;
  
  // UserFoundNode specific fields
  payload?: {
    coords: { lat: number; lng: number };
    address?: { 
      street: string; 
      city: string; 
      state: string; 
      zip: string;
      coordinates?: { latitude: number; longitude: number };
    };
    locationHistory?: Array<{
      coords: { lat: number; lng: number };
      address?: { 
        street: string; 
        city: string; 
        state: string; 
        zip: string;
        coordinates?: { latitude: number; longitude: number };
      };
      timestamp: number;
    }>;
  };
  
  // Simplified 3-ID structure
  mnNodeId: string;                    // Internal node ID
  parentNodeId?: string;               // Parent node ID
  clickedEntityId?: string;            // Which entity triggered this node
  clickedEntityData?: unknown;         // The actual entity data that triggered this node
  
  // Legacy fields for compatibility
  childNodeIds?: string[];            // Child node IDs
  entityCount?: number;                // Number of entities
  relationshipType?: string;           // Type of relationship (e.g., 'parent', 'child')
}

// Simplified entity structure - only traceable entities get IDs
export interface EntityData {
  mnEntityId?: string;        // Only for traceable entities (has Trace/Intel button)
  parentNodeId: string;       // The node that created this entity
  type: 'person' | 'address' | 'phone' | 'email' | 'property';
  category?: string;
  data: Record<string, unknown>;
  source: string;
  timestamp: number;
  isTraceable: boolean;       // Whether this entity has action buttons
}

export interface EntitySummary {
  total: number;
  addresses: number;
  persons: number;
  properties: number;
  phones: number;
  emails: number;
  images: number;
}

class SessionStorageService {
  // STUB IMPLEMENTATION - localStorage removed, will be replaced with Supabase
  
  // Get all sessions - STUB
  getSessions(): SessionData[] {
    console.warn('SessionStorageService.getSessions() - localStorage removed, returning empty array');
    return [];
  }

  // Get current session ID - STUB
  getCurrentSessionId(): string | null {
    console.warn('SessionStorageService.getCurrentSessionId() - localStorage removed, returning null');
    return null;
  }

  // Get current session - STUB
  getCurrentSession(): SessionData | null {
    console.warn('SessionStorageService.getCurrentSession() - localStorage removed, returning null');
    return null;
  }

  // Create new session - STUB
  createSession(name?: string): SessionData {
    console.warn('SessionStorageService.createSession() - localStorage removed, returning stub session');
    return {
      id: `stub-session-${Date.now()}`,
      name: name || 'Stub Session',
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      nodes: [],
      sessionId: NodeIdService.generateTypedId('session'),
      locationTrackingActive: false,
      isActive: true,
    };
  }

  // Set current session - STUB
  setCurrentSession(_sessionId: string): void {
    console.warn('SessionStorageService.setCurrentSession() - localStorage removed, no-op');
  }

  // Add node to current session - STUB
  addNode(_node: NodeData): void {
    console.warn('SessionStorageService.addNode() - localStorage removed, no-op');
  }

  // Get nodes from current session - STUB
  getNodes(): NodeData[] {
    console.warn('SessionStorageService.getNodes() - localStorage removed, returning empty array');
    return [];
  }

  // Load session nodes - STUB
  loadSession(_sessionId: string): NodeData[] {
    console.warn('SessionStorageService.loadSession() - localStorage removed, returning empty array');
    return [];
  }

  // Rename session - STUB
  renameSession(_sessionId: string, _newName: string): void {
    console.warn('SessionStorageService.renameSession() - localStorage removed, no-op');
  }

  // Delete session - STUB
  deleteSession(_sessionId: string): void {
    console.warn('SessionStorageService.deleteSession() - localStorage removed, no-op');
  }

  // Update node title - STUB
  updateNodeTitle(_nodeId: string, _customTitle: string): void {
    console.warn('SessionStorageService.updateNodeTitle() - localStorage removed, no-op');
  }

  // Auto-update node title - STUB
  autoUpdateNodeTitle(_nodeId: string): void {
    console.warn('SessionStorageService.autoUpdateNodeTitle() - localStorage removed, no-op');
  }

  // Update node data - STUB
  updateNodeData(_nodeId: string, _updates: Partial<NodeData>): void {
    console.warn('SessionStorageService.updateNodeData() - localStorage removed, no-op');
  }

  // Update UserFoundNode - STUB
  updateUserFoundNode(_nodeId: string, _coords: { lat: number; lng: number }, _address?: { street: string; city: string; state: string; zip: string; coordinates?: { latitude: number; longitude: number } }): void {
    console.warn('SessionStorageService.updateUserFoundNode() - localStorage removed, no-op');
  }

  // Complete UserFoundNode - STUB
  completeUserFoundNode(_nodeId: string): void {
    console.warn('SessionStorageService.completeUserFoundNode() - localStorage removed, no-op');
  }

  // Create new UserFoundNode - STUB
  createNewUserFoundNode(): NodeData | null {
    console.warn('SessionStorageService.createNewUserFoundNode() - localStorage removed, returning null');
    return null;
  }

  // Start location tracking - STUB
  startLocationTracking(): boolean {
    console.warn('SessionStorageService.startLocationTracking() - localStorage removed, returning false');
    return false;
  }
  
  // Stop location tracking - STUB
  stopLocationTracking(): void {
    console.warn('SessionStorageService.stopLocationTracking() - localStorage removed, no-op');
  }
  
  // Get active UserFoundNode - STUB
  getActiveUserFoundNode(): NodeData | null {
    console.warn('SessionStorageService.getActiveUserFoundNode() - localStorage removed, returning null');
    return null;
  }

  // Delete node - STUB
  deleteNode(_nodeId: string): void {
    console.warn('SessionStorageService.deleteNode() - localStorage removed, no-op');
  }

  // Get entity summary - STUB
  getEntitySummary(): EntitySummary {
    console.warn('SessionStorageService.getEntitySummary() - localStorage removed, returning empty summary');
    return { total: 0, addresses: 0, persons: 0, properties: 0, phones: 0, emails: 0, images: 0 };
  }

  // Get all entities - STUB
  getAllEntities(): Array<{ mnEntityId: string; type: string; parentNodeId: string; data: Record<string, unknown> }> {
    console.warn('SessionStorageService.getAllEntities() - localStorage removed, returning empty array');
    return [];
  }

  // Get actionable entities - STUB
  getActionableEntities(): { addresses: number; persons: number } {
    console.warn('SessionStorageService.getActionableEntities() - localStorage removed, returning zeros');
    return { addresses: 0, persons: 0 };
  }

  // Clear corrupted data - STUB
  clearCorruptedData(): void {
    console.warn('SessionStorageService.clearCorruptedData() - localStorage removed, no-op');
  }
}

export const sessionStorageService = new SessionStorageService();
