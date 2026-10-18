// The one DOM helper the page's panels share.

/** A new element with attributes and its text, or one child element. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text: string | Node = '',
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (typeof text === 'string') node.textContent = text;
  else node.append(text);
  return node;
};
