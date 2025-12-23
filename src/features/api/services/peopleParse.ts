// People parsing service for converting Skip Trace API responses into formatted person data
import { NodeIdService } from '@/features/shared/services/nodeIdService';

export interface PersonRecord {
  name: string;
  age?: number;
  lives_in?: string;
  used_to_live_in?: string;
  related_to?: string;
  person_link?: string;
  apiPersonId?: string;    // External API person ID (for API calls)
  source: string;
  mnEntityId?: string;     // Internal entity ID (only for traceable entities)
  parentNodeId: string;    // The node that created this entity
  isTraceable: boolean;    // Always true for persons (they have Trace button)
}

export interface SkipTracePersonDetail {
  Name?: string;
  Age?: number;
  "Lives in"?: string;
  "Used to live in"?: string;
  "Related to"?: string;
  Link?: string;
  "Person ID"?: string;
}

export interface SkipTracePeopleResponse {
  PeopleDetails?: SkipTracePersonDetail[];
  Source?: string;
}

export interface FormattedPeopleData {
  // Person Records
  people: PersonRecord[];
  
  // Summary counts
  totalRecords: number;
  
  // Raw data
  rawResponse: SkipTracePeopleResponse;
  source: string;
}

export const peopleParseService = {
  parsePeopleResponse(apiResponse: SkipTracePeopleResponse, parentNodeId: string): FormattedPeopleData {
    // Extract people from PeopleDetails array
    const people: PersonRecord[] = (apiResponse.PeopleDetails || []).map((person: SkipTracePersonDetail) => ({
      name: person.Name || '',
      age: person.Age || undefined,
      lives_in: person["Lives in"] || undefined,
      used_to_live_in: person["Used to live in"] || undefined,
      related_to: person["Related to"] || undefined,
      person_link: person.Link || undefined,
      apiPersonId: person["Person ID"] || undefined,    // External API ID
      source: apiResponse.Source || 'Unknown',
      mnEntityId: NodeIdService.generateEntityId({
        type: 'person',
        name: person.Name || '',
        apiPersonId: person["Person ID"] || undefined,
      }, parentNodeId), // Deterministic entity ID
      parentNodeId: parentNodeId,                      // The node that created this entity
      isTraceable: true                                // Persons are always traceable
    }));
    
    return {
      // Person Records
      people,
      
      // Summary counts
      totalRecords: people.length,
      
      // Raw data
      rawResponse: apiResponse,
      source: apiResponse.Source || 'Unknown'
    };
  }
};
