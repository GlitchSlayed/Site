# Focused MDX and discussion audit

## Findings and implemented changes

| Finding | Fix |
| --- | --- |
| Scatter groups with different X samples failed shared-X validation | Align onto a sorted union; retain repeats in labelled observation series. |
| Marker-only plots drew lines and could hide all points | Marker series always draw points with zero line width and no area fill. |
| Independent line samples contradicted the advertised API | Align without mutating or interpolating authored measurements; reject repeated X with an actionable message. |
| Author axis ranges and initial legend settings were ignored | Initialize range/legend state from configuration. Reset view remains autoscale. |
| Function syntax failures appeared as generic empty plots | Display the actual expression error in the component. |
| DataTable sorting required a mouse | Real header buttons, keyboard activation, column scope and aria-sort. |
| Missing-cell comparison was inconsistent | Stable comparator puts missing/nonfinite values last in both directions. |
| Custom/invalid table page sizes broke selector/pagination | Normalize sizes, include custom option, page from the displayed clamped index. |
| CSV text could become spreadsheet formulas | Escape text formula prefixes, quotes and newlines; preserve numeric negatives. |
| CSV URL was immediately revoked | Append download anchor and defer URL revocation. |
| Heatmaps used a fixed resolution and placed tooltips using a hard-coded offset | ResizeObserver/device-pixel scaling and a stable inline readout. |
| Missing/ragged heatmap data looked like measurements | Transparent missing cells, explicit no-measurement readout, shape/range validation. |
| Heatmap inspection was mouse-only | Focusable canvas, arrow-key cell selection and live readout. |
| MetricGrid ignored its column cap and overflowed narrow pages | Responsive classes replace hard-coded inline minimum widths. |
| Clipboard rejection was unhandled; collapse lacked state | Visible copy failure/status and aria-expanded/controls with retained code DOM. |
| Tooltip copy was absent from the accessibility tree | Persistent described-by text independent of the visual tooltip. |
| Preset chips became stale after changing sliders | Derive preset state from the live scope; validate/clamp preset values. |
| Slider animation continued when irrelevant | Pause offscreen/hidden and on reduced-motion preference changes; validate bounds/step and clamp publication. |
| Engineering reasoning was forced into generic prose/cards | Add static EngineeringNote, EquationBlock and Measurement components. |
| Docs advertised inaccurate behavior and omitted hydration | Replace with concrete import/hydration recipes, real API contracts, limitations and examples. |
| Giscus theme initialization raced its async script | Single controller sets all attributes before script insertion and observes theme changes. |
| Discussion styling and fallback were disconnected from the site | Editorial section, matching iframe themes, lazy loading, retry and persistent GitHub link. |
| Hard-coded theme URLs existed in multiple owners | Derive URLs from Astro configuration; remove Base's duplicate controller. |

## Validation

Twelve dependency-free checks pass across the earlier core suite and new MDX data tests. Added checks cover independent and repeated plot samples, input immutability, CSV escaping/formulas, null sorting/page sizes, and heatmap data validation. Browser coverage now includes the focused components and a simulated Giscus frame. The existing table interaction test targets the new header button.

Dependency installation was retried and still failed with HTTP 403 for zwitch. Consequently Astro type checking/build, Vitest component tests, and browser end-to-end execution remain unverified in this environment. The browser mock validates the local integration contract when run; live Giscus permissions, authentication and deployed cross-origin CSS need the deployment checks in `giscus-integration.md`.

## Known boundaries

- Line curves connect available samples across missing values; use separate labelled series when a visual discontinuity matters.
- Repeated scatter X values use additional labelled series. Large repeat counts increase series cost; aggregate only if scientifically justified by the author.
- Heatmaps expose individual cells through keyboard inspection; include a table/download for a complete nonvisual dataset.
- The displayed notebook code is not executable and its output is authored, not recomputed.
- Scope names must be unique within a document; values persist while sibling islands need them.
- Giscus keeps title mapping for compatibility. Thread migration is documented, not silently performed.
