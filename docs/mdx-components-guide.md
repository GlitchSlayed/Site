# MDX engineering components

This is the author-facing reference for `src/components/mdx`. The components are tools for explaining work: show units, state assumptions, distinguish measurements from predictions, and link to the underlying data. No component runs Python or validates the physical correctness of a model.

## Start here: hydration matters

From a file directly inside `src/content/writing/` or `src/content/projects/`:

```mdx
import { FunctionPlot, ParamSlider, EngineeringNote } from '../../components/mdx';

<EngineeringNote kind="assumption" title="Idealized response">
  This example ignores aerodynamic damping. Values are illustrative.
</EngineeringNote>

<ParamSlider client:load scopeId="oscillator" id="omega" label="Angular frequency"
  min={1} max={8} step={0.1} defaultValue={3} unit="rad/s" />

<FunctionPlot client:visible scopeId="oscillator" title="Oscillator response"
  fn="cos(omega*x)" params={{omega: 3}} domain={[0, 10]}
  xLabel="Time" xUnit="s" yLabel="Normalized displacement" />
```

Use `client:load` for controls that other islands depend on. Use `client:visible` for plots and tables further down the article. The scoped store supplies the current snapshot even if the plot hydrates after its slider. Match `params` to slider defaults so the initial plot has meaningful values before its controls hydrate.

Static blocks (`EngineeringNote`, `EquationBlock`, `Measurement`, unbound `MetricCard`, `MetricGrid`, `Tooltip`) need no hydration directive. A scoped `MetricCard` does. `Tooltip` uses the site's shared tooltip controller, with a static accessible description as a fallback.

Astro cannot serialize functions across an island boundary. Pass strings to `FunctionPlot.fn` and plain data to `DataTable`; put callback-based expressions/formatters inside a React wrapper and hydrate that wrapper instead. Nested React children do not automatically become independently hydrated Astro islands. Prefer sibling MDX islands sharing a unique scope ID, or one React wrapper containing the complete interactive example.

## Component map

| Component | Use | Hydration |
| --- | --- | --- |
| LinePlot | Sampled curves, independent X sampling allowed | visible |
| ScatterPlot | Observations/categories, repeated X values allowed | visible |
| FunctionPlot | Mathematical expression or scoped parameter study | visible/load |
| HeatmapPlot | Rectangular scalar field, keyboard cell inspection | visible |
| ParamSlider | Bounded parameter with optional sweep control | load |
| ParamPlayground | Sliders, presets, reset and shared scope | load |
| MetricCard | A value, optional baseline delta or scoped value | only when scoped |
| MetricGrid | Responsive two/three/four-column metric layout | none |
| DataTable | Search, keyboard sorting, pagination, CSV | visible |
| NotebookCell | Displayed source with authored output, copy/collapse | visible |
| Tooltip | Inline definition with focus/hover description | shared site controller |
| EngineeringNote | Assumption, limitation, observation or decision | none |
| EquationBlock | Formula, explanation, variable definitions | none |
| Measurement | Value, units, reported uncertainty and conditions | none |

## Plots

LinePlot and ScatterPlot accept `title`, `description`, `toolbar`, `height` (360), `className`, `xLabel`, `xUnit`, `xScale`, `xRange`, `yLabel`, `yUnit`, `yScale`, `yRange`, `referenceLines`, and `shadedRegions`. Labels and plot titles support `$math$` strings. In JSX expressions escape LaTeX backslashes: `xLabel={'Angle $\\alpha$'}`.

`toolbar`: `floating` (default), `compact`, `minimal`, or `none`. Prefer compact controls for narrow newspaper columns. Axis scales are `linear` or `log`; log axes require positive finite observations and bounds. Author ranges set the initial viewport; Reset view autoscales the current data. Wheel zoom and drag pan operate in the selected scale's coordinate system.

### LinePlot

Required `series`: `{id?, label, x?, y, color?, mode?, visible?}[]`. Use shared `x` on the component when convenient. Modes are `lines`, `markers`, `lines+markers`. X/Y lengths must match within each series. The adapter sorts and aligns independent coordinates without modifying the original arrays or interpolating additional values. Duplicate X values within a line series are rejected: use ScatterPlot for repeated observations. Missing aligned samples are not zeros; the renderer connects available points across gaps. Do not use that connection to imply measurements in an untested regime.

