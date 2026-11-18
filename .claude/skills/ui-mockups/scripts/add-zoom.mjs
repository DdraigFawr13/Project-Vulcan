#!/usr/bin/env node
// add-zoom: add the screenshot viewer (../assets/zoom-viewer.html) to pages for Morgan. Screenshots then fit the
// screen, and a tap opens one full screen to pinch, double-tap, drag or use the buttons to zoom.
// Ported from dfma-review scripts/add_zoom.py (D-024). Node built-ins only.
// Usage: node add-zoom.mjs <page.html> [...]   (in place; running it twice leaves one copy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const START = '<!-- Screenshot viewer (';
const MARK = 'id="zv"';

/** The page with one copy of the viewer: an older copy is replaced; it goes after </main>, else at the end. */
export function addZoom(html, snippet) {
  if (html.includes(MARK)) {
    const start = html.indexOf(START);
    const end = html.indexOf('</script>', html.indexOf(MARK)) + '</script>'.length;
    if (start !== -1 && end > start) html = html.slice(0, start).replace(/\n$/, '') + html.slice(end).replace(/^\n+/, '');
  }
  const main = html.lastIndexOf('</main>');
  const at = main === -1 ? html.length : main + '</main>'.length;
  return `${html.slice(0, at)}\n${snippet}${html.slice(at)}`;
}

function main(argv) {
  if (argv.length === 0) {
    console.error('usage: add-zoom.mjs <page.html> [...]');
    return 2;
  }
  const snippet = fs.readFileSync(path.join(HERE, '..', 'assets', 'zoom-viewer.html'), 'utf8');
  for (const file of argv) {
    fs.writeFileSync(file, addZoom(fs.readFileSync(file, 'utf8'), snippet));
    console.log(`zoom viewer added to ${file}`);
  }
  return 0;
}

const invoked = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = main(process.argv.slice(2));
