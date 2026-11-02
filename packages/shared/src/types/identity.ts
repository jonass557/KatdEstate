import type { Permission } from '../constants/permissions.js';
import type { Role } from '../constants/roles.js';
import type { MembershipStatus } from '../constants/statuses.js';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface MembershipSummary {
  organizationId: string;
  role: Role;
  permissions: readonly Permission[];
  status: MembershipStatus;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
}

/** Membership enrichie de l'organisation, telle que renvoyée par `/auth/me`. */
export interface MembershipWithOrganization extends MembershipSummary {
  organization: OrganizationSummary;
}

export interface AuthSession {
  user: UserSummary;
  memberships: MembershipWithOrganization[];
}

export interface AccessTokenClaims {
  /** Identifiant utilisateur. */
  sub: string;
  /** Identifiant unique du token (permet la révocation ciblée). */
  jti: string;
  /** Identifiant de session, pour tracer la famille de refresh tokens. */
  sid: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Durée de vie de l'access token, en secondes. */
  expiresIn: number;
  /**
   * Présent uniquement pour les clients non-navigateur. Les SPA reçoivent le
   * refresh token via un cookie `HttpOnly` et ne le voient jamais en clair.
   */
  refreshToken?: string;
}

export interface TenantSummary {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
}
