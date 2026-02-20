/**
 * Executive branch positions to seed in civic.roles (and people as needed).
 * Orgs already exist under Executive Branch; add people + roles for each.
 * Source of truth for "what role title" belongs to "which org" for display and backfill.
 */
export const EXECUTIVE_ORG_ROLE_TITLES: { orgSlug: string; roleTitle: string }[] = [
  { orgSlug: 'governor', roleTitle: 'Governor' },
  { orgSlug: 'governor', roleTitle: 'Lieutenant Governor' },
  { orgSlug: 'attorney-general', roleTitle: 'Attorney General' },
  { orgSlug: 'secretary-of-state', roleTitle: 'Secretary of State' },
  { orgSlug: 'state-auditor', roleTitle: 'State Auditor' },
  { orgSlug: 'dept-administration', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-agriculture', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-children-youth-families', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-commerce', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-corrections', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-direct-care-treatment', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-education', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-employment-economic-dev', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-health', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-human-rights', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-human-services', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-labor-industry', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-military-affairs', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-natural-resources', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-public-safety', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-revenue', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-transportation', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-veterans-affairs', roleTitle: 'Commissioner' },
  { orgSlug: 'dept-management-budget', roleTitle: 'Commissioner' },
];
