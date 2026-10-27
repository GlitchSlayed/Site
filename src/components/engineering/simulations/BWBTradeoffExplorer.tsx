// Blended-Wing-Body Aircraft: Aerodynamic Efficiency vs. Structural Mass
// Interactive demonstration built on the shared engineering visualization framework.
// All calculations live in the pure model layer (src/lib/engineering/models).
import { useEffect, useMemo, useState } from "react";
import type { EngineeringComparisonConfig, ComparisonRow } from '../../../lib/engineering/types';
import { getModel } from '../../../lib/engineering/registry';
import { getParameter, subscribeParameter } from '../../../lib/engineering/scopedState';
import { formatPercentageChange } from '../../../lib/engineering/format';
import type { PlotScenario } from '../../../lib/engineering/plots/registry';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { ParameterSet } from '../shared/ParameterSet';
import { PresetSelector } from '../shared/PresetSelector';
import { EquationExplorer } from '../equations/EquationExplorer';
import { ModelEngineeringPlot } from '../plots/ModelEngineeringPlot';
import { EngineeringComparison } from '../tables/EngineeringComparison';

const SCOPE_ID = 'bwb-tradeoff-explorer';
const MODEL_ID = 'aircraft.performance';

const LIFT_EQUATION = 'L=\\frac{1}{2}\\rho V^2 S C_L';

interface BWBTradeoffExplorerProps {
  className?: string;
}

