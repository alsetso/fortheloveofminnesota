// Person detail parsing service for extracting structured entities from person detail API responses

import { NodeIdService } from '@/features/shared/services/nodeIdService';

export interface PersonDetailEntity {
  type: 'property' | 'address' | 'phone' | 'email' | 'person' | 'image';
  category?: string;
  source: string;
  mnEntityId?: string;        // Only for traceable entities
  parentNodeId: string;       // The node that created this entity
  isTraceable: boolean;       // Whether this entity has action buttons
  [key: string]: unknown;
}

export interface PropertyEntity extends PersonDetailEntity {
  type: 'property';
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lot_size?: string;
  year_built?: number;
  property_type?: string;
  estimate?: number;
}

export interface AddressEntity extends PersonDetailEntity {
  type: 'address';
  category: 'current' | 'previous';
  street?: string;
  city?: string;
  state?: string;
  postal?: string;
  county?: string;
  date_range?: string;
  timespan?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface PhoneEntity extends PersonDetailEntity {
  type: 'phone';
  number?: string;
  phone_type?: string;
  last_reported?: string;
  provider?: string;
}

export interface EmailEntity extends PersonDetailEntity {
  type: 'email';
  email?: string;
}

export interface PersonEntity extends PersonDetailEntity {
  type: 'person';
  category?: 'relative' | 'associate' | 'resident';
  name?: string;
  age?: number;
  born?: string;
  lives_in?: string;
  telephone?: string;
  person_link?: string;
  person_id?: string;
  apiPersonId?: string;  // External API ID for tracing
}

export interface ImageEntity extends PersonDetailEntity {
  type: 'image';
  category: 'property_photo' | 'street_view';
  url?: string;
  caption?: string;
  order?: number;
}

// API Response Types
export interface AddressInfo {
  full?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface PropertyInfo {
  beds?: number;
  baths?: number;
  square_feet?: number;
  lot_size?: string;
  year_built?: number;
  type?: string;
}

export interface ZestimateInfo {
  amount?: number;
}

export interface CurrentAddressDetail {
  street_address?: string;
  address_locality?: string;
  address_region?: string;
  postal_code?: string;
  county?: string;
  date_range?: string;
}

export interface PreviousAddressDetail {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  county?: string;
  timespan?: string;
}

export interface PhoneDetail {
  phone_number?: string;
  phone_type?: string;
  last_reported?: string;
  provider?: string;
}

export interface PersonDetail {
  Person_name?: string;
  Age?: number;
  Born?: string;
  "Lives in"?: string;
  Telephone?: string;
}

export interface RelativeInfo {
  Name?: string;
  Age?: number;
  "Person Link"?: string;
  "Person ID"?: string;
}

export interface AssociateInfo {
  Name?: string;
  Age?: number;
  "Person Link"?: string;
  "Person ID"?: string;
}

export interface PhotoInfo {
  url?: string;
  caption?: string;
}

export interface SkipTracePersonDetailResponse {
  property?: PropertyInfo;
  address?: AddressInfo;
  zestimate?: ZestimateInfo;
  "Current Address Details List"?: CurrentAddressDetail[];
  "Previous Address Details"?: PreviousAddressDetail[];
  "All Phone Details"?: PhoneDetail[];
  "Email Addresses"?: string[];
  "Person Details"?: PersonDetail[];
  "All Relatives"?: RelativeInfo[];
  "All Associates"?: AssociateInfo[];
  photos?: PhotoInfo[];
  Source?: string;
}

export interface ParsedPersonDetailData {
  entities: PersonDetailEntity[];
  totalEntities: number;
  entityCounts: {
    properties: number;
    addresses: number;
    phones: number;
    emails: number;
    persons: number;
    images: number;
  };
  rawResponse: SkipTracePersonDetailResponse;
  source: string;
}

export const personDetailParseService = {
  parsePersonDetailResponse(apiResponse: SkipTracePersonDetailResponse, parentNodeId: string): ParsedPersonDetailData {
    const entities: PersonDetailEntity[] = [];

    // -------------------
    // Property Summary
    // -------------------
    if (apiResponse.property) {
      entities.push({
        type: "property",
        address: apiResponse.address?.full,
        city: apiResponse.address?.city,
        state: apiResponse.address?.state,
        zip: apiResponse.address?.postal_code,
        beds: apiResponse.property?.beds,
        baths: apiResponse.property?.baths,
        sqft: apiResponse.property?.square_feet,
        lot_size: apiResponse.property?.lot_size,
        year_built: apiResponse.property?.year_built,
        property_type: apiResponse.property?.type,
        estimate: apiResponse.zestimate?.amount,
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: false,  // Properties don't have action buttons
        mnEntityId: NodeIdService.generateEntityId({
          type: 'property',
          address: apiResponse.address?.full,
          city: apiResponse.address?.city,
          state: apiResponse.address?.state,
          zip: apiResponse.address?.postal_code
        }, parentNodeId)
      });
    }

    // -------------------
    // Current Addresses
    // -------------------
    (apiResponse["Current Address Details List"] || []).forEach((addr: CurrentAddressDetail) => {
        entities.push({
          type: "address",
          category: "current",
          street: addr.street_address,
          city: addr.address_locality,
          state: addr.address_region,
          postal: addr.postal_code,
          county: addr.county,
          date_range: addr.date_range,
          source: apiResponse.Source || 'Unknown',
          parentNodeId: parentNodeId,
          isTraceable: true,  // Addresses have Intel button
          mnEntityId: NodeIdService.generateEntityId({
            type: 'address',
            street: addr.street_address,
            city: addr.address_locality,
            state: addr.address_region,
            postal: addr.postal_code,
            category: 'current'
          }, parentNodeId)
        });
    });

    // -------------------
    // Previous Addresses
    // -------------------
    (apiResponse["Previous Address Details"] || []).forEach((addr: PreviousAddressDetail) => {
        entities.push({
          type: "address",
          category: "previous",
          street: addr.streetAddress,
          city: addr.addressLocality,
          state: addr.addressRegion,
          postal: addr.postalCode,
          county: addr.county,
          timespan: addr.timespan,
          source: apiResponse.Source || 'Unknown',
          parentNodeId: parentNodeId,
          isTraceable: true,  // Addresses have Intel button
          mnEntityId: NodeIdService.generateEntityId({
            type: 'address',
            street: addr.streetAddress,
            city: addr.addressLocality,
            state: addr.addressRegion,
            postal: addr.postalCode,
            category: 'previous'
          }, parentNodeId)
        });
    });

    // -------------------
    // Phones
    // -------------------
    (apiResponse["All Phone Details"] || []).forEach((ph: PhoneDetail) => {
      entities.push({
        type: "phone",
        number: ph.phone_number,
        phone_type: ph.phone_type,
        last_reported: ph.last_reported,
        provider: ph.provider,
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: false,  // Phones don't have action buttons
        mnEntityId: NodeIdService.generateEntityId({
          type: 'phone',
          number: ph.phone_number,
          phone_type: ph.phone_type
        }, parentNodeId)
      });
    });

    // -------------------
    // Emails
    // -------------------
    (apiResponse["Email Addresses"] || []).forEach((e: string) => {
      entities.push({
        type: "email",
        email: e,
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: false,  // Emails don't have action buttons
        mnEntityId: NodeIdService.generateEntityId({
          type: 'email',
          email: e
        }, parentNodeId)
      });
    });

    // -------------------
    // Persons / Residents
    // -------------------
    (apiResponse["Person Details"] || []).forEach((p: PersonDetail) => {
      entities.push({
        type: "person",
        category: "resident",
        name: p.Person_name,
        age: p.Age,
        born: p.Born,
        lives_in: p["Lives in"],
        telephone: p.Telephone,
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: true,  // Persons have Trace button
        mnEntityId: NodeIdService.generateEntityId({
          type: 'person',
          name: p.Person_name,
          category: 'resident'
        }, parentNodeId)
      });
    });

    // -------------------
    // Relatives
    // -------------------
    (apiResponse["All Relatives"] || []).forEach((r: RelativeInfo) => {
      entities.push({
        type: "person",
        category: "relative",
        name: r.Name,
        age: r.Age,
        person_link: r["Person Link"],
        apiPersonId: r["Person ID"],  // External API ID
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: true,  // Persons have Trace button
        mnEntityId: NodeIdService.generateEntityId({
          type: 'person',
          name: r.Name,
          apiPersonId: r["Person ID"],
          category: 'relative'
        }, parentNodeId)
      });
    });

    // -------------------
    // Associates
    // -------------------
    (apiResponse["All Associates"] || []).forEach((a: AssociateInfo) => {
      entities.push({
        type: "person",
        category: "associate",
        name: a.Name,
        age: a.Age,
        person_link: a["Person Link"],
        apiPersonId: a["Person ID"],  // External API ID
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: true,  // Persons have Trace button
        mnEntityId: NodeIdService.generateEntityId({
          type: 'person',
          name: a.Name,
          apiPersonId: a["Person ID"],
          category: 'associate'
        }, parentNodeId)
      });
    });

    // -------------------
    // Images
    // -------------------
    (apiResponse.photos || []).forEach((photo: PhotoInfo, idx: number) => {
      entities.push({
        type: "image",
        category: "property_photo",
        url: photo.url,
        caption: photo.caption || `Photo ${idx + 1}`,
        order: idx,
        source: apiResponse.Source || 'Unknown',
        parentNodeId: parentNodeId,
        isTraceable: false,  // Images don't have action buttons
        mnEntityId: NodeIdService.generateEntityId({
          type: 'image',
          url: photo.url,
          category: 'property_photo',
          order: idx
        }, parentNodeId)
      });
    });

    // Add Street View fallback if address exists
    if (apiResponse.address?.full) {
      entities.push({
        type: "image",
        category: "street_view",
        url: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(apiResponse.address.full)}`,
        caption: "Street View",
        order: 999,
        source: "Google Street View",
        parentNodeId: parentNodeId,
        isTraceable: false,  // Images don't have action buttons
        mnEntityId: NodeIdService.generateEntityId({
          type: 'image',
          category: 'street_view',
          address: apiResponse.address.full
        }, parentNodeId)
      });
    }

    // Count entities by type
    const entityCounts = {
      properties: entities.filter(e => e.type === 'property').length,
      addresses: entities.filter(e => e.type === 'address').length,
      phones: entities.filter(e => e.type === 'phone').length,
      emails: entities.filter(e => e.type === 'email').length,
      persons: entities.filter(e => e.type === 'person').length,
      images: entities.filter(e => e.type === 'image').length,
    };

    return {
      entities,
      totalEntities: entities.length,
      entityCounts,
      rawResponse: apiResponse,
      source: apiResponse.Source || 'Unknown'
    };
  }
};
