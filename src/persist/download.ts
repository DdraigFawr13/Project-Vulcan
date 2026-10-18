// Hands the player a file: the ledger export, gzipped NDJSON.

/** Downloads `parts`, joined as they are (never copied into one string), as a file called `name`. */
export function download(
  name: string,
  parts: readonly (string | ArrayBuffer)[],
  type = 'application/gzip',
): void {
  const url = URL.createObjectURL(new Blob([...parts], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // The click starts the download synchronously; the URL can go once it has.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
