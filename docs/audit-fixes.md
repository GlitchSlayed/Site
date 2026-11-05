# Engineering audit fixes

The audit fixes preserve the technical plates, personal layout and newspaper reader.

| Area | Change |
| --- | --- |
| Plot scales | Both configured axes initialize correctly; pan, zoom and autoscale use logarithmic coordinates when selected. Nonpositive log data/bounds produce a recoverable error. |
| Scoped controls | Immutable external-store snapshots let late-mounted plots and metric cards read existing parameters. Subscribing cannot invent a zero default. |
| Plot lifecycle | A zero-width host waits for ResizeObserver instead of an endless animation loop. Error recovery retains the canvas host. Import Retry starts another loading attempt. |
| Viewer controls | React owns a persistent toolbar, separate from the renderer's canvas host. |
| Viewer lifecycle | A single cancellable animation loop pauses offscreen and in hidden tabs. Retry recreates the loader. Unmount and stale loads dispose geometry, materials, textures, controls and renderer resources. |
| Reader toolbar | Measures the site header and toolbar rather than relying on a fixed offset. |
| Reading position | Continuous mode is the initial default. Layout changes preserve a content anchor. Original DOM nodes and interactive islands stay mounted. |
| Browser Find | Find shortcut switches to continuous mode. Facing pages use hidden-until-found with beforematch reveal in supporting browsers. Use Scroll mode for menu-based Find in browsers without that support. |
| Math grammar | Replaces string rewriting and JavaScript evaluation with a mathematical parser. Powers associate right; `-x^2` means `-(x^2)`. Sampling limits reject invalid counts. |
| Slider animation | Publishes changes outside React state updater callbacks, including under StrictMode. |
| Resource links | Markdown AST parsing handles reference links and balanced parentheses; excludes code, images and non-web schemes. |
| Styles | Formats the personal/technical stylesheets, removes conflicting homepage layout overrides, consolidates viewer states and gives reader behavior a separate module. |
| Static art | Cover plates use SVG and CSS texture. Only the homepage hero gets the animated WebGL surface. |
| Regression coverage | Adds dependency-free core tests, plot and Markdown regression cases, and real-browser checks wired into check CI. |

## Validation in this environment

`npm run test:core`: 7 passing checks. Changed non-JSX TypeScript modules and the browser runner pass syntax parsing. Full dependency installation failed with HTTP 403 (including zwitch), preventing Astro check/build, Vitest and the site browser suite from running here. Those checks are configured in CI and must pass before deployment; no browser or build pass is claimed.

## Run the browser checks

1. `npm ci`
2. `npm run check && npm test && npm run test:core`
3. `SITE_BROWSER_TESTS=1 npm run build`
4. `npm install --prefix tests/browser`
5. `cd tests/browser && npx playwright install chromium && cd ../..`
6. Run `npm run preview -- --host 127.0.0.1` in another terminal.
7. `npm run test:browser`

Set `TEST_BASE_URL` if preview uses a different origin or base path. The fixture route is emitted only with `SITE_BROWSER_TESTS=1`; rebuild normally before publishing. The production deployment workflow does not set this variable.

Expressions support numbers, named parameters, parentheses, arithmetic, `^`/`**`, whitelisted math functions and `pi`/`e`. Explicit parameter names override bare constants, while `Math.E` and `Math.PI` always remain constants. Plots require strictly increasing, aligned X coordinates and positive finite values on logarithmic axes.
