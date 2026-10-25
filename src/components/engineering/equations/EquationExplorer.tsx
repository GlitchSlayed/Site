// Equation explorer: KaTeX presentation + typed calculation + live result.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import type { EngineeringOutputValue } from '../../../lib/engineering/types';
import { getModel } from '../../../lib/engineering/registry';
import { getParameter, subscribeParameter } from '../../../lib/engineering/scopedState';
import { ParameterSet } from '../shared/ParameterSet';
import { EngineeringPlot } from '../plots/EngineeringPlot';
import type { EngineeringPlotConfig } from '../../../lib/engineering/types';
import { formatResult } from '../../../lib/engineering/format';

interface EquationExplorerProps {
  modelId: string;
  equation: string;
  scopeId: string;
  resultOutputId: string;
  resultLabel?: string;
  variableDefinitions?: { id: string; label: string; description?: string }[];
  plotConfig?: EngineeringPlotConfig;
  significantFigures?: number;
  className?: string;
  height?: number;
  showParameters?: boolean;
}

export function EquationExplorer({
  modelId,
  equation,
  scopeId,
  resultOutputId,
  resultLabel,
  variableDefinitions,
  plotConfig,
  significantFigures: sigFigs = 4,
  className,
  height = 300,
  showParameters = true,
}: EquationExplorerProps) {
  const model = getModel(modelId);
  const katexElRef = useRef<HTMLSpanElement>(null);

  // Version state that increments whenever any subscribed parameter changes,
  // forcing a re-render that re-reads current parameter values.
  const [version, setVersion] = useState(0);

  // Subscribe to all model parameters so slider changes propagate to the result.
  useEffect(() => {
    const unsubscribes = model ? model.parameters.map((param) =>
      subscribeParameter(scopeId, param.id, () => setVersion((v) => v + 1))
    ) : [];
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [scopeId, model]);

  const inputs = useMemo(() => {
    const values: Record<string, number> = {};
    if (!model) return values;
    for (const param of model.parameters) {
      values[param.id] = getParameter(scopeId, param.id) ?? param.defaultValue;
    }
    return values;
  }, [model, version]);

  // Render KaTeX during SSR as well as on the client so the equation is present
  // in the static HTML rather than appearing only after hydration.
  const renderedKaTeX = useMemo(() => {
    try {
      return katex.renderToString(equation, { throwOnError: false, output: 'html' });
    } catch {
      return null;
    }
  }, [equation]);

  const [rendered, setRendered] = useState<string | null>(renderedKaTeX);

  useEffect(() => {
    if (rendered === null) setRendered(renderedKaTeX);
  }, [rendered, renderedKaTeX]);

  const outputs = useMemo(() => {
    if (!model) return {};
    try {
      return model.compute(inputs);
    } catch {
      return {};
    }
  }, [model, inputs]);

  const result = outputs[resultOutputId];

  const formatted = formatResult({
    value: result?.value,
    unit: result?.unit,
    label: result?.label,
    significantFigures: result?.significantFigures ?? sigFigs,
    engineeringNotation: result?.engineeringNotation,
  });

  return (
    <section className={`eng-equation-explorer ${className || ''}`} aria-label="Equation explorer">
      <div className="eng-equation">
        <h3 className="eng-equation-title">{resultLabel || model?.title || 'Equation'}</h3>
        <span ref={katexElRef} dangerouslySetInnerHTML={{ __html: rendered ?? '' }} aria-label="Equation" />
      </div>

      <div className={`eng-equation-body ${showParameters ? '' : 'eng-equation-body--result-only'}`}>
        {showParameters && (
          <div className="eng-equation-parameters">
            {model ? (
              <ParameterSet model={model} scopeId={scopeId} />
            ) : (
              <p>Unknown model: {modelId}</p>
            )}
          </div>
        )}

        <div className="eng-equation-result">
          <h4>Result</h4>
          <div className="eng-result-value">
            <span className="eng-result-number">{formatted.value}</span>
            {formatted.unit && <span className="eng-result-unit">[{formatted.unit}]</span>}
          </div>
          {result?.label && <p className="eng-result-label">{result.label}</p>}
          {!result && !model ? <p className="eng-result-empty">No result available.</p> : null}
          {!result && model && <p className="eng-result-empty">Result output "{resultOutputId}" not produced by model.</p>}
        </div>
      </div>

      {variableDefinitions && variableDefinitions.length > 0 && (
        <div className="eng-equation-definitions">
          <h4>Variables</h4>
          <dl className="eng-definition-list">
            {variableDefinitions.map((def) => (
              <div key={def.id} className="eng-definition-item">
                <dt>{def.label}</dt>
                <dd>{def.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {plotConfig && (
        <div className="eng-equation-plot">
          <EngineeringPlot config={plotConfig} height={height} />
        </div>
      )}
    </section>
  );
}
