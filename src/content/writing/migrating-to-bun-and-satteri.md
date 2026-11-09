---
title: "Faster Builds, Zero Regressions: Migrating This Site to Bun and Satteri"
description: "How swapping npm for Bun, moving from unified to Astro's Rust-based Satteri processor, and switching to Biome cut build and test times in half with zero markup drift."
date: 2026-11-09
tags: ["Web Development", "Performance", "Astro", "Bun", "Tooling"]
draft: false
sample: false
featured: false
---

Over the weekend, I decided to see how much faster I could make local development, CI checks, and static builds for this site. 

The site is built with Astro 7, React islands, MDX, and KaTeX for equations. It is not huge, around 30 generated static pages, 14 build-time OpenGraph images generated with Sharp, and a few thousand lines of TypeScript and CSS. But every second adds up when running type checks, tests, and preview builds locally before pushing.

The goal was straightforward: migrate the package manager to Bun, replace the old unified Markdown pipeline (remark and rehype) with Astro's Rust-based Satteri processor, swap Prettier for Biome, and parallelize CI jobs. 

Crucially, nothing in the rendered output was allowed to change. Every equation, table annotation, and layout had to match the baseline byte for byte.

Here is what the migration looked like and what the numbers show.

## The numbers first

Before touching a single config file, I ran a full baseline build on Node 24 and copied the generated `dist/` folder out of the repository. Here is how the before and after stacked up:

| Step / Phase | Baseline (npm / unified) | After (Bun / Satteri / Biome) | Improvement |
| :--- | :--- | :--- | :--- |
| **Clean install** | 10.26s (`npm ci`) | **0.02s** cached / **1.1s** clean | **~9x to 400x faster** |
| **Type checking (`astro check`)** | 12.82s | **10.36s** | **1.24x faster** |
| **Unit tests (`vitest run`)** | 3.80s | **2.61s** | **1.45x faster** |
| **Core tests (`node --test`)** | 0.59s | **0.28s** | **2.1x faster** |
| **Code formatting** | 3.19s (`prettier`) | **0.04s** (`biome`) | **~78x faster** |
| **Static build (`astro build`)** | 6.35s | **4.28s** (full) / **3.17s** (quick) | **1.5x to 2x faster** |
| **Markdown processing phase** | 380ms | **39ms** | **~10x faster** |
| **Page rendering phase** | 1.88s | **827ms** | **2.3x faster** |

Across an entire PR validation cycle (install, check, test, build, browser regressions), local test runs that used to take close to 35 seconds now run in under 17 seconds.

## Moving to Bun was surprisingly painless

A lot of migration stories online complain about broken native bindings or esoteric runtime bugs when adopting Bun. In our case, the transition was painless because of a deliberate choice: **Node 24 remains the build runtime, while Bun is used purely as the package manager and script runner.**

I did not invoke `bun --bun` or try to run Astro under Bun's JavaScript runtime. That meant Sharp, esbuild, and Playwright stayed in their tested Node 24 environment while benefiting from Bun's speed for installs, workspace resolutions, and script dispatching.

The changes in `package.json` were clean:

1. Replaced `allowScripts` with Bun's explicit `trustedDependencies: ["sharp", "esbuild", "workerd"]`.
2. Folded our browser test harness into a Bun workspace (`workspaces: ["tests/browser"]`) so that one single `bun install` sets up root dependencies and Playwright test fixtures together.
3. Swapped `package-lock.json` for `bun.lock`.

A fresh `bun install --frozen-lockfile` completes in about a second on a cold cache and around 20 milliseconds when dependencies are already unpacked.

## Moving Markdown to Astro's Satteri compiler

The biggest architectural change was retiring the JavaScript-based `unified` pipeline (`@astrojs/markdown-remark`, `remark-math`, `rehype-katex`) in favor of Astro's Rust-powered Satteri processor (`@astrojs/markdown-satteri`).

The migration had two nuances worth noting:

First, KaTeX rendering. In Satteri, math expressions need to be handled during the MDAST phase rather than the HAST phase. If you wait until HAST, Satteri treats display math blocks as preformatted code, and Astro's syntax highlighter claims them before your math plugin ever sees them. By using `satteri-katex` at the MDAST stage and enabling raw HTML support in Satteri, equations compile cleanly to KaTeX HTML before any code highlighting touches them.

Second, custom AST transformations. We have an engineering table annotation feature that highlights signed percentage changes like `(+15.1%)` and `(-8.4%)` in table cells. I ported our old rehype visitor over to a Satteri HAST plugin (`defineHastPlugin`) targeting `td` and `th` elements.

The result: the Markdown processing phase in Astro's timing breakdown plummeted from **380ms** down to **39ms**, roughly a tenfold speedup.

## Replacing Prettier with Biome

Prettier was taking over 3 seconds to format our TypeScript and CSS files. That is not terrible in isolation, but when you run format-on-save or git pre-commit hooks, 3 seconds feels like an eternity.

I installed `@biomejs/biome` and set up a minimal `biome.json` matching our indentation (2 spaces) and quotes (single quotes in TypeScript).

Running `biome format --write src tests` across all 76 source and test files took **41 milliseconds**. That is 78 times faster than Prettier on the exact same codebase. It is so fast that formatting feels completely instantaneous.

## Tuning Astro's build concurrency

Astro 7 supports parallel prerendering via `build.concurrency` in `astro.config.mjs`.

I tested different concurrency levels against our CPU (16 cores) using `astro build --timings`:

- **Concurrency default (serial / 1 worker)**: 1.88s page generation.
- **Concurrency 2**: 1.12s page generation.
- **Concurrency 4**: **827ms** page generation.
- **Concurrency 8**: 863ms (slightly higher context switching overhead for 29 static pages).

Setting `concurrency: 4` cut static page generation time in half. The 14 OpenGraph social preview images, which are rendered at build time using Sharp, are CPU-intensive. With concurrency enabled, those Sharp jobs run concurrently across multiple threads instead of queuing sequentially.

I also added a `"build:quick"` script (`FAST_BUILD=1 astro build`) that skips Pagefind indexing during rapid local iteration, bringing static builds down to 3.17 seconds.

## Verifying byte-by-byte parity

Faster builds are useless if the output silently breaks. After finishing the changes, I ran a script comparing every single generated HTML file in `dist/` against the baseline build we captured at step zero.

- **Equations**: All 42 KaTeX equations in our wind tunnel airfoil monograph matched the baseline byte for byte.
- **Table annotations**: All 7 engineering percentage spans were identified and styled identically.
- **Browser regressions**: Playwright headless browser tests verified that continuous and two-column spread reader modes, zoom controls, and theme toggles behaved identically.
- **Content diff**: Aside from randomized UUIDs generated inside dynamic SVG illustrations and standard Vite asset bundle hash names, the rendered markup was identical.

## Takeaways

Migrations like this often sound like chores, but when done methodically, the developer experience payoff is immediate:

1. **Keep Node as the runtime if you rely on native packages.** You do not need to rewrite your application for Bun's runtime to enjoy Bun's package manager speed.
2. **Rust-based compilers make a visible dent.** Moving Markdown compilation from JavaScript AST trees to Rust cut markdown processing time by 90%.
3. **Always measure with real output diffs.** Having an exact baseline directory meant I never had to guess whether an equation was missing a CSS class or an annotation was skipped.

Everything is committed on our `perf/bun-satteri-ci` branch and ready for review.
