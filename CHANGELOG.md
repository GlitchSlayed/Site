# Changelog

All notable changes to the MDX visualization system.

## [Unreleased] — MDX Visualization System Repair

### Root causes fixed

- **Graph curves invisible / X axis missing**: uPlot's constructor calls `setData(data, false)` (no rescale) and only autoscales the X axis (`autoScaleX()`), never Y. The previous rewrite removed the forced axis ranges, leaving the Y scale unset, which collapsed the plot vertically so curves were not drawn while the Y axis still rendered. Fixed by computing true data extents for both X and Y (`computeDataExtent`) and applying them as scale limits — a genuine autoscale for both axes. `Reset View` and `Autoscale` now explicitly set both scales via `applyAutoscale` instead of relying on `setData(..., true)`, which only autoscales X.
- **Floating-point display artifacts** (`0.027330000000000004`, `14.950000000000001`, `2.2800000000000002%`): `significantFigures()` computed `Math.round(value / factor) * factor`, which reintroduces binary float representation errors. Added a centralized `formatNumber()` utility that rounds via `toFixed` (string-based, artifact-free), trims trailing zeros, supports significant figures / decimal places, thousands separators, SI-prefix / scientific notation, negatives, zero, NaN, and infinity. It is now used by `formatResult`, axis ticks, cursor readouts, and the comparison table. Internal precision is preserved; only presentation is rounded.
- **Zoom mode did nothing**: `interactionMode` was not part of the chart structure key, so switching to Zoom never recreated the chart with uPlot's drag-to-zoom `select` enabled. Modes now trigger recreation.
- **Settings options did not visibly apply**: line-width and marker changes mutated uPlot series descriptors but `redraw()` was called without rebuilding cached Path2D objects, so changes were invisible. Now uses `redraw(true)` to force a path rebuild.
- **Toolbar readout**: cursor readout sits below the chart (never overlaps controls); click-to-inspect and Shift+click comparison point work.

### Fixed

- **React #310 hook-order crash**: `useId()` now runs unconditionally before any early return.
- **Event-listener leaks**: every DOM listener is tracked and removed in cleanup.
- **Log-scale axis bug**: uses uPlot's `distr: Logarithmic` instead of a bogus `type`.
- **Chart teardown**: instance destroyed on unmount and structural change.
- **Stale closures / refs**: config and settings read from refs.

### Changed

- Rebuilt `EngineeringPlot` on uPlot with multi-series cursor readout, two-point operating-point inspection, live settings panel, PNG/CSV export, and header/toolbar/viewport/inspector/footer layout.
- Compact collapsible settings panel (closed by default) organized into Axes, Appearance, Series, Data.
- Added `formatNumber` to `src/lib/engineering/format.ts`; `EngineeringComparison` now formats through it.
- Added `tests/engineering-plot.test.tsx` covering lifecycle, settings, click-to-inspect, reset, autoscale, readout, CSV export, and series generation.

### Added

- `CHANGELOG.md`, `tests/engineering-plot.test.tsx`, formatting artifact tests.

### Known limitations

- `.md` articles do not support interactive MDX components; use `.mdx`.
- uPlot does not provide SVG export; PNG export is via canvas.
- Two charts mounted in one vitest `it` block must be awaited sequentially (dynamic-import mock registered lazily).
- Models are low-order approximations, not certified data.

- **Rebuilt `EngineeringPlot`** on uPlot (kept as the rendering engine — best fit for bundle size, interactivity, and CSP safety).
  - Multi-series cursor readout positioned below the chart (never overlaps toolbar controls).
  - Click-to-inspect operating points; Shift+click selects a comparison point.
  - Two-point comparison: Δx, Δy, slope Δy/Δx.
  - Live settings panel: grid, logarithmic Y axis, axis bounds, markers, line thickness, legend, cursor readout, precision (3–6 sig figs), series visibility, reset-to-defaults.
  - PNG export (canvas) and CSV export (underlying data).
  - Header (title, subtitle/units, description), toolbar, viewport, legend, inspection panel, settings panel, footer with dataset range — no overlapping titles/controls.
  - Responsive via CSS Grid/Flexbox + intrinsic sizing; no hardcoded fixed dimensions.
  - Loading, empty, and error states preserve article layout.
- **Rebuilt `EngineeringPointInspector`**: primary + comparison points, units, deltas, slopes, model-derived metrics with percentage change; clear-selection action.
- **Updated `ModelEngineeringPlot`**: two-point comparison flow, metric values computed from the model at the selected X; removed unused `safeResult` import.
- **Updated `src/styles/engineering.css`**: theme-consistent plot header/toolbar/viewport/legend/inspector/footer; removed dead floating settings panel and floating tooltip styles that overlapped toolbar controls; uPlot theme overrides (cursor crosshairs, selection band, legend text).

### Added

- **Tests**: `tests/engineering-plot.test.tsx` — chart lifecycle (mount/unmount/remount/no-leaks), multiple charts on one page, error surface, settings panel → `setSeries`, click-to-inspect (primary + comparison), reset view, autoscale, cursor readout via uPlot `setCursor` hook, CSV export, plot series generation for all four BWB presets, drag polar sweep range. 65 tests pass.
- **`docs/engineering-visualization-framework.md`**: updated to document the new settings panel, two-point inspection, export, and precision features.
- **`CHANGELOG.md`** (this file).

### Known limitations

- `.md` articles do not support interactive MDX components; use `.mdx`.
- uPlot does not provide SVG export; PNG export is available via canvas.
- Vitest dynamically-import mock: two charts mounted in the same `it` block must be awaited sequentially (vitest registers the dynamic-import mock lazily per test).
- The drag polar and aircraft performance models are low-order, steady-level-flight approximations — not CFD/FEA and not certified data.
- Three.js WebGL is unavailable on some devices; the viewer shows an error/fallback state.
