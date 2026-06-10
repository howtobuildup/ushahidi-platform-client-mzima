import { isSaferworldPartner, isSubmitOnlyUser } from './permission-access';

describe('permission access helpers', () => {
  it('identifies the Saferworld partner role', () => {
    expect(isSaferworldPartner('saferworld_partner')).toBe(true);
    expect(isSaferworldPartner('field_monitor')).toBe(false);
  });

  it('does not treat partners as submit-only users', () => {
    expect(isSubmitOnlyUser([], 'saferworld_partner')).toBe(false);
  });
});
