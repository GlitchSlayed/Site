// Blended-Wing-Body Aircraft: Aerodynamic Efficiency vs. Structural Mass
// Interactive demonstration built on the shared engineering visualization framework.
// All calculations live in the pure model layer (src/lib/engineering/models).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EngineeringComparisonConfig, ComparisonRow } from '../../../lib/engineering/types';
import { getModel } from '../../../lib/engineering/registry';
import { getParameter, subscribeParameter } from '../../../lib/engineering/scopedState';
import { formatPercentageChange } from '../../../lib/engineering/format';
import { ParameterSet } from '../shared/ParameterSet';
import { PresetSelector } from '../shared/PresetSelector';
import { EquationExplorer } from '../equations/EquationExplorer';
import { ModelEngineeringPlot } from '../plots/ModelEngineeringPlot';
import { EngineeringComparison } from '../tables/EngineeringComparison';

const SCOPE_ID = 'bwb-tradeoff-explorer';
const MODEL_ID = 'aircraft.performance';

const LIFT_EQUATION = 'L=\\frac{1}{2}\\rho V^2 S C_L';
const THRUST_EQUATION = 'D=\\frac{1}{2}\\rho V^2 S C_D';

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
  const [version, setVersion] = useState(0);

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

  return (
    <section className={`eng-demo bwB-tradeoff-explorer ${className || ''}`} aria-label="BWB aerodynamic efficiency vs structural mass explorer">
      <header className="eng-demo-header">
        <h1>Blended-Wing-Body Aircraft: Aerodynamic Efficiency vs. Structural Mass</h1>
        <p className="eng-demo-purpose">
          Explore how a hypothetical blended-wing-body configuration compares against a conventional
          reference aircraft. Adjust assumptions below and observe their impact on aerodynamic
          efficiency and simplified mission performance. All models assume steady, level flight and a
          simplified parabolic drag polar.
        </p>
      </header>

      <div className="eng-demo-controls">
        <div className="eng-demo-preset">
          <div className="eng-demo-preset-selector">
            <PresetSelector model={model} scopeId={SCOPE_ID} label="Configuration" />
          </div>
        </div>
        <div className="eng-demo-parameters-section">
          <h3 className="eng-parameters-label">Aircraft parameters</h3>
          <div className="eng-parameter-grid">
            <ParameterSet model={model} scopeId={SCOPE_ID} />
          </div>
        </div>
      </div>

      <div className="eng-demo-equations">
        <EquationExplorer
          modelId={MODEL_ID}
          equation={LIFT_EQUATION}
          scopeId={SCOPE_ID}
          resultOutputId="lift"
          resultLabel="Lift (steady level flight)"
          significantFigures={4}
          showParameters={false}
        />
      </div>

      <div className="eng-demo-visualizations">
        <ModelEngineeringPlot
          modelId={MODEL_ID}
          plotPresetId="aircraft.dragPolar"
          scopeId={SCOPE_ID}
          height={360}
        />
        <ModelEngineeringPlot
          modelId={MODEL_ID}
          plotPresetId="aircraft.ldVsSpeed"
          scopeId={SCOPE_ID}
          height={360}
        />
        <ModelEngineeringPlot
          modelId={MODEL_ID}
          plotPresetId="aircraft.thrustVsSpeed"
          scopeId={SCOPE_ID}
          height={360}
        />
        <ModelEngineeringPlot
          modelId={MODEL_ID}
          plotPresetId="aircraft.ldVsMassPenalty"
          scopeId={SCOPE_ID}
          height={360}
        />
      </div>

      <div className="eng-demo-comparison">
        <EngineeringComparison config={comparisonConfig} />
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
