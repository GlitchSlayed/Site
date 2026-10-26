import React from 'react';
import katex from 'katex';

/**
 * Render a string containing optional inline math enclosed in $...$
 * using KaTeX. Returns safe React elements.
 *
 * Example:
 * renderMathText("Lift-to-drag ($L/D$) ratio")
 */
export function renderMathText(text?: string): React.ReactNode {
  if (!text) return null;
  if (!text.includes('$')) return text;

  const parts = text.split(/(\$[^\$]+\$)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, {
              throwOnError: false,
              displayMode: false,
            });
            return (
              <span
                key={idx}
                className="eng-inline-katex"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <span key={idx}>{part}</span>;
          }
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}
