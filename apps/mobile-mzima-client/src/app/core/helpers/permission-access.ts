const PRIVILEGED_PERMISSIONS = [
  'Manage Posts',
  'Manage Users',
  'Manage Settings',
  'Bulk Data Import and Export',
  'Manage Collections and Saved Searches',
  'Edit their own posts',
  'Edit Their Own Posts',
  'Delete Posts',
  'Delete Their Own Posts',
];

export const SUBMIT_POSTS_PERMISSION = 'Submit Posts';
export const FIELD_MONITOR_ROLE = 'field_monitor';
export const SAFERWORLD_STAFF_ROLE = 'saferworld_staff';
export const SAFERWORLD_PARTNER_ROLE = 'saferworld_partner';

export function isFieldMonitor(role?: string | null): boolean {
  return role === FIELD_MONITOR_ROLE;
}

export function isSaferworldPartner(role?: string | null): boolean {
  return role === SAFERWORLD_PARTNER_ROLE;
}

export function normalizePermissions(permissions: string[] | string | null | undefined): string[] {
  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (typeof permissions === 'string') {
    return permissions
      .split(',')
      .map((permission) => permission.trim())
      .filter(Boolean);
  }

  return [];
}

export function hasPermission(
  permissions: string[] | string | null | undefined,
  permission: string,
): boolean {
  return normalizePermissions(permissions).includes(permission);
}

export function isSubmitOnlyUser(
  permissions: string[] | string | null | undefined,
  role?: string | null,
): boolean {
  const normalizedPermissions = normalizePermissions(permissions);

  return (
    role !== 'admin' &&
    normalizedPermissions.includes(SUBMIT_POSTS_PERMISSION) &&
    !PRIVILEGED_PERMISSIONS.some((permission) => normalizedPermissions.includes(permission))
  );
}

export function shouldScopePostsToCurrentUser(
  permissions: string[] | string | null | undefined,
  role?: string | null,
): boolean {
  if (role === 'admin' || role === SAFERWORLD_STAFF_ROLE) {
    return false;
  }

  return isFieldMonitor(role) || isSaferworldPartner(role) || isSubmitOnlyUser(permissions, role);
}
