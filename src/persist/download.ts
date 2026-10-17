// Hands the player a file: the NDJSON ledger export.

/** Downloads `text` as a file called `name`. */
export function download(name: string, text: string, type = 'application/x-ndjson'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // The click starts the download synchronously; the URL can go once it has.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
