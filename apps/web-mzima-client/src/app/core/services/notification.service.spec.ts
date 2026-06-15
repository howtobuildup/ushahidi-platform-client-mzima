import { getErrorMessage } from '../helpers/error-message.helper';

describe('getErrorMessage', () => {
  it('extracts a validation error from an HTTP response', () => {
    expect(
      getErrorMessage({
        error: {
          errors: [{ message: 'The CSV file is too large.' }],
        },
      }),
    ).toBe('The CSV file is too large.');
  });

  it('does not render objects as object Object', () => {
    expect(getErrorMessage({ error: { message: 'Upload failed.' } })).toBe('Upload failed.');
  });

  it('uses a readable fallback when no message is available', () => {
    expect(getErrorMessage({})).toBe('An unexpected error occurred. Please try again.');
  });
});