```mdx
import { LinePlot } from '../../components/mdx';

<LinePlot client:visible title="Illustrative lift curve" toolbar="compact"
  xLabel="Angle of attack" xUnit="deg" yLabel="Lift coefficient"
  series={[
    {label:'Model', x:[-4,0,4,8], y:[-0.44,0,0.44,0.88]},
    {label:'Illustrative samples', x:[0,4,6,8], y:[0.01,0.40,0.61,0.79], mode:'lines+markers'}
  ]} />
```

### ScatterPlot

Use `points: {x,y,category?}[]` or `series: {id?,label,x,y,color?,visible?}[]`; explicit nonempty series take precedence. Groups can have different X coordinates. Repeated observations at one X are retained in separately labelled repeat series, never averaged or silently discarded. Marker-only series have no connecting line.

```mdx
import { ScatterPlot } from '../../components/mdx';

<ScatterPlot client:visible title="Illustrative repeat readings"
  xLabel="Speed" xUnit="m/s" yLabel="Force" yUnit="N"
  points={[
    {x:10,y:2.1,category:'Run A'}, {x:10,y:2.3,category:'Run A'},
    {x:15,y:4.9,category:'Run A'}, {x:12,y:3.2,category:'Run B'}
  ]} />
```

### FunctionPlot

Required `fn`: expression string, or array `{fn,label?,color?,mode?}`. Callable functions are supported inside React, not as serialized island props. Props: `domain` ([-10,10]), `samples` (250), `params` ({}), `scopeId`, `xLabel` ('x'), `xUnit`, `xScale`, `yLabel` ('f(x)'), `yUnit`, `yScale`, `yRange`, title/description/toolbar/height/className/referenceLines/shadedRegions. Sample count must be an integer from 1 to 100,000; use a few hundred for most articles. Invalid expressions report an error in the article.

Grammar: numbers, scientific notation, named parameters, parentheses, `+ - * / ^ **`. Powers associate right; `-x^2` means `-(x^2)`, and `2^-2` is 0.25. Constants: `pi`, `e`, `Math.PI`, `Math.E`. Explicit parameters can override bare constants. Functions: sin/cos/tan, asin/acos/atan/atan2, sinh/cosh/tanh, exp, log/log10/log2, sqrt/cbrt, abs, round/floor/ceil, min/max/pow. `log` is natural log. Nonfinite results become missing samples. This is a math grammar, not JavaScript; property access, assignment and arbitrary code are rejected.

### References and regions

```js
referenceLines={[
  {id:'limit',label:'Design limit',axis:'y',value:5,color:'#b83e18',dash:'dash'}
]}
shadedRegions={[
  {id:'tested',label:'Tested range',x0:10,x1:15,color:'rgba(184,62,24,.08)'}
]}
```

Reference labels are required. Dash may be `dash`, `dot`, `dashdot`, or omitted for solid. Regions accept x0/x1/y0/y1, optional label/color/opacity and xRange/yRange aliases.

## HeatmapPlot

Required `data: number[][]`, with equal row lengths. Row zero is the bottom row; columns advance left to right. `xDomain`/`yDomain` default to [0,1]; optional `zRange` fixes the color scale. All supplied ranges must be finite and increasing. Nonfinite cells are transparent, revealing a checkerboard, and read as “No measurement.” The canvas scales to its container and pixel density. Hover or focus it and use arrow keys to inspect cells. The fixed readout stays outside the data field.

Other props: `title`, `description`, `xLabel`, `yLabel`, `zLabel`, corresponding `xUnit`/`yUnit`/`zUnit`, `height` (340), `interpolate` (true), `colormap` ('viridis'), `className`. Set `interpolate={false}` for discrete measurements; smoothing changes appearance, not data. Empty/ragged grids and invalid ranges display errors. For a nonvisual full dataset, place a DataTable alongside the figure.

## Controls and metrics

`ParamSlider`: required `id,label,min,max,defaultValue`; optional `step,unit,symbol,scopeId,animate,onChange,className`. `animate` exposes an explicit play button; it does not start automatically. Values published by the control are clamped. Animation pauses when the control leaves view, the tab hides, or the motion preference changes to reduced. `onChange` belongs inside a React wrapper.

