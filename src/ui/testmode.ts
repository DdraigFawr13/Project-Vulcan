// Test mode (Morgan's playtest): the test tools, fps, tick and the inspector's chunk row. On with
// `?debug` in the URL, or from the Saves page's switch, which this device remembers. Off by
// default: in the normal game colonists choose their own work (V-015).

const KEY = 'vulcan.testMode';

/** Whether this page opens in test mode. */
export function testModeOn(params: URLSearchParams): boolean {
  if (params.has('debug')) return true;
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false; // storage blocked: the URL alone decides
  }
}

/** Turns test mode on or off and reloads into it; the reload writes the standby copy as the page
 * hides, and the world carries on from it. */
export function testMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the URL below still carries it for this tab
  }
  const next = new URLSearchParams(location.search);
  if (on) next.set('debug', '');
  else next.delete('debug');
  location.replace(`?${next.toString().replace(/debug=(&|$)/, 'debug$1')}`);
}
