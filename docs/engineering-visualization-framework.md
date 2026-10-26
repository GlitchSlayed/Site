# Engineering Visualization Framework

Developer documentation for the reusable interactive engineering visualization system
integrated into this Astro site. All calculations live in a pure TypeScript model
layer that is independent of the rendering components.

## 1. Architecture

The framework separates concerns into five layers:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Engineering models | `src/lib/engineering/models/` | Pure TypeScript calculation functions (no rendering) |
| Validation / units / numerics | `src/lib/engineering/validation.ts`, `units.ts` | Input sanitization, edge-case guards, unit conversion |
| Scoped state | `src/lib/engineering/scopedState.ts` | Isolated, shareable parameter store |
| Visualization components | `src/components/engineering/` | React islands that render models (uPlot, Three.js) |
| Plot definitions | `src/lib/engineering/plots/registry.ts` | Configuration-driven mapping from model → uPlot series |

```
model.compute(inputs)  →  outputs   (pure, testable, no DOM)
                           ↑
                  component reads outputs, renders UI
```

### Design rules

- **No site-wide visualization bundle.** uPlot and Three.js are dynamically imported inside each component only when that component mounts/is visible.
- **CSP-safe plotting.** uPlot has no `eval`/`new-Function` dependency, so it works under strict Content Security Policy.
- **No arbitrary LaTeX evaluation.** KaTeX is the presentation layer only. Equations are backed by explicitly typed calculation functions.
- **No global state linking unrelated charts.** Parameters live in scopes keyed by `scopeId` + `paramId`; two visualizations sharing a scope stay synchronized, unrelated ones do not.
- **Reactive propagation.** Parameter changes flow through scoped state subscriptions → component re-render → model recalculation → visualization update.
- **SI units internally.** All models compute in SI; the `units` layer converts for display.
- **Graceful degradation.** Every component has loading, error, and empty states. One failed visualization does not break an article.

## 2. Available components

| Component | Location | Lazy library | Purpose |
|-----------|----------|--------------|---------|
| `EngineeringPlot` | `components/engineering/plots/EngineeringPlot.tsx` | uPlot | Interactive scientific plots with cursor readout, two-point operating-point inspection, autoscale, zoom/pan/reset, series visibility, PNG+CSV export, and a settings panel |
| `EngineeringPointInspector` | `components/engineering/shared/EngineeringPointInspector.tsx` | none | Click-to-inspect readout showing coordinates, units, deltas, slopes, and model-derived metrics at primary and comparison points |
| `ModelEngineeringPlot` | `components/engineering/plots/ModelEngineeringPlot.tsx` | uPlot | Model-driven plot from a registry definition |
| `EquationExplorer` | `components/engineering/equations/EquationExplorer.tsx` | katex | Equation + controls + live result + optional plot |
| `EngineeringComparison` | `components/engineering/tables/EngineeringComparison.tsx` | none | Side-by-side configuration comparison table |
| `EngineeringModelViewer` | `components/engineering/viewers/EngineeringModelViewer.tsx` | three | GLB/glTF 3D model viewer with overlays |
| `ParameterSet` | `components/engineering/shared/ParameterSet.tsx` | none | Renders a control for every model parameter |
| `ParameterControl` | `components/engineering/shared/ParameterControl.tsx` | none | Synchronized slider + numeric input for one parameter |
| `PresetSelector` | `components/engineering/shared/PresetSelector.tsx` | none | Named configuration / reset selector |
| `BWBTradeoffExplorer` | `components/engineering/simulations/BWBTradeoffExplorer.tsx` | uPlot | Complete BWB vs conventional demo |

> [!NOTE]
> For author-facing MDX components (`LinePlot`, `ScatterPlot`, `FunctionPlot`, `HeatmapPlot`, `ParamSlider`, `ParamPlayground`, `MetricCard`, `MetricGrid`, `DataTable`, `NotebookCell`), see [`mdx-components-guide.md`](./mdx-components-guide.md).

## 3. Supported engineering models

Registered in `src/lib/engineering/registry.ts`:

| Model ID | Title | Outputs |
|----------|-------|---------|
| `aerodynamics.lift` | Lift Equation | Lift (N) |
| `aerodynamics.dragPolar` | Drag Polar | Drag coefficient `C_D`, induced factor `k` |
| `aircraft.performance` | Aircraft Performance (steady, level) | lift, total mass, weight, `C_L`, `k`, `C_D`, `L/D`, drag, thrust, dynamic pressure |

