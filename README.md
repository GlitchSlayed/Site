# Aerospace & Technology Blog

A complete static Astro site: dark/light themes, responsive layouts, searchable and filterable writing, project pages, Markdown/MDX, equation rendering, RSS, and optional sitemap generation. No database, account system, or paid service required.

## Option A: Cloudflare hosting (recommended)

1. Create a free Cloudflare account.
2. In Workers & Pages, create a Worker using an existing Git repository and connect this repository. Choose the static-assets / existing-project path if offered.
3. Set build command to `npm run build` and deploy command to `npx wrangler deploy`.
4. Keep project root as the repository root. Use Node 24 if the dashboard requests a version.
5. Keep the Worker name consistent with `name` in `wrangler.jsonc` (`vansh-site`), or change that file to your chosen unique name.
6. Deploy. Cloudflare supplies a free `workers.dev` URL.
7. In build environment variables, set `SITE_URL` to your full public URL, e.g. `https://vansh-site.YOUR_SUBDOMAIN.workers.dev`. Leave `BASE_PATH` unset. Rebuild once.
8. Future pushes trigger deployment. Stay on the Free plan for this static site.

`SITE_URL` enables correct canonical URLs, RSS absolute URLs, and a sitemap. Until set, no canonical or sitemap is emitted, and RSS uses example.com as a placeholder. This does not prevent pages from working; set it before sharing publicly.

No Cloudflare adapter, Worker function, API key in your repository, or SSR is needed. The configuration serves `dist` as static files, including a custom 404 page.

## Option B: GitHub Pages (also free)

1. Use a public repository for GitHub Free Pages.
2. Open repository Settings → Pages → Build and deployment → Source → GitHub Actions.
3. Open Actions → Deploy to GitHub Pages (optional) → Run workflow.
4. The workflow discovers your address and repository base path automatically, including project sites such as `username.github.io/vansh-site/`.
5. To deploy on every push, add this under `on:` in `.github/workflows/pages.yml`:

```yaml
  push:
    branches: [main]
```

The Pages workflow is manual by default so it does not conflict with Cloudflare or fail before you enable Pages. The separate Check site workflow verifies all pushes and pull requests.

For a custom domain, configure it in Pages settings before rerunning the workflow. Keep DNS and GitHub's domain verification instructions in mind. The supplied free address needs no purchased domain.

## Option C: Vercel

Import the GitHub repository into Vercel, accept its Astro preset (`npm run build`, output `dist`), and set `SITE_URL` to the final production URL. Leave `BASE_PATH` unset. This site needs no Vercel-specific code. Vercel Hobby has personal/non-commercial restrictions; review current plan terms if your use changes.

## Edit your information

- `src/config.ts`: name, description, GitHub, LinkedIn, email. Empty contact fields hide links. No invented handles are included.
- `src/pages/about.astro`: biography and interests. Review before publishing.
- `src/pages/index.astro`: introduction, headings, homepage sections, rocket illustration.
- `src/styles/global.css`: all visual styling and color tokens. Plain CSS is intentional: there is no Tailwind or React dependency to maintain for this design.
- `public/favicon.svg`: rocket mark.

Fonts are loaded from Google Fonts with local system fallbacks. To remove this external request, delete the first CSS `@import` line, or self-host properly licensed font files. All vector artwork is original code-generated illustration, not third-party imagery or scientific data.

## Add an article

Copy a file in `src/content/writing/`. Its filename becomes the URL. Example:

```yaml
---
title: "Your article title"
description: "A short summary."
date: 2026-10-24
tags: [Aerospace, Simulation]
draft: false
sample: false
---

## Your first section

Write Markdown here.
```

- `draft: true` excludes a page from production, search, and RSS.
- `sample: true` displays the sample badge and notice. All supplied articles are samples; replace or delete them before presenting the site as your own writing.
- Use `##` headings for automatic article contents links.
- Use `$...$` and `$$...$$` for inline and display equations.
- Use fenced code blocks for highlighted code.
- `.mdx` files can embed Astro/MDX-compatible components. No interactive component framework is installed; add one only when needed.
- Dates sort posts, but future dates do not schedule publication. Use drafts for unpublished writing.
- Search is entirely local and filters title, summary, body text, and topics. No tracking or external search service.

## Add a project

Copy a file in `src/content/projects/`. Required extra frontmatter:

```yaml
status: Proposed
art: wing
featured: true
```

`art` is `wing`, `orbit`, or `code`. `featured: true` makes it eligible for one of the two homepage project slots. Use your own real project imagery and results as they become available. The supplied projects are proposed outlines, not completed work.

For an image, place `test-rig.jpg` in `src/assets/` and reference it from a content file with a relative Markdown path, such as `![Your descriptive caption](../../assets/test-rig.jpg)`. Astro processes imported content images. Avoid root-relative `/image.jpg` paths if you use a GitHub Pages repository subpath. For custom links in Astro components, use the `url()` helper from `src/config.ts`.

## Run and verify locally

Install Node.js 24 LTS, then:

```bash
npm install
npm run dev
```

Open the address printed by Astro. Changes appear as you save.

```bash
npm run check
npm run build
npm run preview
```

`npm run preview` serves the built site. Do not open `.astro` source files directly in a browser. `dist` and `node_modules` are intentionally excluded from the ZIP; hosts install dependencies and build from source. The dependency major versions are constrained in package.json. The first install creates package-lock.json; commit that file afterward for repeatable installs. This environment blocked npm package downloads, so an Astro compile could not be run here. GitHub Actions runs the actual type check and production build after upload.

## Validation status

Source structure, local imports, metadata, and deployment configuration were inspected. Browser rendering could not be verified because this environment has no Chromium executable. The actual Astro build could not be run in this environment because npm downloads returned HTTP 403. Check the included GitHub Actions result after upload before treating the site as production-verified.

## Before publishing

Review your bio, replace sample content, add your contact links, and set your production SITE_URL. Nothing has been deployed on your behalf. No analytics, subscription forms, fabricated research results, or paid integrations are included.

## Design

Vercel-inspired restraint, original aerospace illustrations, sparse vermilion accents, accessible navigation and focus indicators, responsive typography, and reduced-motion support. This is an independent design and does not use Vercel branding or proprietary assets.

## Hosting tradeoffs

All three hosts can serve this site free. Cloudflare offers unlimited free static-asset requests; GitHub Pages is a very good one-account alternative for a public static blog; Vercel offers an easy import workflow but its Hobby terms restrict commercial use. Provider terms can change. This project is portable HTML/CSS/JS output.
