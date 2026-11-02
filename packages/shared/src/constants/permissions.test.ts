import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  hasAllPermissions,
  hasPermission,
  isPermission,
  permissionDomain,
  permissionsForRole,
  resolvePermissions,
} from './permissions.js';
import { ORGANIZATION_ROLES, ROLES, isOrganizationRole, isRole } from './roles.js';

describe('permission catalogue', () => {
  it('contains no duplicates', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('uses the domain.action convention', () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/);
    }
  });

  it('derives the domain from a permission', () => {
    expect(permissionDomain('properties.create')).toBe('properties');
    expect(permissionDomain('payments.refund')).toBe('payments');
  });

  it('validates permission strings', () => {
    expect(isPermission('payments.refund')).toBe(true);
    expect(isPermission('payments.explode')).toBe(false);
  });
});

describe('role mapping', () => {
  it('maps every role to a permission set', () => {
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('only maps known permissions', () => {
    for (const role of ROLES) {
      for (const permission of permissionsForRole(role)) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it('grants SUPER_ADMIN the full catalogue', () => {
    expect(permissionsForRole('SUPER_ADMIN')).toHaveLength(PERMISSIONS.length);
  });

  it('never lets a TENANT perform privileged operations', () => {
    const tenant = permissionsForRole('TENANT');
    expect(hasPermission(tenant, 'users.manage')).toBe(false);
    expect(hasPermission(tenant, 'payments.refund')).toBe(false);
    expect(hasPermission(tenant, 'properties.delete')).toBe(false);
    expect(hasPermission(tenant, 'settings.manage')).toBe(false);
  });

  it('keeps platform roles out of organization memberships', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(isOrganizationRole(role)).toBe(true);
      expect(isRole(role)).toBe(true);
    }
    expect(isOrganizationRole('SUPER_ADMIN')).toBe(false);
  });
});

describe('resolvePermissions', () => {
  it('adds extra grants and removes revoked permissions', () => {
    const resolved = resolvePermissions('TENANT', {
      granted: ['maintenance.manage'],
      revoked: ['messages.send'],
    });
    expect(hasPermission(resolved, 'maintenance.manage')).toBe(true);
    expect(hasPermission(resolved, 'messages.send')).toBe(false);
  });

  it('always returns the full catalogue for SUPER_ADMIN', () => {
    const resolved = resolvePermissions('SUPER_ADMIN', { revoked: PERMISSIONS });
    expect(hasAllPermissions(resolved, PERMISSIONS)).toBe(true);
  });
});
