import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes, PhrasingContent } from 'mdast';

function labelText(node: PhrasingContent): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if ('children' in node) return node.children.map(labelText).join('');
  return node.type === 'image' || node.type === 'imageReference' ? node.alt || '' : '';
}
/** Parse actual Markdown nodes; code blocks and images are not resource links. */
export function sourceLinks(body = '') {
  const tree = fromMarkdown(body);
  const definitions = new Map<string, string>();
  const links: Array<{ href: string; label: string; host: string }> = [];
  const seen = new Set<string>();
  function walk(node: Nodes, visit: (node: Nodes) => void) {
    visit(node);
    if ('children' in node) node.children.forEach(child => walk(child, visit));
  }
  walk(tree, node => { if (node.type === 'definition' && !definitions.has(node.identifier.toLowerCase())) definitions.set(node.identifier.toLowerCase(), node.url); });
  walk(tree, node => {
    if (node.type !== 'link' && node.type !== 'linkReference') return;
    const href = node.type === 'link' ? node.url : definitions.get(node.identifier.toLowerCase());
    if (!href) return;
    try {
      const parsed = new URL(href);
      if (!['http:', 'https:'].includes(parsed.protocol) || seen.has(parsed.href)) return;
      seen.add(parsed.href);
      links.push({ href: parsed.href, label: node.children.map(labelText).join(''), host: parsed.hostname.replace(/^www\./, '') });
    } catch { /* Non-web or malformed links are not external resources. */ }
  });
  return links;
}
