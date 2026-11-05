import type { ReactNode } from 'react';
export interface EngineeringNoteProps {
  kind?: 'assumption' | 'limitation' | 'observation' | 'decision';
  title?: string;
  children: ReactNode;
}
/** Static content: deliberately works without hydration. */
export function EngineeringNote({ kind = 'observation', title, children }: EngineeringNoteProps) {
  return <aside className={`mdx-note mdx-note-${kind}`} aria-label={title || kind}>
    <p className="mdx-block-label">{kind}</p>
    {title && <h4>{title}</h4>}
    <div>{children}</div>
  </aside>;
}