export function BWBTradeoffExplorer({ className }: BWBTradeoffExplorerProps = {}) {
  const model = getModel(MODEL_ID);

  if (!model) {
    return (
      <div className="eng-demo eng-demo-error" role="alert" aria-live="polite">
        Engineering model not available: {MODEL_ID}
      </div>
    );
  }

  // Version state that increments whenever any scoped parameter changes,
  // forcing re-render of live calculations and the comparison table.
  const [, setVersion] = useState(0);
  const [compareAllScenarios, setCompareAllScenarios] = useState(true);

  useEffect(() => {
    const unsubscribes = model.parameters.map((param) =>
      subscribeParameter(SCOPE_ID, param.id, () => setVersion((v) => v + 1))
    );
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [model, setVersion]);

  // Read live parameter values from scoped state.
  const liveInputs: Record<string, number> = {};
  for (const param of model.parameters) {
    liveInputs[param.id] = getParameter(SCOPE_ID, param.id) ?? param.defaultValue;
  }

  // Reference aircraft: fixed conventional defaults (not affected by live sliders).
  const conventionalInputs: Record<string, number> = {};
  for (const param of model.parameters) {
    conventionalInputs[param.id] = param.defaultValue;
  }

  const conventionalPreset = model.presets?.conventional ?? {
    mass: 70000, structuralPenalty: 0, area: 300, span: 45, ar: 6.75, e: 0.8, cd0: 0.02, inducedCorrection: 1, rho: 1.225, velocity: 80,
  };
  const bwbOptimisticPreset = model.presets?.bwbOptimistic ?? {
    mass: 70000, structuralPenalty: 0.05, area: 450, span: 55, ar: 6.7, e: 0.85, cd0: 0.018, inducedCorrection: 1, rho: 1.225, velocity: 80,
  };
  const bwbPenalizedPreset = model.presets?.bwbPenalized ?? {
    mass: 70000, structuralPenalty: 0.15, area: 450, span: 55, ar: 6.7, e: 0.85, cd0: 0.018, inducedCorrection: 1, rho: 1.225, velocity: 80,
  };

  const scenarios: PlotScenario[] = useMemo(() => {
    if (!compareAllScenarios) {
      return [
        {
          id: 'live',
          label: 'Active Configuration',
          inputs: liveInputs,
          color: '#ff603b',
        },
      ];
    }

    return [
      {
        id: 'conventional',
        label: 'Conventional Reference',
        inputs: conventionalPreset,
        color: '#38bdf8', // Sky Blue
      },
      {
        id: 'bwbOptimistic',
        label: 'BWB Optimistic (+5% mass)',
        inputs: bwbOptimisticPreset,
        color: '#22c55e', // Emerald Green
      },
      {
        id: 'bwbPenalized',
        label: 'BWB Penalized (+15% mass)',
        inputs: bwbPenalizedPreset,
        color: '#f59e0b', // Amber
      },
      {
        id: 'live',
        label: 'Live Adjustable Airframe',
        inputs: liveInputs,
        color: '#ff603b', // Coral
      },
    ];
  }, [compareAllScenarios, liveInputs]);

  const conventional = model.compute(conventionalInputs);
  const adjustable = model.compute(liveInputs);

  const rows: ComparisonRow[] = [
    {
      id: 'totalMass',
      label: 'Total mass',
      unit: 'kg',
      values: [conventional.totalMass.value, adjustable.totalMass.value],
      ...(formatPercentageChange(adjustable.totalMass.value, conventional.totalMass.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.totalMass.value, conventional.totalMass.value)! } }
        : {}),
    },
    {
      id: 'weight',
      label: 'Weight',
      unit: 'N',
      values: [conventional.weight.value, adjustable.weight.value],
      ...(formatPercentageChange(adjustable.weight.value, conventional.weight.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.weight.value, conventional.weight.value)! } }
        : {}),
    },
    {
      id: 'cl',
      label: 'Lift coefficient C_L',
      unit: '-',
      values: [conventional.cl.value, adjustable.cl.value],
      ...(formatPercentageChange(adjustable.cl.value, conventional.cl.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.cl.value, conventional.cl.value)! } }
        : {}),
    },
    {
      id: 'cd',
      label: 'Drag coefficient C_D',
      unit: '-',
      values: [conventional.cd.value, adjustable.cd.value],
      ...(formatPercentageChange(adjustable.cd.value, conventional.cd.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.cd.value, conventional.cd.value)! } }
        : {}),
    },
    {
      id: 'ld',
      label: 'Lift-to-drag ratio L/D',
      unit: '-',
      values: [conventional.ld.value, adjustable.ld.value],
      highlight: true,
      ...(formatPercentageChange(adjustable.ld.value, conventional.ld.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.ld.value, conventional.ld.value)! } }
        : {}),
    },
    {
      id: 'drag',
      label: 'Drag',
      unit: 'N',
      values: [conventional.drag.value, adjustable.drag.value],
      ...(formatPercentageChange(adjustable.drag.value, conventional.drag.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.drag.value, conventional.drag.value)! } }
        : {}),
    },
    {
      id: 'thrust',
      label: 'Thrust required',
      unit: 'N',
      values: [conventional.thrust.value, adjustable.thrust.value],
      ...(formatPercentageChange(adjustable.thrust.value, conventional.thrust.value)
        ? { annotations: { 1: formatPercentageChange(adjustable.thrust.value, conventional.thrust.value)! } }
        : {}),
    },
  ];

  const comparisonConfig: EngineeringComparisonConfig = {
    title: 'Conventional reference vs. adjustable aircraft',
    configurations: [
      { id: 'conventional', label: 'Conventional reference', color: '#99999f' },
      { id: 'adjustable', label: 'Adjustable aircraft (live)', color: '#ff603b' },
    ],
    rows,
    referenceConfigId: 'conventional',
    sortable: true,
    notes: [
      {
        rowId: 'ld',
        title: 'Lift-to-drag ratio',
        body: 'L/D = C_L / C_D. A higher L/D means less drag for the same lift, which reduces thrust required and mission fuel burn. The BWB shape targets a lower zero-lift drag (C_D,0) but may carry a structural-mass penalty that raises required lift and drag.',
      },
      {
        rowId: 'structuralPenalty',
        title: 'Structural-mass penalty',
        body: 'The structural mass penalty is an explicit, adjustable assumption. It is illustrative and is not a validated BWB structural prediction. Increasing it raises total mass, which raises required C_L and drag, reducing L/D.',
      },
    ],
  };

  const [activeVizTab, setActiveVizTab] = useState<'all' | 'dragPolar' | 'ldVsSpeed' | 'thrustVsSpeed' | 'ldVsMassPenalty'>('all');

  return (
    <section className={`eng-demo bwB-tradeoff-explorer ${className || ''}`} aria-label="BWB aerodynamic efficiency vs structural mass explorer">
      <header className="eng-demo-header">
        <div className="eng-demo-badge">
          <span className="eng-demo-badge-dot" aria-hidden="true"></span>
          <span className="eng-demo-badge-text">Interactive Aerodynamic Model</span>
        </div>
        <p className="eng-demo-purpose">
          Live parametric model comparing an adjustable BWB airframe against the conventional
          reference baseline in steady, level flight. Drag parameters or select configurations to explore tradeoff sensitivities across all four live plots.
        </p>
      </header>

      <div className="eng-demo-controls">
        <div className="eng-demo-preset">
          <div className="eng-demo-preset-selector">
            <ErrorBoundary fallback={<div>Configuration failed to load</div>}>
              <PresetSelector model={model} scopeId={SCOPE_ID} label="Configuration" />
            </ErrorBoundary>
          </div>
        </div>
        <div className="eng-demo-parameters-section">
          <h3 className="eng-parameters-label">Aircraft parameters</h3>
          <div className="eng-parameter-grid">
            <ErrorBoundary fallback={<div>Parameters failed to load</div>}>
              <ParameterSet model={model} scopeId={SCOPE_ID} />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      <div className="eng-demo-equations">
        <ErrorBoundary fallback={<div>Equation explorer failed to load</div>}>
          <EquationExplorer
            modelId={MODEL_ID}
            equation={LIFT_EQUATION}
            scopeId={SCOPE_ID}
            resultOutputId="lift"
            resultLabel="Lift (steady level flight)"
            significantFigures={4}
            showParameters={false}
          />
        </ErrorBoundary>
      </div>

      <div className="eng-demo-viz-header">
        <div className="eng-demo-viz-tabs" role="tablist" aria-label="Select plot view">
          {[
            { id: 'all', label: 'All 4 Plots' },
            { id: 'dragPolar', label: 'Drag Polar (CD vs CL)' },
            { id: 'ldVsSpeed', label: 'L/D vs Airspeed' },
            { id: 'thrustVsSpeed', label: 'Thrust Required' },
            { id: 'ldVsMassPenalty', label: 'Mass Penalty Sensitivity' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`eng-demo-viz-tab ${activeVizTab === tab.id ? 'eng-demo-viz-tab-active' : ''}`}
              onClick={() => setActiveVizTab(tab.id as any)}
              role="tab"
              aria-selected={activeVizTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="eng-demo-scenario-toggle">
          <button
            type="button"
            className={`eng-demo-scenario-btn ${compareAllScenarios ? 'eng-demo-scenario-btn-active' : ''}`}
            onClick={() => setCompareAllScenarios(!compareAllScenarios)}
            aria-pressed={compareAllScenarios}
            data-tooltip="Multi-Scenario Overlay"
            data-tooltip-subtitle="Compare all 3 benchmark configurations simultaneously on the graph"
            data-tooltip-pos="top"
          >
            <span className="eng-demo-scenario-indicator" aria-hidden="true">
              {compareAllScenarios ? '✓ ' : '+ '}
            </span>
            {compareAllScenarios ? 'Comparing All 3 Situations + Live' : 'Compare All 3 Situations'}
          </button>
        </div>
      </div>

      <div className="eng-demo-visualizations">
        {(activeVizTab === 'all' || activeVizTab === 'dragPolar') && (
          <ErrorBoundary fallback={<div>Drag polar plot failed to load</div>}>
            <ModelEngineeringPlot
              modelId={MODEL_ID}
              plotPresetId="aircraft.dragPolar"
              scopeId={SCOPE_ID}
              scenarios={scenarios}
              height={420}
              inspectable
              inspectorMetrics={[
                { id: 'cl', label: 'Lift coefficient C_L', unit: '-', significantFigures: 4 },
                { id: 'cd', label: 'Drag coefficient C_D', unit: '-', significantFigures: 4 },
                { id: 'k', label: 'Induced factor k', unit: '-', significantFigures: 4 },
              ]}
            />
          </ErrorBoundary>
        )}
        {(activeVizTab === 'all' || activeVizTab === 'ldVsSpeed') && (
          <ErrorBoundary fallback={<div>L/D vs airspeed plot failed to load</div>}>
            <ModelEngineeringPlot
              modelId={MODEL_ID}
              plotPresetId="aircraft.ldVsSpeed"
              scopeId={SCOPE_ID}
              scenarios={scenarios}
              height={420}
              inspectable
              inspectorMetrics={[
                { id: 'velocity', label: 'Airspeed V', unit: 'm/s', significantFigures: 3 },
                { id: 'cl', label: 'Lift coefficient C_L', unit: '-', significantFigures: 4 },
                { id: 'cd', label: 'Drag coefficient C_D', unit: '-', significantFigures: 4 },
                { id: 'ld', label: 'Lift-to-drag L/D', unit: '-', significantFigures: 3 },
                { id: 'thrust', label: 'Thrust required', unit: 'N', significantFigures: 4 },
              ]}
            />
          </ErrorBoundary>
        )}
        {(activeVizTab === 'all' || activeVizTab === 'thrustVsSpeed') && (
          <ErrorBoundary fallback={<div>Thrust vs airspeed plot failed to load</div>}>
            <ModelEngineeringPlot
              modelId={MODEL_ID}
              plotPresetId="aircraft.thrustVsSpeed"
              scopeId={SCOPE_ID}
              scenarios={scenarios}
              height={420}
              inspectable
              inspectorMetrics={[
                { id: 'velocity', label: 'Airspeed V', unit: 'm/s', significantFigures: 3 },
                { id: 'cl', label: 'Lift coefficient C_L', unit: '-', significantFigures: 4 },
                { id: 'cd', label: 'Drag coefficient C_D', unit: '-', significantFigures: 4 },
                { id: 'ld', label: 'Lift-to-drag L/D', unit: '-', significantFigures: 3 },
                { id: 'thrust', label: 'Thrust required', unit: 'N', significantFigures: 4 },
              ]}
            />
          </ErrorBoundary>
        )}
        {(activeVizTab === 'all' || activeVizTab === 'ldVsMassPenalty') && (
          <ErrorBoundary fallback={<div>L/D vs mass penalty plot failed to load</div>}>
            <ModelEngineeringPlot
              modelId={MODEL_ID}
              plotPresetId="aircraft.ldVsMassPenalty"
              scopeId={SCOPE_ID}
              scenarios={scenarios}
              height={420}
              inspectable
              inspectorMetrics={[
                { id: 'structuralPenalty', label: 'Structural penalty Δm/m', unit: '-', significantFigures: 3 },
                { id: 'cl', label: 'Lift coefficient C_L', unit: '-', significantFigures: 4 },
                { id: 'cd', label: 'Drag coefficient C_D', unit: '-', significantFigures: 4 },
                { id: 'ld', label: 'Lift-to-drag L/D', unit: '-', significantFigures: 3 },
                { id: 'thrust', label: 'Thrust required', unit: 'N', significantFigures: 4 },
              ]}
            />
          </ErrorBoundary>
        )}
      </div>

      <div className="eng-demo-comparison">
        <ErrorBoundary fallback={<div>Comparison table failed to load</div>}>
          <EngineeringComparison config={comparisonConfig} />
        </ErrorBoundary>
      </div>

      <div className="eng-demo-assumptions">
        <h2>Assumptions and limitations</h2>
        <ul>
          <li>Steady, level flight: lift equals weight and thrust equals drag.</li>
          <li>Parabolic drag polar: C_D = C_D,0 + k·C_L², with k = 1 / (π·e·AR).</li>
          <li>Constant air density over the flight segment.</li>
          <li>Low-order model; omits compressibility, transonic, viscous, and interference effects.</li>
          <li><strong>The structural-mass penalty is illustrative.</strong> It is an explicit adjustable assumption, not a validated BWB structural prediction, and does not by itself prove BWB superiority or inferiority in any regime.</li>
          <li>Results are analytical sensitivity estimates, not experimental data or certified aircraft performance.</li>
        </ul>
      </div>
    </section>
  );
}