`ParamPlayground`: required `scopeId,parameters`; parameters use the slider fields. Optional `presets: Record<string,Record<string,number>>`, `title`, `description`, `animate`, `children`, `className`. Presets ignore unknown/nonfinite values and clamp known parameters. The selected preset reflects actual current values, including changes from other scoped controls. Reset restores parameter defaults.

Scopes persist for the lifetime of the document, not just one island. Use page-unique names such as `wind-tunnel-lift-study`. Subscriptions detach on unmount. Explicit `destroyScope` is for a React owner that knows no sibling consumers remain; do not destroy a scope from an individual slider cleanup.

`MetricCard`: required label; optional `value: number|string`, unit, symbol, description, baseline, `better` ('higher'/'lower'/'neutral'), significantFigures (4), engineering (false), scopeId/paramId, className. Invalid numeric values show an em dash; zero/invalid baselines have no percentage delta. `MetricGrid columns={2|3|4}` caps desktop columns and stacks on narrow layouts.

## DataTable

Required `columns` and `data`. Columns: `{key,label,unit?,align?,sortable?,format?}`. Sorting defaults on and uses a focusable button, Enter/Space activation and `aria-sort`. Missing values sort last in both directions. Numeric cells align right unless overridden. Props: title, description, pageSize (10), searchable (true), downloadable (true), className. Custom positive page sizes appear in the selector; invalid sizes fall back to 10.

CSV exports the complete filtered/sorted result, not just the current page, using raw values. Text that could be interpreted as a spreadsheet formula receives a leading apostrophe; actual numeric negatives remain numeric. Embedded quotes/newlines are escaped. `format` callbacks must live inside a React wrapper; they are display-only.

## NotebookCell and Tooltip

`NotebookCell` displays supplied `code`, language ('python'), inputNumber (1), title, initialCollapsed (false), children, className. It does **not** execute source or generate its output. Copy failure produces visible feedback. Collapse has an expanded state and stable controlled region; print includes the code.

`Tooltip` requires content and children; optional subtitle, shortcut, position ('top'/'bottom'/'left'/'right'), as ('span'/'abbr'/'div'), className. It supplies a persistent accessible description. Use it for short definitions, not essential assumptions or interactive content. Use EngineeringNote for information that must stay visible.

## New static engineering blocks

```mdx
import { EngineeringNote, EquationBlock, Measurement } from '../../components/mdx';

<EngineeringNote kind="limitation" title="Not a stall model">
  Thin-airfoil theory does not predict separated flow. This comparison is limited to small angles.
</EngineeringNote>

<EquationBlock label="Lift model" equation={'L = \\frac{1}{2}\\rho V^2 S C_L'}
  description="Lift equals dynamic pressure times reference area times lift coefficient."
  variables={[
    {symbol:'L',meaning:'Lift',unit:'N'},
    {symbol:'\\rho',meaning:'Air density',unit:'kg/m³'},
    {symbol:'V',meaning:'Freestream speed',unit:'m/s'},
    {symbol:'S',meaning:'Reference area',unit:'m²'},
    {symbol:'C_L',meaning:'Lift coefficient'}
  ]} />

<Measurement label="Illustrative force reading" value={12.4} uncertainty={0.3} unit="N"
  uncertaintyLabel="Example instrument tolerance, not a confidence interval"
  method="Calibrated load cell" conditions="Illustrative data only" />
```

EngineeringNote: kind defaults to observation; alternatives assumption/limitation/decision. Title is optional; children required.
EquationBlock: equation is raw LaTeX **without** dollar delimiters; description required, label/variables optional. Each variable has symbol, meaning, optional unit.
Measurement: label/value/unit required; uncertainty must be nonnegative and in the same unit as value. Optional uncertaintyLabel, method, conditions, significantFigures (4). It never estimates uncertainty or invents a confidence level.

## Verification and editor integration

The prop interfaces beside each component are the canonical machine-readable contract. An editor should emit those props and the appropriate hydration directive. Do not copy obsolete block schemas from previous documentation. Keep all examples illustrative unless sourced from actual measurements.

Run `bun run test:core`, `bun run test`, `bun run check`, and the browser workflow in `docs/audit-fixes.md`. See `docs/mdx-focused-audit.md` for findings, fixes and verification limits; see `docs/giscus-integration.md` for discussion configuration and migration.
