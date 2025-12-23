// Node ID Service for generating unique identifiers and managing relationships
// This service provides a foundation for tracking nodes and parsed data with unique IDs

export class NodeIdService {
  private static counter = 0;
  private static entityIdCache = new Map<string, string>(); // Cache for deterministic entity IDs

  // Generate a deterministic ID based on content hash
  static generateDeterministicId(prefix: 'MN' | 'MNSESSION' | 'MNENTITY', content: string): string {
    // Create a simple hash from the content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to positive 10-digit string
    const idDigits = Math.abs(hash).toString().padStart(10, '0');
    return `${prefix}${idDigits}`;
  }

  // Generate a 10-digit ID with specific prefix (for non-deterministic cases)
  static generateId(prefix: 'MN' | 'MNSESSION' | 'MNENTITY'): string {
    this.counter++;
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const counter = this.counter.toString().padStart(4, '0');
    return `${prefix}${timestamp}${counter}`;
  }

  // Generate ID for a specific type
  static generateTypedId(type: 'node' | 'entity' | 'session' | 'data'): string {
    switch (type) {
      case 'node': return this.generateId('MN');
      case 'entity': return this.generateId('MNENTITY');
      case 'session': return this.generateId('MNSESSION');
      case 'data': return this.generateId('MN');
      default: return this.generateId('MN');
    }
  }

  // Generate deterministic entity ID based on entity content
  static generateEntityId(entityData: Record<string, unknown>, parentNodeId: string): string {
    // Create a content string that uniquely identifies this entity
    const contentString = JSON.stringify({
      type: entityData.type,
      name: entityData.name || entityData.street || entityData.number || entityData.email,
      parentNodeId: parentNodeId,
      // Include key identifying fields
      ...(entityData.apiPersonId ? { apiPersonId: entityData.apiPersonId } : {}),
      ...(entityData.street ? { street: entityData.street } : {}),
      ...(entityData.city ? { city: entityData.city } : {}),
      ...(entityData.state ? { state: entityData.state } : {}),
    });
    
    // Check cache first
    if (this.entityIdCache.has(contentString)) {
      return this.entityIdCache.get(contentString)!;
    }
    
    // Generate deterministic ID
    const entityId = this.generateDeterministicId('MNENTITY', contentString);
    
    // Cache it
    this.entityIdCache.set(contentString, entityId);
    
    return entityId;
  }

  // Extract type from Node ID
  static getTypeFromId(nodeId: string): string | null {
    if (nodeId.startsWith('MNSESSION')) return 'session';
    if (nodeId.startsWith('MNENTITY')) return 'entity';
    if (nodeId.startsWith('MN')) return 'node';
    return null;
  }

  // Check if an ID is a Node ID
  static isNodeId(id: string): boolean {
    return id.startsWith('MN');
  }

  // Create parent-child relationship
  static createRelationship(parentId: string, childId: string): {
    parentNodeId: string;
    childNodeId: string;
  } {
    return {
      parentNodeId: parentId,
      childNodeId: childId,
    };
  }

  // Build relationship chain from entities
  static buildRelationshipChain(entities: Array<{ nodeId: string; parentNodeId?: string }>): Map<string, string[]> {
    const relationships = new Map<string, string[]>();
    
    entities.forEach(entity => {
      if (entity.parentNodeId) {
        if (!relationships.has(entity.parentNodeId)) {
          relationships.set(entity.parentNodeId, []);
        }
        relationships.get(entity.parentNodeId)!.push(entity.nodeId);
      }
    });
    
    return relationships;
  }

  // Find all children of a parent
  static findChildren(parentId: string, entities: Array<{ nodeId: string; parentNodeId?: string }>): string[] {
    return entities
      .filter(entity => entity.parentNodeId === parentId)
      .map(entity => entity.nodeId);
  }

  // Find all parents of a child (traces up the hierarchy)
  static findParents(childId: string, entities: Array<{ nodeId: string; parentNodeId?: string }>): string[] {
    const child = entities.find(entity => entity.nodeId === childId);
    if (!child || !child.parentNodeId) return [];
    
    return [child.parentNodeId, ...this.findParents(child.parentNodeId, entities)];
  }

  // Get relationship depth (how many levels deep)
  static getDepth(nodeId: string, entities: Array<{ nodeId: string; parentNodeId?: string }>): number {
    const parents = this.findParents(nodeId, entities);
    return parents.length;
  }

  // Validate relationship chain (check for circular references, missing parents, etc.)
  static validateRelationships(entities: Array<{ nodeId: string; parentNodeId?: string }>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const ids = new Set(entities.map(e => e.nodeId));

    entities.forEach(entity => {
      if (entity.parentNodeId && !ids.has(entity.parentNodeId)) {
        errors.push(`Entity ${entity.nodeId} references non-existent parent ${entity.parentNodeId}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Generate a batch of IDs (useful for bulk operations)
  static generateBatch(count: number, type: 'node' | 'entity' | 'session' | 'data' = 'data'): string[] {
    return Array.from({ length: count }, () => this.generateTypedId(type));
  }

  // Parse Node ID to get components
  static parseId(nodeId: string): {
    prefix: string;
    id: string;
    type: string;
  } | null {
    if (!this.isNodeId(nodeId)) return null;
    
    let prefix = '';
    let type = '';
    
    if (nodeId.startsWith('MNSESSION')) {
      prefix = 'MNSESSION';
      type = 'session';
    } else if (nodeId.startsWith('MNENTITY')) {
      prefix = 'MNENTITY';
      type = 'entity';
    } else if (nodeId.startsWith('MN')) {
      prefix = 'MN';
      type = 'node';
    }
    
    const id = nodeId.substring(prefix.length);
    
    return {
      prefix,
      id,
      type,
    };
  }
}