## 4. How to define a new model

Create a file in `src/lib/engineering/models/<category>/<name>.ts`:

```ts
import type { EngineeringModel } from '../../types';
import { safeResult, safeDivide } from '../../validation';

export const myModel: EngineeringModel = {
  id: 'category.myModel',
  title: 'My Model',
  description: 'One line.',
  assumptions: ['Steady state.', 'SI units.'],
  limitations: ['Low-order approximation.'],
  parameters: [
    {
      id: 'x',
      label: 'Input X',
      symbol: 'x',
      unit: 'm',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 10,
    },
  ],
  outputs: {
    y: { label: 'Result Y', symbol: 'y', unit: 'N', significantFigures: 4 },
  },
  compute(inputs) {
    const { x = 10 } = inputs;
    return { y: { value: safeResult(x * 2) } };
  },
};

export default myModel;
```

Then register it in `src/lib/engineering/registry.ts`:

```ts
import { myModel } from './models/<category>/<name>';
const models: Record<string, EngineeringModel> = {
  ...existing,
  [myModel.id]: myModel,
};
```

## 5. How to create a preset

Add a `presets` object to the model:

```ts
presets: {
  cruise: { mass: 70000, velocity: 80, altitude: 10000, ... },
  loiter: { mass: 65000, velocity: 60, ... },
},
```

A `reference` key can be set for percentage comparisons in `EngineeringComparison`.

## 6. How to embed components in MDX

MDX (`.mdx`) files support interactive components. Import and use them like React:

```mdx
import { EquationExplorer, EngineeringPlot, EngineeringComparison } from '../../components/engineering';

<EquationExplorer
  modelId="aerodynamics.lift"
  equation="L=\\frac{1}{2}\\rho V^2 S C_L"
  resultOutputId="lift"
  resultLabel="Lift"
  scopeId="lift-demo"
  client:load
/>

<EngineeringPlot
  config={myPlotConfig}
  client:load
/>
```

### Graph settings and interactions

Every `EngineeringPlot` ships with a fully functional toolbar and settings panel:

- **Inspect / Zoom / Pan** modes — click a curve to select an operating point (primary); Shift+click to select a comparison point.
- **Reset View / Autoscale** — restore configured limits or fit axes to the data.
- **Graph Settings** — grid on/off, logarithmic Y axis, axis bounds (X/Y min/max), data markers, line thickness, series visibility, legend on/off, cursor readout on/off, display precision (3–6 significant figures), and "Reset Settings".
- **Export** — "Export PNG" (canvas) and "Export CSV" (underlying data).

Settings apply live to the chart; they do not recreate the instance unless the structure (series, axes, scale type) changes.

### Two-point operating-point inspection

Clicking a curve selects an operating point. The `EngineeringPointInspector` renders below the chart showing:
- X and Y coordinates with units
- Series name
- Difference (Δx, Δy) and slope Δy/Δx between primary and comparison points
- Model-derived metrics at each point (e.g. thrust, drag at a given airspeed) with deltas and percentage change

```mdx
<ModelEngineeringPlot
  modelId="aircraft.performance"
  plotPresetId="aircraft.ldVsSpeed"
  scopeId="bwb-demo"
  inspectable
  inspectorMetrics={[
    { id: 'thrust', label: 'Thrust required', unit: 'N', significantFigures: 4 },
    { id: 'drag', label: 'Drag', unit: 'N', significantFigures: 4 },
  ]}
  client:load
/>
```

### `.md` files

Ordinary `.md` articles use the Markdown pipeline and **do not** support arbitrary interactive MDX components. To embed an interactive visualization, use a `.mdx` file (as done for `src/content/projects/bwb-aircraft-feasibility.mdx`). Document this limitation rather than placing a component tag in `.md` where it will render as literal text.

All components should include `client:load` (or `client:visible`) so uPlot/Three.js initialize on the client.

## 7. How to add a new plot

1. Add a `PlotDefinition` in `src/lib/engineering/plots/definitions.ts` (or a new file registered there).
2. Call `registerPlotDefinition({ id, modelId, title, sweepParam, xRange, xAxis, yAxis, series })`.
3. Reference it via `ModelEngineeringPlot` with `modelId` and `plotPresetId={definition.id}`.

