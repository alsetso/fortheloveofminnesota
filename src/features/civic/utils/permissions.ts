/**
 * Civic Field Permissions
 * 
 * Determines which fields can be edited by community users vs admin-only
 */

export type CivicTable = 'agencies' | 'people' | 'roles' | 'buildings';

/**
 * Fields that community users can edit (wiki-style)
 */
const COMMUNITY_EDITABLE_FIELDS: Record<CivicTable, string[]> = {
  agencies: ['description', 'website'],
  people: ['photo_url', 'party', 'district', 'email', 'phone', 'address'],
  roles: ['title', 'start_date', 'end_date', 'is_current'],
  buildings: [],
};

/**
 * Fields that are admin-only (core structure fields)
 */
const ADMIN_ONLY_FIELDS: Record<CivicTable, string[]> = {
  agencies: ['id', 'name', 'slug', 'org_type', 'parent_id'],
  people: ['id', 'name', 'slug'],
  roles: ['id', 'person_id', 'agency_id'],
  buildings: ['id', 'name', 'slug'],
};

/**
 * Check if a field is editable by the current user
 * 
 * @param table - The civic table name
 * @param field - The field name to check
 * @param isAdmin - Whether the user is an admin
 * @returns true if the field can be edited
 */
export function isFieldEditable(
  table: CivicTable,
  field: string,
  isAdmin: boolean
): boolean {
  // Admins can edit everything
  if (isAdmin) return true;
  
  // Check if field is in admin-only list
  if (ADMIN_ONLY_FIELDS[table].includes(field)) {
    return false;
  }
  
  // Check if field is in community-editable list
  return COMMUNITY_EDITABLE_FIELDS[table].includes(field);
}

/**
 * Get all editable fields for a table
 */
export function getEditableFields(table: CivicTable, isAdmin: boolean): string[] {
  if (isAdmin) {
    // Admins can edit all fields except system fields
    const systemFields = ['id', 'created_at'];
    return Object.keys(COMMUNITY_EDITABLE_FIELDS[table])
      .concat(Object.keys(ADMIN_ONLY_FIELDS[table]))
      .filter(field => !systemFields.includes(field));
  }
  
  return COMMUNITY_EDITABLE_FIELDS[table];
}

/**
 * Get all admin-only fields for a table
 */
export function getAdminOnlyFields(table: CivicTable): string[] {
  return ADMIN_ONLY_FIELDS[table];
}

