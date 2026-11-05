import { renderMathText } from '../../lib/engineering/formatMath';
export interface EquationBlockProps {
  equation: string;
  label?: string;
  description: string;
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>;
}
/** Supply a plain-language description as the accessible alternative. */
export function EquationBlock({ equation, label, description, variables = [] }: EquationBlockProps) {
  return <figure className="mdx-equation">
    {label && <p className="mdx-block-label">{label}</p>}
    <div className="mdx-equation-math">{renderMathText(`$${equation}$`)}</div>
    <figcaption>{description}</figcaption>
    {variables.length > 0 && <dl>{variables.map(variable => <div key={variable.symbol}>
      <dt>{renderMathText(`$${variable.symbol}$`)}{variable.unit && <span> [{variable.unit}]</span>}</dt>
      <dd>{variable.meaning}</dd>
    </div>)}</dl>}
  </figure>;
}