Example:

```ts
registerPlotDefinition({
  id: 'aircraft.ldVsSpeed',
  modelId: 'aircraft.performance',
  title: 'L/D versus Airspeed',
  sweepParam: 'velocity',
  xRange: [40, 200],
  xAxis: { title: 'Airspeed', unit: 'm/s', type: 'linear', range: [40, 200] },
  yAxis: { title: 'Lift-to-drag ratio', unit: '-', type: 'linear' },
  series: [{ outputId: 'ld', label: 'L/D', mode: 'lines' }],
});
```

The definition sweeps `sweepParam` across `xRange`, calls `model.compute()` for each point, and plots the chosen `outputId`.

## 8. How to add a 3D model

Place a `.glb` or `.gltf` file in `public/` (it will be served at the configured base path). Use `EngineeringModelViewer`:

```tsx
<EngineeringModelViewer
  src="/models/aircraft.glb"
  showAxes
  showGrid
  showWireframe={false}
  fitToView
  client:load
  height={450}
/>
```

- Three.js and GLTFLoader/OrbitControls are imported lazily inside the component.
- GPU resources are disposed on unmount.
- Respects `prefers-reduced-motion` (no auto-animation) and the site light/dark theme.

## 9. Linking multiple visualizations to shared parameters

Use the same `scopeId` across components. They read/write the same scoped parameter store, so moving a slider in one updates all others:

```tsx
<ParameterSet model={model} scopeId="bwb-demo" />
<ModelEngineeringPlot modelId="aircraft.performance" plotPresetId="aircraft.ldVsSpeed" scopeId="bwb-demo" />
<EquationExplorer modelId="aircraft.performance" scopeId="bwb-demo" ... />
```

Do not use a global store; scopes are isolated by `scopeId`.

## 10. How to test numerical correctness

Tests live in `tests/` and run with Vitest (`npm run test`). Test:

- Analytical reference cases (hand-computed values).
- Edge cases: zero denominators, `NaN`, `Infinity`, out-of-range inputs, `e = 0` in drag polar.
- Unit conversions round-trip.
- `safeDivide` / `safeResult` fallbacks.
- `significantFigures` rounding.

Example:

```ts
import { aircraftPerformanceModel } from '../src/lib/engineering/models/aircraft-performance/bwb';
import { expect, it } from 'vitest';

it('computes steady level flight', () => {
  const out = aircraftPerformanceModel.compute({ mass: 70000, area: 300, ... });
  expect(out.lift.value).toBeCloseTo(expected, 4);
});
```

All model tests must not import rendering components.

## 11. Performance considerations

- Heavy libraries (uPlot, Three.js) are dynamic imports inside components; they are not in the site-wide bundle. uPlot is code-split into its own chunk by Vite.
- `EngineeringModelViewer` initializes WebGL only when visible and disposes on unmount.
- Prefer static HTML for titles, captions, and fallback text; enhance interactively after hydration.
- For large datasets, downsample before plotting rather than plotting every point.
- One failed visualization has an error/fallback state and does not break the article.
- Components use `client:load`/`client:visible` so they hydrate only on pages that include them.
- Chart instances are destroyed on unmount to prevent memory leaks.

## 12. GitHub Pages base path (`/Site/`)

The site deploys under a repository subpath (e.g. `/Site/`). Astro handles this via `base: process.env.BASE_PATH || '/'` set by the Pages workflow.

- Use the `url()` helper (`src/config.ts`) for internal links in Astro components.
- Dynamic imports of uPlot/Three.js are bundled by Vite and respect the base path.
- GLB/model assets referenced by `EngineeringModelViewer` must be placed in `public/` and referenced with a root-relative path that works under the base path.
- Do not hardcode `http://localhost` or assume hosting at `/`.

## 13. Geometry consistency

For the aircraft performance model, aspect ratio is related to wingspan and reference area by `AR = b² / S`. The default values are chosen to be geometrically consistent (span = 45 m, area = 300 m² → AR = 6.75). Users may override any parameter independently for exploratory analysis, but should be aware that physically inconsistent combinations produce physically meaningless results.

## 14. Limitations

