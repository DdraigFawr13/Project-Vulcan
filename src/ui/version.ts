// The build's version (tools/version.ts stamps it when Vite builds): a quiet label in the top bar,
// and the full hash and build time on the Saves sheet.
import { el } from './dom.ts';

declare const __BUILD__: { label: string; commit: string; builtAt: string } | undefined;

const build =
  typeof __BUILD__ === 'undefined' ? { label: 'v?', commit: 'local', builtAt: '' } : __BUILD__;

/** The bar's label, such as "v4.64". */
export function versionTag(): HTMLElement {
  return el(
    'span',
    { class: 'version', 'data-testid': 'version', title: `Build ${build.commit}` },
    build.label,
  );
}

/** The Saves sheet's line: label, commit and when it was built. */
export function versionLine(): HTMLElement {
  const built = build.builtAt
    ? new Date(build.builtAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'not stamped';
  return el(
    'p',
    { class: 'aside', 'data-testid': 'version-line' },
    `Version ${build.label} · build ${build.commit} · built ${built}`,
  );
}
