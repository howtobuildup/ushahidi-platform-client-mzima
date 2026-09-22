import {
  canViewDashboard,
  isFieldMonitor,
  isSaferworldPartner,
  isSubmitOnlyUser,
  shouldScopePostsToCurrentUser,
} from './permission-access';

describe('permission access helpers', () => {
  it('identifies the Saferworld partner role', () => {
    expect(isSaferworldPartner('saferworld_partner')).toBe(true);
    expect(isSaferworldPartner('field_monitor')).toBe(false);
  });

  it('does not treat partners as submit-only users', () => {
    expect(isSubmitOnlyUser([], 'saferworld_partner')).toBe(false);
  });

  it('identifies the field monitor role', () => {
    expect(isFieldMonitor('field_monitor')).toBe(true);
    expect(isFieldMonitor('saferworld_staff')).toBe(false);
  });

  it('scopes field monitors and partners to their own submissions', () => {
    expect(shouldScopePostsToCurrentUser([], 'field_monitor')).toBe(true);
    expect(shouldScopePostsToCurrentUser([], 'saferworld_partner')).toBe(true);
  });

  it('allows staff and administrators to view all submissions', () => {
    expect(shouldScopePostsToCurrentUser(['Submit Posts'], 'saferworld_staff')).toBe(false);
    expect(shouldScopePostsToCurrentUser(['Submit Posts'], 'admin')).toBe(false);
  });

  describe('canViewDashboard', () => {
    it('keeps field monitors out, so reporting is not turned into a score', () => {
      expect(canViewDashboard(['Submit Posts', 'Manage Posts'], 'field_monitor')).toBe(false);
    });

    it('lets staff and partners in', () => {
      expect(canViewDashboard(['Manage Posts'], 'saferworld_staff')).toBe(true);
      expect(canViewDashboard(['Manage Posts'], 'saferworld_partner')).toBe(true);
      expect(canViewDashboard(['Manage Posts'], 'admin')).toBe(true);
    });

    it('keeps submit-only accounts out as well', () => {
      expect(canViewDashboard(['Submit Posts'], 'user')).toBe(false);
    });
  });
});