- `.md` articles do not support interactive MDX components; use `.mdx`.
- uPlot does not provide SVG export; PNG export is available via canvas.
- The drag polar and aircraft performance models are low-order, steady-level-flight approximations — not CFD/FEA and not certified data.
- The BWB structural-mass penalty is an explicit illustrative assumption, not a validated structural prediction.
- Three.js WebGL is unavailable on some devices/components; the viewer shows an error/fallback state.
- KaTeX rendering in MDX requires the `remark-math`/`rehype-katex` pipeline (configured in `astro.config.mjs`).

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "Unable to load the interactive plot" | uPlot dynamic import failed | Ensure `import('uplot')` is a string literal so Vite code-splits it; check network for `uPlot.esm.*.js` |
| Equation renders vertically with whitespace | CSS `display: block` on KaTeX spans | Use `.eng-equation > span` not `.eng-equation span` to avoid targeting KaTeX internal spans |
| `Result output "lift" not produced by model` | Output ID mismatch | Ensure `resultOutputId` matches a key in the model's `outputs` schema |
| Plots don't update when sliders move | Missing reactive subscription | Components must subscribe to scoped state via `subscribeParameter` and trigger re-render on change |
| Duplicate form field IDs | Multiple component instances on one page | Use `useId()` for per-instance DOM IDs while sharing state via `scopeId` + `paramId` |

## Minimal examples

### 1. Interactive lift equation calculator

```mdx
import { EquationExplorer } from '../../components/engineering/equations/EquationExplorer';

<EquationExplorer
  modelId="aerodynamics.lift"
  equation="L=\\frac{1}{2}\\rho V^2 S C_L"
  resultOutputId="lift"
  resultLabel="Lift (steady level flight)"
  scopeId="lift-calc"
  client:load
/>
```

Reference case: ρ=1.225 kg/m³, V=100 m/s, S=20 m², C_L=0.5 → L = 61,250 N.

### 2. Parameterized drag polar plot

```mdx
import { ModelEngineeringPlot } from '../../components/engineering/plots/ModelEngineeringPlot';

<ModelEngineeringPlot
  modelId="aerodynamics.dragPolar"
  plotPresetId="aerodynamics.dragPolar"
  scopeId="drag-polar"
  client:load
  height={320}
 />
```

### 3. Direct `EngineeringPlot` config (no registry)

`EngineeringPlot` accepts a fully declarative `config` prop, useful for one-off plots without registering a definition:

```mdx
import { EngineeringPlot } from '../../components/engineering/plots/EngineeringPlot';

const ldPlotConfig = {
  title: 'Lift-to-drag ratio vs airspeed',
  description: 'Steady, level flight at sea level.',
  xAxis: { title: 'Airspeed', unit: 'm/s', type: 'linear', range: [40, 200] },
  yAxis: { title: 'L/D', unit: '-', type: 'linear' },
  series: [
    { id: 'ld', label: 'L/D', x: [40, 80, 120, 160, 200], y: [10, 15, 17, 14, 10], mode: 'lines' },
  ],
};

<EngineeringPlot
  config={ldPlotConfig}
  height={320}
  inspectable
  client:load
/>
```

### 4. Engineering comparison table

```mdx
import { EngineeringComparison } from '../../components/engineering/tables/EngineeringComparison';
import { getModel } from '../../lib/engineering/registry';

// Build config from live model outputs, see BWBTradeoffExplorer for pattern
```

### 5. Basic GLB aircraft model viewer

```mdx
import { EngineeringModelViewer } from '../../components/engineering/viewers/EngineeringModelViewer';

<EngineeringModelViewer
  src="/models/aircraft.glb"
  showAxes
  showGrid
  fitToView
  client:load
  height={400}
/>
```

*(A real `.glb` file must be provided in `public/models/`. This example does not ship a model file.)*

### 6. BWB tradeoff explorer

```mdx
import { BWBTradeoffExplorer } from '../../components/engineering/simulations/BWBTradeoffExplorer';

<BWBTradeoffExplorer client:load />
```

## Completed BWB tradeoff explorer

`src/components/engineering/simulations/BWBTradeoffExplorer.tsx` demonstrates the full framework:
drag polar, L/D vs airspeed, thrust vs airspeed, L/D vs structural-mass penalty, and a conventional-vs-adjustable comparison table, all sharing parameters through scope `bwb-tradeoff-explorer`. It is embedded in `src/content/projects/bwb-aircraft-feasibility.mdx`.

The comparison table shows the conventional reference (fixed defaults) versus the adjustable aircraft (live scoped state), so slider changes are immediately reflected in the table.