# Changelog

All notable changes to the MDX visualization system.

## [Unreleased] — MDX Visualization System Overhaul

### Fixed

- **React #310 hook-order crash**: `EngineeringPlot` called `useId()` after conditional error/loading returns. All hooks now run unconditionally at the top of the component, before any early return. Components mount, update, unmount, and remount reliably.
- **Event-listener leaks**: every DOM listener (click, mousedown, mousemove, mouseup, touchstart, touchmove, touchend, resize) is tracked and removed in effect cleanup; no listeners persist across unmounts.
- **Log-scale axis bug**: uPlot scales previously set a bogus `type` property; they now use uPlot's `distr: Logarithmic` correctly.
- **Chart teardown**: the uPlot instance is destroyed on unmount and on structural change, preventing duplicate canvases and leaked ResizeObservers/event listeners.
- **Stale closures / refs**: config, series visibility, and axis bounds are read from refs so effects never depend on inline prop object identity.
- **Zoom mode**: switching to Zoom now recreates the chart so uPlot's drag-to-zoom `select` is enabled; Inspect/Pan/Zoom modes all function.
- **Graph settings**: options (grid, markers, line width, series visibility, axis bounds) now visibly apply — uPlot path cache is rebuilt on width/marker changes so the rendering updates.
- **Autoscale by default**: graphs autoscale to fit data on initial load and on Reset View; manual axis bounds from settings override autoscale.

### Changed

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
