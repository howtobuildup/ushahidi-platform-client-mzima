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
export const SAFERWORLD_PARTNER_ROLE = 'saferworld_partner';

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
