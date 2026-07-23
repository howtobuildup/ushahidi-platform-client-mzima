const OBJECT_URL_REVOCATION_DELAY_MS = 60_000;

export function downloadBlob(blob: Blob, fileName: string): void {
  if (!blob.size) {
    throw new Error('The generated file is empty. Please run the export again.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can race the browser's download reader and produce a
  // zero-byte file even though the Blob contains data.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_REVOCATION_DELAY_MS);
}
