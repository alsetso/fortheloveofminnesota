/**
 * Profile About — Discover identity types + display helpers (client-safe).
 */

import {
  PLACE_KIND_LABEL,
  type AccountPlaceKind,
} from '@/lib/accountPlaces/types';
import {
  SCHOOL_KIND_LABEL,
  type AccountSchoolKind,
} from '@/lib/accountSchools/types';
import { formatSchoolType } from '@/lib/schools/format';

export type ProfileAboutInterest = {
  id: string;
  name: string;
};

export type ProfileAboutPlace = {
  unit_id: string;
  name: string;
  kinds: AccountPlaceKind[];
  is_home: boolean;
  notify: boolean;
};

export type ProfileAboutSchool = {
  school_id: string;
  name: string;
  kinds: AccountSchoolKind[];
  notify: boolean;
  school_type: string | null;
  district_name: string | null;
  page_slug: string | null;
  lat: number | null;
  lng: number | null;
};

export type ProfileAboutDiscover = {
  interests: ProfileAboutInterest[];
  places: ProfileAboutPlace[];
  schools: ProfileAboutSchool[];
};

export function placeAboutEyebrow(place: ProfileAboutPlace): string {
  if (place.is_home) return 'Home';
  return place.kinds.map((k) => PLACE_KIND_LABEL[k]).join(' · ');
}

export function placeAboutSubtitle(place: ProfileAboutPlace, isSelf: boolean): string {
  if (isSelf && place.notify) return 'Post alerts on';
  return place.kinds.map((k) => PLACE_KIND_LABEL[k]).join(' · ');
}

export function schoolAboutEyebrow(school: ProfileAboutSchool): string {
  return school.kinds.map((k) => SCHOOL_KIND_LABEL[k]).join(' · ');
}

export function schoolAboutSubtitle(school: ProfileAboutSchool, isSelf: boolean): string {
  if (isSelf && school.notify) return 'Updates on';
  const type = formatSchoolType(school.school_type);
  if (type && school.district_name) return `${type} · ${school.district_name}`;
  return type ?? school.district_name ?? 'K–12 school';
}
