// Blended-Wing-Body Aircraft: Aerodynamic Efficiency vs. Structural Mass
// Interactive demonstration built on the shared engineering visualization framework.
// All calculations live in the pure model layer (src/lib/engineering/models).
import { useState } from 'react';
import type { EngineeringComparisonConfig, ComparisonRow } from '../../../lib/engineering/types';
import { getModel } from '../../../lib/engineering/registry';
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
  const [activeCase, setActiveCase] = useState<'conventional' | 'bwb' | 'both'>('both');

  if (!model) {
    return (
      <div className="eng-demo eng-demo-error" role="alert" aria-live="polite">
        Engineering model not available: {MODEL_ID}
      </div>
    );
  }

  // Build a comparison table from two independent parameter configurations.
  // Each case reads from the same scoped store; the "both" view shows conventional
  // defaults vs the BWB-optimized preset side by side.
  const conventionalInputs: Record<string, number> = {};
  const bwbInputs: Record<string, number> = {};
  for (const param of model.parameters) {
    conventionalInputs[param.id] = param.defaultValue;
    bwbInputs[param.id] = param.defaultValue;
  }

  const bwbPreset = {
    mass: 70000,
    structuralPenalty: 0.05,
    area: 450,
    span: 55,
    ar: 7,
    e: 0.85,
    cd0: 0.018,
    inducedCorrection: 1,
    rho: 1.225,
    velocity: 80,
  };
  for (const [key, value] of Object.entries(bwbPreset)) {
    bwbInputs[key] = value;
  }

  const conventional = model.compute(conventionalInputs);
  const bwb = model.compute(bwbInputs);

  const rows: ComparisonRow[] = [
    { id: 'totalMass', label: 'Total mass', unit: 'kg', values: [conventional.totalMass.value, bwb.totalMass.value] },
    { id: 'weight', label: 'Weight', unit: 'N', values: [conventional.weight.value, bwb.weight.value] },
    { id: 'cl', label: 'Lift coefficient C_L', unit: '-', values: [conventional.cl.value, bwb.cl.value] },
    { id: 'cd', label: 'Drag coefficient C_D', unit: '-', values: [conventional.cd.value, bwb.cd.value] },
    { id: 'ld', label: 'Lift-to-drag ratio L/D', unit: '-', values: [conventional.ld.value, bwb.ld.value], highlight: true },
    { id: 'drag', label: 'Drag', unit: 'N', values: [conventional.drag.value, bwb.drag.value] },
    { id: 'thrust', label: 'Thrust required', unit: 'N', values: [conventional.thrust.value, bwb.thrust.value] },
  ];

  const comparisonConfig: EngineeringComparisonConfig = {
    title: 'Conventional vs. BWB (reference conditions)',
    configurations: [
      { id: 'conventional', label: 'Conventional reference', color: '#99999f' },
      { id: 'bwb', label: 'BWB (illustrative)', color: '#ff603b' },
    ],
    rows,
    referenceConfigId: 'conventional',
    showPercentageChange: true,
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
          <PresetSelector model={model} scopeId={SCOPE_ID} label="Configuration" />
        </div>
        <div className="eng-demo-parameters">
          <ParameterSet model={model} scopeId={SCOPE_ID} />
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
