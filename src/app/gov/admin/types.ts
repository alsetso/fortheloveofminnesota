export interface OrgRecord {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  website: string | null;
  created_at: string;
}

export interface PersonRecord {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface RoleRecord {
  id: string;
  person_id: string;
  org_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}

