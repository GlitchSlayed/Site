import { defineHastPlugin, type HastPluginEntry } from 'satteri';

const PERCENT_PATTERN = /\([+-]?\d+(?:\.\d+)?%\)|\(\u00B1\d+(?:\.\d+)?%\)/;
const PERCENT_SPLIT_RE = /(\([+-]?\d+(?:\.\d+)?%\)|\(\u00B1\d+(?:\.\d+)?%\))/g;

/**
 * Satteri HAST plugin: wrap percentage annotations in engineering table cells.
 * Matches patterns like (+15.1%), (-8.4%), (±2.0%) inside <td> and <th> elements
 * and wraps them in <span class="eng-percent-annotation">.
 */
export function satteriEngineeringAnnotations(): HastPluginEntry {
  return () =>
    defineHastPlugin({
      name: 'satteri-engineering-annotations',
      element: {
        filter: ['td', 'th'],
        visit(el: any) {
          if (!el.children || el.children.length === 0) return;
          let changed = false;

          function transformChildren(children: any[]): any[] {
            const next: any[] = [];
            for (const child of children) {
              if (child.type === 'text' && typeof child.value === 'string' && PERCENT_PATTERN.test(child.value)) {
                changed = true;
                const parts = child.value.split(PERCENT_SPLIT_RE);
                for (const part of parts) {
                  if (part === '') continue;
                  if (PERCENT_PATTERN.test(part)) {
                    next.push({
                      type: 'element',
                      tagName: 'span',
                      properties: { className: 'eng-percent-annotation' },
                      children: [{ type: 'text', value: part }],
                    });
                  } else {
                    next.push({ type: 'text', value: part });
                  }
                }
              } else if (child.type === 'element' && child.children) {
                const updatedChildChildren = transformChildren(child.children);
                next.push(
                  updatedChildChildren !== child.children
                    ? { ...child, children: updatedChildChildren }
                    : child
                );
              } else {
                next.push(child);
              }
            }
            return next;
          }

          const transformed = transformChildren(el.children);
          if (changed) {
            el.children = transformed;
            return el;
          }
        },
      },
    });
}

export default satteriEngineeringAnnotations;
