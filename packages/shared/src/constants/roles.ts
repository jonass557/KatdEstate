export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OWNER',
  'PROPERTY_MANAGER',
  'ACCOUNTANT',
  'AGENT',
  'TENANT',
  'NEIGHBORHOOD_LEADER',
  'BLOCK_LEADER',
  'RESIDENT',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Platform-level roles operate across tenants and are handled by a dedicated,
 * audited platform surface — never by an organization-scoped route.
 */
export const PLATFORM_ROLES = ['SUPER_ADMIN'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * Organization-scoped roles are the only ones assignable through a membership.
 * `SUPER_ADMIN` is deliberately excluded: it must never be granted via invite.
 */
export const ORGANIZATION_ROLES = [
  'ADMIN',
  'OWNER',
  'PROPERTY_MANAGER',
  'ACCOUNTANT',
  'AGENT',
  'TENANT',
  'NEIGHBORHOOD_LEADER',
  'BLOCK_LEADER',
  'RESIDENT',
] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrateur plateforme',
  ADMIN: 'Administrateur',
  OWNER: 'Propriétaire',
  PROPERTY_MANAGER: 'Gestionnaire immobilier',
  ACCOUNTANT: 'Comptable',
  AGENT: 'Agent immobilier',
  TENANT: 'Locataire',
  NEIGHBORHOOD_LEADER: 'Chef de quartier',
  BLOCK_LEADER: 'Chef de bloc',
  RESIDENT: 'Habitant / Résident',
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}
