import {
  isFieldMonitor,
  isSaferworldPartner,
  isSubmitOnlyUser,
  shouldScopePostsToCurrentUser,
} from './permission-access';

describe('permission access helpers', () => {
  it('identifies the Saferworld partner role', () => {
    expect(isSaferworldPartner('saferworld_partner')).toBe(true);
    expect(isSaferworldPartner('saferworld_staff')).toBe(false);
  });

  it('does not treat partners as submit-only users', () => {
    expect(isSubmitOnlyUser([], 'saferworld_partner')).toBe(false);
  });

  it('identifies field monitors', () => {
    expect(isFieldMonitor('field_monitor')).toBe(true);
    expect(isFieldMonitor('saferworld_staff')).toBe(false);
  });

  it('scopes field monitors and partners to their own submissions', () => {
    expect(shouldScopePostsToCurrentUser([], 'field_monitor')).toBe(true);
    expect(shouldScopePostsToCurrentUser([], 'saferworld_partner')).toBe(true);
  });

  it('does not scope staff or administrators', () => {
    expect(shouldScopePostsToCurrentUser(['Submit Posts'], 'saferworld_staff')).toBe(false);
    expect(shouldScopePostsToCurrentUser(['Submit Posts'], 'admin')).toBe(false);
  });
});
