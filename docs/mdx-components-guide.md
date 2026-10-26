# MDX Interactive Components Guide & Reference

This document is the comprehensive reference for the interactive engineering, scientific, and data visualization components available in MDX (`.mdx`) articles and Astro pages. It is structured to serve as both an authoring manual and an editor/CMS integration specification.

All components are exported from `src/components/mdx`:
```tsx
import {
  LinePlot,
  ScatterPlot,
  FunctionPlot,
  HeatmapPlot,
  ParamSlider,
  ParamPlayground,
  MetricCard,
  MetricGrid,
  DataTable,
  NotebookCell,
} from '../../components/mdx';
```

---

## 1. Component Quick Reference

| Component | Category | Purpose | Reactive Scope (`scopeId`) |
| :--- | :--- | :--- | :---: |
| [`<LinePlot />`](#2-lineplot) | Scientific Plot | Multi-series continuous line/marker graphs (uPlot) | No |
| [`<ScatterPlot />`](#3-scatterplot) | Scientific Plot | Categorized or multi-series scatter points (uPlot) | No |
| [`<FunctionPlot />`](#4-functionplot) | Scientific Plot | Real-time mathematical expression curve sweeper | **Yes** |
| [`<HeatmapPlot />`](#5-heatmapplot) | Scientific Plot | 2D scalar grid matrix with scientific colormaps | No |
| [`<ParamSlider />`](#6-paramslider) | Control | Standalone slider with animation sweep & numeric readout | **Yes** |
| [`<ParamPlayground />`](#7-paramplayground) | Control | Multi-parameter interactive dashboard with presets | **Yes** |
| [`<MetricCard />`](#8-metriccard) | Metric & KPI | Reactive metric card with baseline delta comparison | **Yes** |
| [`<MetricGrid />`](#9-metricgrid) | Layout | Responsive grid container for `<MetricCard />`s | No |
| [`<DataTable />`](#10-datatable) | Data Table | Sortable, searchable, paginated table with CSV export | No |
| [`<NotebookCell />`](#11-notebookcell) | Code / Exec | Computational notebook cell (`In [n]:`) with collapsible code | No |

---

## 2. Shared Types & Common Props

### A. Reference Lines (`PlotReferenceLine`)
Used in `LinePlot`, `ScatterPlot`, and `FunctionPlot` to draw threshold or operating markers:
```typescript
interface PlotReferenceLine {
  id: string;                                   // Unique key (e.g., 'v-stall')
  label?: string;                               // Optional visible label on canvas
  value: number;                                // Value on axis
  axis: 'x' | 'y';                              // Target axis
  color?: string;                               // Stroke color (e.g., '#ff603b')
  dash?: 'solid' | 'dash' | 'dot' | 'dashdot';  // Stroke dash style
}
```

### B. Shaded Regions (`PlotShadedRegion`)
Used to highlight physical regimes (e.g., flight envelopes, stall margins, confidence intervals):
```typescript
interface PlotShadedRegion {
  id: string;                     // Unique key (e.g., 'transonic-regime')
  label?: string;                 // Text label rendered in top-left of region
  x0?: number;                    // Start of X range (null/undefined = start of plot)
  x1?: number;                    // End of X range (null/undefined = end of plot)
  y0?: number;                    // Start of Y range
  y1?: number;                    // End of Y range
  color?: string;                 // Fill color (e.g., 'rgba(255, 96, 59, 0.10)')
}
```

### C. Toolbar Options (`toolbar`)
Plots support four toolbar modes:
- `'floating'` (default): Sleek glass pill floating above the top-right corner of the canvas.
- `'compact'`: Embedded inside the header row next to the plot title.
- `'minimal'`: Compact reset-only button.
- `'none'`: Hides all modebars and action buttons.

---

## 3. Component Specifications

### 2. LinePlot

Renders high-performance interactive 2D line curves powered by `uPlot`. Features natural 2D panning, mouse-wheel cursor zoom, click jitter rejection, PNG and CSV data export, luminous vertical gradient area shading, and neon curve bloom.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `series` | `LinePlotSeriesInput[]` | **Required** | Array of data series to plot. |
| `x` | `number[]` | `undefined` | Shared X-axis array used if a series omits `x`. |
| `title` | `string` | `undefined` | Header title (supports `$math$` notation). |
| `description` | `string` | `undefined` | Subtitle description (supports `$math$` notation). |
| `toolbar` | `'floating' \| 'compact' \| 'minimal' \| 'none'` | `'floating'` | Modebar control style. |
| `xLabel` | `string` | `'X'` | X-axis title label. |
| `xUnit` | `string` | `''` | X-axis unit (e.g., `'m/s'`, `'deg'`). |
| `xScale` | `'linear' \| 'log'` | `'linear'` | X-axis scale distribution. |
| `xRange` | `[number, number]` | `undefined` | Manual `[min, max]` X limits. Defaults to autoscale. |
| `yLabel` | `string` | `'Y'` | Y-axis title label. |
| `yUnit` | `string` | `''` | Y-axis unit (e.g., `'N'`, `'Pa'`). |
| `yScale` | `'linear' \| 'log'` | `'linear'` | Y-axis scale distribution. |
| `yRange` | `[number, number]` | `undefined` | Manual `[min, max]` Y limits. Defaults to autoscale. |
| `height` | `number` | `360` | Canvas viewport height in pixels. |
| `referenceLines` | `PlotReferenceLine[]` | `undefined` | Vertical or horizontal marker lines. |
| `shadedRegions` | `PlotShadedRegion[]` | `undefined` | Background regime bands. |
| `className` | `string` | `''` | Custom CSS wrapper class. |

#### Series Schema (`LinePlotSeriesInput`)
```typescript
interface LinePlotSeriesInput {
  id?: string;                                    // Unique identifier
  label: string;                                  // Legend and tooltip display label
  x?: number[];                                   // Series-specific X array
  y: number[];                                    // Y values array (must match X length)
  color?: string;                                 // Hex/rgb line color (auto-palette if omitted)
  mode?: 'lines' | 'markers' | 'lines+markers';   // Drawing style (default: 'lines')
  visible?: boolean;                              // Initial visibility toggle (default: true)
}
```

#### MDX Example
```mdx
<LinePlot
  title="Airfoil Lift vs Angle of Attack ($\alpha$)"
  description="Comparison of NACA 0012 experimental data vs inviscid thin-airfoil theory."
  xLabel="Angle of Attack"
  xUnit="deg"
  yLabel="Lift Coefficient $C_L$"
  yUnit="-"
  height={380}
  referenceLines={[
    { id: 'stall', label: 'Stall Angle (16°)', value: 16, axis: 'x', color: '#ff603b', dash: 'dash' }
  ]}
  shadedRegions={[
    { id: 'post-stall', label: 'Post-stall Separation', x0: 16, x1: 25, color: 'rgba(255, 96, 59, 0.08)' }
  ]}
  series={[
    {
      label: 'Experimental (Re = 3×10⁶)',
      x: [-4, 0, 4, 8, 12, 16, 18, 20],
      y: [-0.42, 0.0, 0.44, 0.86, 1.25, 1.55, 1.40, 1.20],
      color: '#ff603b',
      mode: 'lines+markers'
    },
    {
      label: 'Thin Airfoil Theory ($2\pi\alpha$)',
      x: [-4, 0, 4, 8, 12, 16, 20],
      y: [-0.438, 0.0, 0.438, 0.876, 1.314, 1.752, 2.19],
      color: '#38bdf8',
      mode: 'lines'
    }
  ]}
/>
```

---

### 3. ScatterPlot

Designed for discrete observational, experimental, or categorical data points. Accepts either grouped points with automatic legend categories or multi-series point arrays.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `points` | `ScatterPoint[]` | `undefined` | Flat array of points with optional `category` grouping. |
| `series` | `ScatterSeriesInput[]` | `undefined` | Direct array of explicit scatter series. |
| `title` | `string` | `undefined` | Plot title. |
| `description` | `string` | `undefined` | Plot subtitle. |
| `xLabel` | `string` | `'X'` | X-axis title label. |
| `xUnit` | `string` | `''` | X-axis unit. |
| `yLabel` | `string` | `'Y'` | Y-axis title label. |
| `yUnit` | `string` | `''` | Y-axis unit. |
| `height` | `number` | `360` | Height in pixels. |
| `referenceLines` | `PlotReferenceLine[]` | `undefined` | Reference lines. |
| `shadedRegions` | `PlotShadedRegion[]` | `undefined` | Regime bands. |

#### Points Schema (`ScatterPoint`)
```typescript
interface ScatterPoint {
  x: number;
  y: number;
  category?: string;  // Auto-grouped into legend entries with distinct colors
}
```

#### MDX Example
```mdx
<ScatterPlot
  title="Thrust vs Mass Flow Rate"
  description="Rocket test stand firings categorized by nozzle expansion ratio."
  xLabel="Oxidizer Mass Flow"
  xUnit="kg/s"
  yLabel="Measured Thrust"
  yUnit="kN"
  points={[
    { x: 12.4, y: 34.2, category: 'Expansion ratio 15' },
    { x: 14.1, y: 38.9, category: 'Expansion ratio 15' },
    { x: 16.5, y: 45.1, category: 'Expansion ratio 15' },
    { x: 12.6, y: 38.4, category: 'Expansion ratio 40' },
    { x: 14.8, y: 44.7, category: 'Expansion ratio 40' },
    { x: 16.9, y: 51.2, category: 'Expansion ratio 40' },
  ]}
/>
```

---

### 4. FunctionPlot

Compiles and plots mathematical expressions in real-time. Can be bound to a `scopeId` so that dragging a `<ParamSlider />` dynamically re-evaluates the curve at 60 FPS without page reload.

#### Supported Mathematical Syntax in Expression Strings
- **Operators**: `+`, `-`, `*`, `/`, `^` (or `**`)
- **Constants**: `pi`, `e`
- **Functions**: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `exp`, `log` (natural ln), `log10`, `log2`, `sqrt`, `cbrt`, `abs`, `round`, `floor`, `ceil`, `min`, `max`
- **Parameters**: Any parameter name passed in `params` or bound via `scopeId` (e.g. `k * x^2 + c`)

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `fn` | `string \| MathFn \| FunctionEntry[]` | **Required** | Mathematical expression, JS function, or array of function entries. |
| `domain` | `[number, number]` | `[-10, 10]` | `[min, max]` sweep range for the $x$ variable. |
| `samples` | `number` | `250` | Number of evaluated evaluation points along domain. |
| `params` | `Record<string, number>` | `{}` | Static parameter dictionary passed to expression. |
| `scopeId` | `string` | `undefined` | Reactive scope ID to link with sliders & controls. |
| `xLabel` | `string` | `'x'` | X-axis title. |
| `xUnit` | `string` | `''` | X-axis unit. |
| `yLabel` | `string` | `'f(x)'` | Y-axis title. |
| `yUnit` | `string` | `''` | Y-axis unit. |
| `yRange` | `[number, number]` | `undefined` | Manual Y bounds. Autoscale used if omitted. |
| `height` | `number` | `360` | Height in pixels. |

#### Multi-Function Entry Schema (`FunctionEntry`)
```typescript
interface FunctionEntry {
  fn: string | ((x: number, params?: Record<string, number>) => number);
  label?: string;                                 // Series name in legend
  color?: string;                                 // Line color
  mode?: 'lines' | 'markers' | 'lines+markers';   // Drawing style
}
```

#### MDX Example: Standalone
```mdx
<FunctionPlot
  title="Damped Harmonic Oscillator"
  description="Envelope decay $e^{-\gamma t} \cos(\omega t)$"
  fn="exp(-0.2 * x) * cos(3 * x)"
  domain={[0, 20]}
  samples={300}
  xLabel="Time $t$"
  xUnit="s"
  yLabel="Displacement $x(t)$"
  yUnit="m"
/>
```

#### MDX Example: Reactively Linked to Sliders via `scopeId`
```mdx
<ParamPlayground
  scopeId="shockwave-scope"
  title="Oblique Shockwave Parameters"
  parameters={[
    { id: 'mach', label: 'Upstream Mach Number $M_1$', min: 1.2, max: 5.0, step: 0.1, defaultValue: 2.5 },
    { id: 'theta', label: 'Deflection Angle $\theta$', min: 5, max: 30, step: 1, defaultValue: 15, unit: 'deg' }
  ]}
/>

<FunctionPlot
  scopeId="shockwave-scope"
  title="Pressure Ratio Across Oblique Shock"
  fn="1 + (2 * 1.4 / (1.4 + 1)) * ((mach * sin(x * pi / 180))^2 - 1)"
  domain={[15, 90]}
  xLabel="Shock Wave Angle $\beta$"
  xUnit="deg"
  yLabel="Static Pressure Ratio $p_2 / p_1$"
  yUnit="-"
/>
```

---

### 5. HeatmapPlot

Renders continuous 2D scalar fields onto a high-resolution canvas with scientific colormaps, bilinear interpolation, and interactive cursor inspection showing exact `(x, y, z)` values.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data` | `number[][]` | **Required** | 2D matrix of values `[row][col]` ($Y \times X$). |
| `xDomain` | `[number, number]` | `[0, 1]` | Physical range $[x_{min}, x_{max}]$ along columns. |
| `yDomain` | `[number, number]` | `[0, 1]` | Physical range $[y_{min}, y_{max}]$ along rows. |
| `zRange` | `[number, number]` | Auto-extent | Min/max scale clamp for color normalization. |
| `colormap` | `'viridis' \| 'turbo' \| 'inferno' \| 'coolwarm' \| 'grayscale'` | `'viridis'` | Scientific colormap. |
| `interpolate` | `boolean` | `true` | If true, applies smooth bilinear interpolation. If false, renders discrete pixel blocks. |
| `title` | `string` | `undefined` | Plot title. |
| `description` | `string` | `undefined` | Plot subtitle. |
| `xLabel` | `string` | `'X'` | X-axis label. |
| `xUnit` | `string` | `''` | X-axis unit. |
| `yLabel` | `string` | `'Y'` | Y-axis label. |
| `yUnit` | `string` | `''` | Y-axis unit. |
| `zLabel` | `string` | `'Z'` | Scalar colorbar label. |
| `zUnit` | `string` | `''` | Colorbar unit. |
| `height` | `number` | `340` | Canvas height in pixels. |

#### Colormaps Reference
- `'viridis'`: Perceptually uniform sequential colormap (blue $\to$ green $\to$ yellow). Standard for aerospace pressure fields.
- `'turbo'`: Enhanced rainbow alternative with smooth color gradients and high visual dynamic range.
- `'inferno'`: Black $\to$ red $\to$ yellow thermal radiation field.
- `'coolwarm'`: Diverging blue $\to$ gray $\to$ red colormap. Ideal for differential pressure ($\Delta p$) or velocity anomalies ($\pm \Delta v$).
- `'grayscale'`: High-contrast monochrome intensity map.

#### MDX Example
```mdx
<HeatmapPlot
  title="Surface Pressure Coefficient Distribution ($C_p$)"
  description="Upper wing surface pressure field at Mach 0.78."
  xDomain={[0, 100]}
  xLabel="Chordwise Station $x/c$"
  xUnit="%"
  yDomain={[0, 30]}
  yLabel="Spanwise Station $y/b$"
  yUnit="m"
  zLabel="Pressure Coefficient $C_p$"
  zUnit="-"
  colormap="viridis"
  interpolate={true}
  data={[
    [-0.85, -0.72, -0.55, -0.30, -0.10],
    [-1.12, -0.95, -0.68, -0.42, -0.15],
    [-1.35, -1.18, -0.82, -0.51, -0.18],
    [-1.05, -0.88, -0.60, -0.38, -0.12]
  ]}
/>
```

---

### 6. ParamSlider

A standalone slider control with synchronized numeric input, square aerospace thumb styling, live parameter display, and an optional **animated auto-sweep loop** (play/pause button).

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Required** | Identifier for this parameter within the scope. |
| `label` | `string` | **Required** | Display label (supports `$math$` notation). |
| `min` | `number` | **Required** | Minimum bound. |
| `max` | `number` | **Required** | Maximum bound. |
| `defaultValue` | `number` | **Required** | Initial parameter value. |
| `step` | `number` | Auto | Step increment. Auto-calculated based on range span if omitted. |
| `unit` | `string` | `''` | Unit of measure. |
| `symbol` | `string` | `undefined` | Symbolic abbreviation (e.g. `$\alpha$`, `$V$`). |
| `scopeId` | `string` | `undefined` | Scope ID to broadcast updates across. |
| `animate` | `boolean` | `false` | Shows a play/pause button that oscillates the parameter value between min and max. |
| `onChange` | `(val: number) => void` | `undefined` | Direct callback invoked on input. |

#### MDX Example
```mdx
<ParamSlider
  scopeId="aero-demo"
  id="airspeed"
  label="True Airspeed"
  symbol="$V_\infty$"
  min={40}
  max={240}
  step={5}
  defaultValue={120}
  unit="m/s"
  animate={true}
/>
```

---

### 7. ParamPlayground

A composite parameter card that houses multiple sliders, a global **"Reset All"** action, and optional **Named Presets** buttons.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `scopeId` | `string` | **Required** | Shared parameter scope for all enclosed controls. |
| `parameters` | `ParamDefinition[]` | **Required** | Array of parameter configurations. |
| `presets` | `Record<string, Record<string, number>>` | `undefined` | Dictionary of named preset buttons that assign sets of values. |
| `title` | `string` | `'Interactive Parameters'` | Card header title. |
| `description` | `string` | `undefined` | Subtitle description. |
| `animate` | `boolean` | `false` | Enable animated sweep on all sliders. |

#### Parameter Schema (`ParamDefinition`)
```typescript
interface ParamDefinition {
  id: string;             // Parameter key
  label: string;          // Label (supports $math$)
  min: number;            // Min bound
  max: number;            // Max bound
  defaultValue: number;   // Starting value
  step?: number;          // Step increment
  unit?: string;          // Unit string
  symbol?: string;        // Symbol (e.g. '$m$')
  animate?: boolean;      // Enable play button for this slider
}
```

#### MDX Example
```mdx
<ParamPlayground
  scopeId="rocket-ascent"
  title="Rocket Staging Configuration"
  description="Tune stage masses and specific impulse to observe payload fraction."
  presets={{
    'Light Orbital': { payloadMass: 250, dryMass: 1200, isp: 310 },
    'Heavy Cargo': { payloadMass: 2500, dryMass: 4500, isp: 345 }
  }}
  parameters={[
    { id: 'payloadMass', label: 'Payload Mass', min: 100, max: 5000, step: 50, defaultValue: 500, unit: 'kg' },
    { id: 'dryMass', label: 'Stage Dry Mass', min: 800, max: 10000, step: 100, defaultValue: 2000, unit: 'kg' },
    { id: 'isp', label: 'Specific Impulse $I_{sp}$', min: 250, max: 460, step: 5, defaultValue: 320, unit: 's' }
  ]}
/>
```

---

### 8. MetricCard & 9. MetricGrid

Presents key engineering metrics, KPIs, and calculated values. Supports:
- Static values or live parameter subscription via `scopeId` + `paramId`.
- Baseline delta comparison showing percentage shift: `(+14.2%)` / `(-8.1%)`.
- Evaluative coloring (`better='higher'` turns increase green; `better='lower'` turns decrease green).
- Engineering notation with standard SI prefixes ($\mu, m, k, M, G$).

#### MetricCard Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `label` | `string` | **Required** | Name of metric (supports `$math$`). |
| `value` | `number \| string` | `undefined` | Static value if not bound to a scope. |
| `scopeId` | `string` | `undefined` | Scope ID to subscribe to. |
| `paramId` | `string` | `undefined` | Parameter ID within `scopeId`. |
| `unit` | `string` | `''` | Unit suffix. |
| `symbol` | `string` | `undefined` | Mathematical symbol (e.g., `$L/D$`). |
| `baseline` | `number` | `undefined` | Reference baseline to calculate `(+Δ%)` against. |
| `better` | `'higher' \| 'lower' \| 'neutral'` | `'neutral'` | Affects delta badge coloring (green vs red). |
| `significantFigures` | `number` | `4` | Significant figures formatting precision. |
| `engineering` | `boolean` | `false` | If true, formats numbers into engineering SI prefixes ($k, M, G, m, \mu$). |
| `description` | `string` | `undefined` | Sub-label explanatory footnote. |

#### MetricGrid Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `columns` | `2 \| 3 \| 4` | `3` | Maximum number of grid columns on desktop screens. |
| `children` | `ReactNode` | **Required** | `<MetricCard />` components. |

#### MDX Example
```mdx
<MetricGrid columns={3}>
  <MetricCard
    label="Lift-to-Drag Ratio"
    symbol="$L/D$"
    value={19.4}
    baseline={17.5}
    better="higher"
    description="Cruise configuration at Mach 0.82"
  />
  <MetricCard
    label="Fuel Consumption"
    value={1840}
    unit="kg/h"
    baseline={2100}
    better="lower"
    description="Per engine at 35,000 ft"
  />
  <MetricCard
    scopeId="rocket-ascent"
    paramId="payloadMass"
    label="Current Payload"
    unit="kg"
    description="Reactively mirrors slider"
  />
</MetricGrid>
```

---

### 10. DataTable

A feature-rich engineering data table designed for comparisons, measurement logs, and design matrix summaries. Includes live multi-column search filtering, column sorting, pagination controls, and one-click **CSV download**.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `columns` | `DataTableColumn[]` | **Required** | Column configuration schema. |
| `data` | `Array<Record<string, any>>` | **Required** | Array of row objects. |
| `title` | `string` | `undefined` | Table caption title. |
| `description` | `string` | `undefined` | Explanatory note above table. |
| `pageSize` | `number` | `10` | Rows per page (user can change to 25, 50, or 'all'). |
| `searchable` | `boolean` | `true` | Renders a search input filtering all text columns. |
| `downloadable` | `boolean` | `true` | Renders a button to download the current table as `.csv`. |

#### Column Schema (`DataTableColumn`)
```typescript
interface DataTableColumn {
  key: string;                          // Row property key
  label: string;                        // Header label (supports $math$)
  unit?: string;                        // Unit badge rendered beneath label
  align?: 'left' | 'center' | 'right';  // Text alignment (default: 'left', numbers use 'right')
  sortable?: boolean;                   // Enables click-to-sort (default: true)
  format?: (val: any) => string;        // Custom row renderer function
}
```

#### MDX Example
```mdx
<DataTable
  title="Commercial Jet Engine Performance Comparison"
  description="Sea-level static ratings and cruise specific fuel consumption."
  pageSize={5}
  downloadable={true}
  searchable={true}
  columns={[
    { key: 'engine', label: 'Engine Model', sortable: true },
    { key: 'thrust', label: 'Takeoff Thrust', unit: 'kN', align: 'right', sortable: true },
    { key: 'bypass', label: 'Bypass Ratio', unit: ':1', align: 'right', sortable: true },
    { key: 'sfc', label: 'Cruise TSFC', unit: 'g/(kN·s)', align: 'right', sortable: true },
    { key: 'application', label: 'Application Aircraft' }
  ]}
  data={[
    { engine: 'GE9X-105B', thrust: 470, bypass: 10.0, sfc: 14.8, application: 'Boeing 777X' },
    { engine: 'Trent XWB-97', thrust: 430, bypass: 9.6, sfc: 15.1, application: 'Airbus A350-1000' },
    { engine: 'GEnx-1B76', thrust: 340, bypass: 9.3, sfc: 15.7, application: 'Boeing 787-10' },
    { engine: 'CFM LEAP-1A', thrust: 143, bypass: 11.0, sfc: 14.2, application: 'Airbus A320neo' },
    { engine: 'PW1100G-JM', thrust: 147, bypass: 12.5, sfc: 14.1, application: 'Airbus A320neo' }
  ]}
/>
```

---

### 11. NotebookCell

Emulates an interactive Jupyter or Colab notebook code execution cell. Ideal for tutorials, computational derivations, and data science walkthroughs.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `code` | `string` | `undefined` | Source code displayed in the input block. |
| `language` | `string` | `'python'` | Language identifier for formatting tag. |
| `inputNumber` | `number` | `1` | Execution count number rendered in `In [n]:`. |
| `title` | `string` | `undefined` | Header title on code cell. |
| `initialCollapsed` | `boolean` | `false` | If true, code block starts collapsed (shows "Show Code ▾" button). |
| `children` | `ReactNode` | **Required** | The output of the cell (can be plots, tables, metrics, or HTML). |

#### MDX Example
```mdx
<NotebookCell
  inputNumber={3}
  language="python"
  title="compute_drag_polar.py"
  initialCollapsed={false}
  code={`import numpy as np

def drag_polar(cl, cd0=0.02, ar=8.5, e=0.82):
    k = 1.0 / (np.pi * e * ar)
    return cd0 + k * (cl ** 2)

cl_sweep = np.linspace(-0.2, 1.8, 100)
cd_sweep = drag_polar(cl_sweep)
print(f"Minimum drag: {cd_sweep.min():.4f}")`}
>
  <MetricCard
    label="Minimum Drag Coefficient $C_{D,0}$"
    value={0.0200}
    unit="-"
    description="Calculated from zero-lift condition"
  />
</NotebookCell>
```

---

## 4. Scoped State Architecture (For Tool Builders)

When building graphical editors, AST transformers, or CMS extensions, understanding the **parameter event bus** is essential:

```
[ ParamSlider ] or [ ParamPlayground ]
        │
        ▼ (setParameter)
[ Scoped State Store: scopedState.ts ]
   (Keyed by: `scopeId` + `paramId`)
        │
        ├──▶ [ FunctionPlot ] (evaluates f(x, params) on 60fps raf)
        ├──▶ [ MetricCard ]   (updates displayed number & delta)
        └──▶ [ Custom Model Plots ]
```

1. **Isolation**: Visualizations with different `scopeId` strings are strictly isolated. No global state leakage occurs between articles or across different sections of the same page.
2. **Reactivity**: Setting a parameter updates subscribers synchronously. Numerical evaluators debounce animations to browser `requestAnimationFrame` boundaries to avoid layout thrashing.
3. **Clean Teardown**: Components unregister their subscriptions on unmount.

---

## 5. Editor / CMS Block Schema Specification

To integrate these components into a structured visual editor (e.g., TinaCMS, Sanity, Strapi, or a custom markdown block inserter), use the following JSON schemas:

### A. LinePlot Block Schema
```json
{
  "name": "LinePlot",
  "label": "2D Line Plot",
  "fields": [
    { "name": "title", "label": "Title", "type": "string" },
    { "name": "description", "label": "Description", "type": "string" },
    { "name": "xLabel", "label": "X Axis Label", "type": "string", "default": "X" },
    { "name": "xUnit", "label": "X Axis Unit", "type": "string" },
    { "name": "yLabel", "label": "Y Axis Label", "type": "string", "default": "Y" },
    { "name": "yUnit", "label": "Y Axis Unit", "type": "string" },
    { "name": "height", "label": "Height (px)", "type": "number", "default": 360 },
    {
      "name": "series",
      "label": "Data Series",
      "type": "list",
      "fields": [
        { "name": "label", "label": "Series Name", "type": "string", "required": true },
        { "name": "x", "label": "X Values (JSON array)", "type": "string" },
        { "name": "y", "label": "Y Values (JSON array)", "type": "string", "required": true },
        { "name": "color", "label": "Color Hex", "type": "string" },
        { "name": "mode", "label": "Draw Mode", "type": "select", "options": ["lines", "markers", "lines+markers"] }
      ]
    }
  ]
}
```

### B. FunctionPlot Block Schema
```json
{
  "name": "FunctionPlot",
  "label": "Mathematical Function Plot",
  "fields": [
    { "name": "title", "label": "Title", "type": "string" },
    { "name": "fn", "label": "Function Expression f(x)", "type": "string", "required": true, "placeholder": "sin(x) / x" },
    { "name": "scopeId", "label": "Reactive Scope ID", "type": "string" },
    { "name": "domain", "label": "Domain [Min, Max]", "type": "list", "of": "number", "default": [-10, 10] },
    { "name": "samples", "label": "Resolution Samples", "type": "number", "default": 250 },
    { "name": "xLabel", "label": "X Axis Label", "type": "string", "default": "x" },
    { "name": "yLabel", "label": "Y Axis Label", "type": "string", "default": "f(x)" },
    { "name": "height", "label": "Height (px)", "type": "number", "default": 360 }
  ]
}
```

### C. MetricCard Block Schema
```json
{
  "name": "MetricCard",
  "label": "Metric Card",
  "fields": [
    { "name": "label", "label": "Metric Name", "type": "string", "required": true },
    { "name": "value", "label": "Static Value", "type": "string" },
    { "name": "unit", "label": "Unit", "type": "string" },
    { "name": "symbol", "label": "Math Symbol", "type": "string" },
    { "name": "scopeId", "label": "Reactive Scope ID", "type": "string" },
    { "name": "paramId", "label": "Parameter Key", "type": "string" },
    { "name": "baseline", "label": "Baseline Value", "type": "number" },
    { "name": "better", "label": "Desirable Trend", "type": "select", "options": ["higher", "lower", "neutral"] },
    { "name": "description", "label": "Footnote", "type": "string" }
  ]
}
```

---

## 6. Verification & Troubleshooting

- **CSP (Content Security Policy)**: All plotting components use `uPlot` and native Canvas 2D without `eval()` or un-sanitized script execution.
- **SSR & Hydration**: Components are safely isolated to run client-side where `window` and `document` are present. In Astro `.astro` or `.mdx` pages, instantiate with `client:visible` or `client:load`:
  ```mdx
  <LinePlot client:visible series={...} />
  ```
- **Math Formatting**: Any string in `title`, `label`, `xLabel`, or `yLabel` supporting math can use `$equation$` formatting (processed safely through KaTeX without inline eval).
