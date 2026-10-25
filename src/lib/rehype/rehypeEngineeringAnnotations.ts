// Rehype plugin: wrap percentage annotations in engineering tables.
// Finds patterns like (+15.1%), (-8.4%), (±2.0%) in table cells and wraps
// them in <span class="eng-percent-annotation"> for consistent accent styling.
// Scoped to table cells only; does not affect other content.
import type { Node, Parent } from 'unist';

export default function rehypeEngineeringAnnotations() {
  return (tree: Node) => {
    const PERCENT_RE = /(\([+-]?\d+(?:\.\d+)?%\)|\(±\d+(?:\.\d+)?%\))/g;

    function walk(node: Node) {
      const el = node as any;
      if (
        el.type === 'element' &&
        (el.tagName === 'td' || el.tagName === 'th') &&
        el.children
      ) {
        const newChildren: Node[] = [];
        for (const child of el.children) {
          if (child.type === 'text' && PERCENT_RE.test((child as any).value)) {
            const parts = (child as any).value.split(PERCENT_RE);
            for (const part of parts) {
              if (part === '') continue;
              if (PERCENT_RE.test(part)) {
                newChildren.push({
                  type: 'element',
                  tagName: 'span',
                  properties: { className: 'eng-percent-annotation' },
                  children: [{ type: 'text', value: part }],
                } as unknown as Node);
              } else {
                newChildren.push({ type: 'text', value: part } as unknown as Node);
              }
            }
          } else {
            newChildren.push(child);
            walk(child);
          }
        }
        el.children = newChildren;
      } else if ((node as Parent).children) {
        for (const child of (node as Parent).children) {
          walk(child);
        }
      }
    }

    walk(tree);
  };
}
