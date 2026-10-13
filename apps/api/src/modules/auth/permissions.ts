import type { Role } from './types.js';
const grants: Record<Role, readonly string[]> = {
  OWNER: ['sales:read', 'pos:read', 'sales:create', 'inventory:manage', 'categories:manage', 'settings:manage', 'users:manage', 'reports:read', 'dashboard:read', 'sales:void', 'audit:manage'],
  EMPLOYEE: ['sales:read', 'pos:read', 'sales:create', 'receipts:own'],
  ACCOUNTANT: ['reports:read', 'reports:export'],
};
export function permissionsFor(role: Role): string[] { return [...grants[role]]; }
