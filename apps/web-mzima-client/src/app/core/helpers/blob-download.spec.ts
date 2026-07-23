import { downloadBlob } from './blob-download';

describe('downloadBlob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:export-file'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps the object URL alive while the browser reads the download', () => {
    downloadBlob(new Blob(['id,title\n1,Test\n'], { type: 'text/csv' }), 'export.csv');

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(59_999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export-file');
  });

  it('refuses to download a zero-byte file', () => {
    expect(() => downloadBlob(new Blob([]), 'empty.csv')).toThrow(
      'The generated file is empty. Please run the export again.',
    );
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
