# Glitchy's Technical Blog: Technical and Editorial Reference

This file is reference material for writing and maintaining content for the site. Read it alongside `writing-playbook.md` before generating site-ready articles or project pages.

The purpose is to produce technically sound, honest, readable content that fits the site's actual implementation. A successful output should be easy to edit, copy into the repository, build, and publish.

## 1. Identity, scope, and authority

- Repository/project identity: **Glitchy's Technical Blog**.
- Public-facing identity: **Vansh** or **Vansh Datta**.
- Existing repository: `https://github.com/GlitchSlayed/Site`.
- Established host: GitHub Pages, deployed with GitHub Actions.
- Subject areas: aerospace, mechanical engineering, rocketry, manufacturing, simulation, Linux, open-source software, hardware, AI-assisted programming, and technology analysis.
- The site is a personal technical notebook and portfolio. A post is not automatically a peer-reviewed paper, institutional research output, or validated engineering result.

Use the user's latest statements and supplied source files as the authority. Then use current repository files if provided. This document describes the established implementation and subsequent migration instructions; it is not a live inspection of the repository. If a current schema, configuration, or workflow differs, explain the difference and follow the current file. Do not silently replace a user's recent changes with an older starter version.

Do not interpret examples, suggested investigations, or roadmap items as completed work. Do not infer a public production URL solely from the repository name: a custom domain or Pages setting may change it.

## 2. Author context and appropriate claims

Established author context:

- Mechanical engineering student at Hofstra University, aerospace concentration, class of 2027.
- Co-president of Hofstra's AIAA chapter, according to the user's latest preferred description.
- Six months of aerospace manufacturing co-op experience at Arkwin Industries, January–July 2026.
- Experience with hydraulic actuator manufacturing, tooling and fixture design, workholding, engineering drawings, inspection, tolerancing, manufacturing instructions, and production support.
- Makerspace research internship at Hofstra's ideaHUb, including prototyping, mechanical testing, troubleshooting, equipment documentation, and assisting users.
- Python and MATLAB as engineering tools.
- Personal Fedora Linux use, hardware/software troubleshooting, and an interest in open-source applications and modern technology.
- Exploring AI-assisted programming; do not recast this as extensive professional software engineering experience.

These are grounding details, not material that must be repeated in every article. Confirm current roles before describing them as current in future posts. Use résumé facts selectively and avoid publishing phone numbers, addresses, grades, or other personal details unless requested.

Manufacturing experience can inform discussion of design and inspection, but it does not authorize disclosure of company drawings, internal tolerances, customer data, processes, documents, or proprietary results. Use public information and nonconfidential descriptions; ask for a public-safe substitute when essential source material is unclear.

## 3. Site architecture

The site is a static Astro application. Source content is converted to HTML during the build. GitHub Pages serves the resulting files; it does not execute Python, Node server routes, databases, or a persistent application backend.

| Layer | Established choice | Consequence for content |
| --- | --- | --- |
| Framework | Astro, subsequently upgraded from the original Astro 5 starter | Follow the current installed version and configuration |
| Content | Markdown and MDX collections | Most deliverables should be `.md` |
| Validation | Zod schemas in `src/content.config.ts` | Frontmatter must match the collection |
| Styling | Plain CSS | Tailwind utility classes are not automatically available |
| Interactive visuals | React 19 and `@paper-design/shaders-react`, loaded by Astro islands | Used for decorative project and hero shader effects |
| Social previews | Build-generated 1200 × 630 PNGs rendered with Sharp | Each page gets an absolute `og:image` and Twitter card URL |
| Equations | remark-math + rehype-katex + KaTeX | LaTeX-style math can be rendered at build time |
| Markdown pipeline | `unified()` from `@astrojs/markdown-remark` | Remark/rehype plugins are configured inside its options |
| Syntax highlighting | Shiki | Use fenced code blocks with a language |
| Search | Small client-side filter | No search server or Pagefind installation is assumed |
| Hosting | GitHub Pages | Handle the repository URL base path |
| Build checks | Astro check and build through Actions | Content validation can stop deployment |
| Sitemap | `@astrojs/sitemap`, enabled when SITE_URL is supplied | Do not hand-author sitemap entries |
| Feed | `@astrojs/rss` route | Published writing entries appear in RSS |

React is installed for the shader visuals. Tailwind, shadcn, a charting library, Mermaid renderer, CMS, comments service, analytics, newsletter backend, and interactive plotting framework are not installed. If any of these are needed, describe them as separate implementation changes rather than features the article gains by mentioning them.

## 4. Repository map

| Path | Role |
| --- | --- |
| `src/config.ts` | Public site identity, contact links, URL and date helpers |
| `src/content.config.ts` | Collection loaders and metadata validation |
| `src/content/writing/` | Blog articles and technical notes |
| `src/content/projects/` | Project overviews, scope, milestones, and progress |
| `src/pages/index.astro` | Homepage introduction and selected content |
| `src/pages/about.astro` | Biography and interests |
| `src/pages/writing/index.astro` | Article listing, topic filters, and search |
| `src/pages/writing/[...id].astro` | Generated article routes |
| `src/pages/projects/index.astro` | Project listing |
| `src/pages/projects/[...id].astro` | Generated project routes |
| `src/pages/rss.xml.ts` | RSS output |
| `src/pages/404.astro` | Custom error page |
| `src/pages/og/[...slug].png.ts` | Generates gradient social cards for site pages and published content |
| `src/layouts/Base.astro` | Shared metadata, navigation, footer, theme toggle |
| `src/layouts/Article.astro` | Article title, metadata, body, and contents navigation |
| `src/components/ProjectCard.astro` | Card metadata and art selection |
| `src/components/Art.astro` | Decorative wing/orbit/code illustrations |
| `src/components/visuals/ProjectVisual.astro` | Project-card visual variants and image/screenshot framing |
| `src/components/visuals/PaperVisual.tsx` | Lazy-loaded shader visuals and motion safeguards |
| `src/components/visuals/visuals.css` | Project visual framing, CSS patterns, and reduced-motion fallback |
| `src/components/HeroAtmosphere.astro` | Decorative shader atmosphere behind the home page hero |
| `src/styles/global.css` | Design tokens, typography, article and responsive styling |
| `src/assets/` | Imported content assets; create the folder when needed |
| `public/` | Directly served assets |
| `astro.config.mjs` | Static output, integrations, base path, and Markdown pipeline |
| `.github/workflows/pages.yml` | GitHub Pages build and deployment |
| `.github/workflows/check.yml` | Independent checks; normally PR/manual after optimization |

Do not change application source simply to make an ordinary Markdown article fit. If a new layout, card image field, or component is truly required, identify the exact change separately.

## 5. Collection contracts

Both collections load `.md` and `.mdx` files with a filesystem glob. The baseline schema contains these common fields:

| Field | Type | Required? | Behavior |
| --- | --- | --- | --- |
| `title` | string | Yes | Page title and listing title |
| `description` | string | Yes | Summary in listings and metadata |
| `date` | value coercible to a valid Date | Yes | Display and ordering |
| `tags` | array of strings | Yes | Labels and writing topic filters |
| `draft` | boolean | No; defaults false | Excludes an entry from generated public routes/listings/feed |
| `sample` | boolean | No; defaults false | Adds a sample marker and explanatory notice |
| `featured` | boolean | No; defaults false | Used for homepage project selection; no special writing behavior is assumed |

Projects additionally require:

| Field | Type | Required? | Behavior |
| --- | --- | --- | --- |
| `status` | string | Yes | Human-readable project state |
| `art` | enum: `wing`, `orbit`, `code` | Yes | Selects the existing decorative card illustration |

Projects may also set optional visual presentation fields:

| Field | Type | Behavior |
| --- | --- | --- |
| `visual` | enum: `dither`, `grain`, `mesh`, `grid`, `dots`, `asset`, `screenshot` | Uses a custom project-card visual instead of the `art` illustration |
| `visualAccent` | six-digit hex color | Accent color; must match `#RRGGBB` |
| `visualImage` | string | Image path under `public/` or an `http(s)` URL; local paths are prefixed with the configured base path |
| `visualImageAlt` | string | Alternative text for the image |
| `visualLabel` | string | Short label over a shader/pattern visual or in the screenshot frame |
| `visualAnimate` | boolean, default `false` | Enables slow shader motion when motion is allowed and the card is visible |

`visual` and `art` can coexist in frontmatter because `art` remains required by the schema. When `visual` is set, the card renderer uses the visual variant; otherwise it falls back to `Art.astro`.

### Project card visual effects

The `ProjectVisual` component provides seven variants:

- `dither`, `grain`, and `mesh` use Paper Design WebGL shaders. If WebGL2 is unavailable or the shader module fails to load, the card retains its CSS background fallback.
- `grid` and `dots` are CSS-only patterns.
- `asset` displays a supplied image with cover cropping. Without an image it shows a small editorial placeholder note.
- `screenshot` frames a supplied image in a mock application window. Without an image it displays an add-screenshot placeholder.

Example project frontmatter:

```yaml
visual: dither
visualAccent: "#739cda"
visualLabel: "Fedora remix · Concept"
visualAnimate: false
```

For image variants, store site-local images in `public/images/` and set `visualImage: images/example.webp`; write meaningful `visualImageAlt` for a real image. Use `screenshot` when the work benefits from a product-window frame and `asset` when the image should fill the visual. Do not use placeholders as though they were project screenshots.

Shaders are decorative and marked hidden from assistive technology; project title and label remain HTML text when the layout includes them. Shaders are loaded only when visible, run only when the element is visible and the document is active, and respect `prefers-reduced-motion`. Animation is opt-in through `visualAnimate`. Reduced-motion users receive static rendering. Keep contrast and text legibility in mind when choosing an accent.

The home-page hero also uses a static `mesh` shader atmosphere with a CSS gradient fallback. It is an ambient effect, not project evidence or an interactive control.

### Social preview cards

The static build generates branded 1200 × 630 PNG cards at `/og/`. The home card shows only “Vansh's Technical Blog” over a soft orange and blue gradient. Writing and project cards use the entry's title on the same background. The About, Writing, Projects, and 404 pages have their own labels and card images. `Base.astro` points Open Graph and Twitter metadata to these generated images and includes the configured Pages base path in each absolute URL.

Add content entries through the normal collections; published entries receive a card automatically during build, while drafts are omitted. The generator lives in `src/pages/og/[...slug].png.ts` and uses Sharp, which must remain a direct project dependency for reliable builds.

Important validation rules:

1. **Drafts must still validate.** Content is loaded and validated before route filtering. Setting `draft: true` does not excuse an invalid date or missing `art`.
2. Always include an explicit, real calendar date such as `date: "2026-10-24"`. Do not use `TBD`, an empty value, `YYYY-MM-DD`, or an impossible date in a ready-to-save file.
3. Use actual booleans: `draft: true`, not `draft: "true"`.
4. Use an array: `tags: [Linux, Fedora]`, not `tags: Linux, Fedora`.
5. Quote titles and descriptions. Escape embedded double quotes, or use correctly escaped single-quoted YAML strings.
6. `status` is free text, but `art` is not. `art: rocket` is invalid; use `art: orbit` for a rocket/trajectory concept.
7. Do not invent frontmatter fields such as `author`, `heroImage`, `updatedDate`, `github`, `paper`, `layout`, or `cover` and imply that they will appear in the UI. Put links, dates, and images in the body unless the schema and templates are explicitly extended.
8. The user can keep a stable publication date while adding dated updates in the body. There is no established updated-date UI.
9. `sample` means demonstration content. A real conceptual project is not a sample just because it is unfinished.
10. Future-dated posts are not scheduled: if not marked draft, they may publish immediately on the next build.

After the Astro migration, the configuration imports should begin with:

```ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
```

Import `z` once. Do not import it from both `astro:content` and `astro/zod`.

## 6. File naming, routes, and discoverability

Use lowercase, hyphen-separated ASCII filenames, for example:

- `src/content/writing/why-im-planning-gofr.md`
- `src/content/projects/gofr.md`

In the established glob-loader setup, these become collection IDs derived from the path without the extension. The route templates use those IDs:

- `<site-base>/writing/why-im-planning-gofr/`
- `<site-base>/projects/gofr/`

Prefer flat content directories unless the user requests nested URLs. Nested files may produce nested IDs and routes. Check the current loader before assuming a slug override exists.

Renaming a published file changes its URL. Do not rename existing published entries casually. The baseline has no redirect registry to preserve old links automatically.

Writing is sorted by date, newest first. Homepage writing shows the latest three visible posts. Homepage projects use the first two eligible entries after filtering for `featured`; the original homepage does not explicitly sort that filtered collection. If the order matters, inspect or change the selector rather than promising that the newest or most important item automatically wins.

Writing search matches title, description, and raw body text, plus a selected tag. Exact tag spelling and capitalization matter. Use a small, consistent taxonomy, typically two to four tags. A first tag is especially visible in homepage rows and project cards.

Suggested vocabulary, not a schema-enforced list:

`Aerospace`, `Aircraft design`, `Rocketry`, `Simulation`, `Manufacturing`, `Scientific computing`, `Technology`, `Linux`, `Fedora`, `Open source`, `Hardware`, `AI-assisted programming`.

## 7. Markdown authoring

### Page title and headings

The layout generates the visible page title from frontmatter. Start the body with an opening paragraph, not another `# Title`.

Use `##` for main sections and `###` for subsections. The existing article contents navigation lists level-two headings. It is hidden at narrower widths, so the article must remain navigable through its headings alone.

Keep headings descriptive. Avoid a long table of contents manually pasted into every post; the layout already creates one for desktop.

### Paragraphs, lists, and tables

Use paragraphs for reasoning and a list when items are genuinely parallel or sequential. Keep a blank line before lists and around code blocks. Use small tables for exact comparisons, parameters, test cases, and milestones. Avoid very wide tables that become difficult to read on a phone.

Bold important terms sparingly. Define unfamiliar terminology at first use. Do not use bold as a substitute for heading hierarchy.

### Equations

Inline example: `$q = \tfrac{1}{2}\rho V^2$`.

Display example:

```latex
$$
L = \frac{1}{2}\rho V^2 S C_L
$$
```

Use one literal backslash in the actual `.md` file. Escape it only when representing the document inside another programming language or JSON string.

Define variables, units, assumptions, and sign conventions near the equation. Explain why the equation applies. Do not insert an equation solely to make a post appear technical.

Be consistent about notation, reference area, coefficient definitions, degrees/radians, and coordinate systems. Keep dimensional quantities and nondimensional coefficients distinct.

### Code

Use a fenced block with a suitable language, such as `python`, `bash`, `typescript`, `json`, or `yaml`. Use `text` for logs and directory paths.

Label pseudocode and unexecuted examples. Do not describe generated code as tested unless it was actually run and the result checked. Include dependencies and execution instructions when a code example is intended to be reproduced.

Python and shell blocks are displayed, not executed by the page. Shell examples should target the user's Fedora setup when relevant and avoid unnecessary destructive operations or machine-specific absolute paths.

### Images and figures

From a flat content file inside either collection, an imported asset can be referenced as:

```markdown
![Actuator test fixture with the measurement points labeled](../../assets/fixture-overview.webp)
```

Give filenames and expected locations in a handoff note. Do not reference an image as though it exists when it has not been supplied or created. A planned figure should appear as an HTML comment or explicit editorial TODO in a draft.

The baseline has no special figure-caption plugin. Put an italicized caption immediately below the image, including attribution if needed. Alt text should describe the useful visual information; a caption can explain context and evidence.

Do not imply that decorative SVGs or invented charts are measured or simulated data. Static scientific plots should come from the underlying data and identify units, conditions, and sources.

### Links and GitHub Pages base paths

The default repository may be hosted below `/Site/`. A root-relative URL like `/projects/gofr/` can therefore point to the wrong location.

For Markdown, use a confirmed absolute production URL, or a relative link tested against the rendered route. For example, from `<base>/writing/why-im-planning-gofr/` to `<base>/projects/gofr/`:

```markdown
[GOFR project overview](../../projects/gofr/)
```

From `<base>/projects/gofr/` to the related article:

```markdown
[Why I’m planning GOFR](../../writing/why-im-planning-gofr/)
```

These examples assume flat collection IDs and trailing-slash routes. Recalculate links for nested routes. Markdown hyperlinks target website routes, not the source `.md` file on disk.

In Astro components, use the configured `url()` helper. Do not insert Astro expressions or JavaScript template literals into plain Markdown and expect them to execute.

### Unsupported content assumptions

- Mermaid fences display as code unless rendering is added.
- ChatGPT widgets, writing-block delimiters, and citation tokens do not belong in site content.
- Do not emit `:::writing`, `...`, sandbox URLs, or connector-specific file references into the article.
- Use normal Markdown links to public sources.
- A custom React chart requires a React integration and component implementation; MDX alone does not supply either.
- Raw HTML can be useful, but prefer ordinary Markdown and existing typography. Do not embed unreviewed scripts or iframes merely to decorate a post.

## 8. Blog post versus project page

A project page is a durable reference: what the project is, its current status, scope, approach, evidence, and next steps. A blog post is a dated narrative: why an idea arose, a decision, a specific investigation, a milestone, or lessons learned.

When both are requested:

| Project page | Blog post |
| --- | --- |
| Stable name and purpose | A specific question, argument, or moment |
| Current state and scope | Motivation, reasoning, and narrative |
| Architecture or methods | Explanation of a selected part of the work |
| Milestones and evidence | Findings or current thinking |
| Updated as the work evolves | Published as a dated entry |

Cross-link them without repeating the whole document. A conceptual project can have a substantive page about its proposed architecture and open questions. It must not acquire fictitious benchmarks, implemented features, screenshots, releases, or successful tests to fill sections.

## 9. Technical quality and evidence

For engineering content:

- State the question, operating conditions, constraints, and baseline.
- Distinguish assumptions from measured inputs and cited values.
- Define units and sign conventions; use consistent conversions.
- Explain model fidelity and applicable regimes.
- Separate numerical verification from physical validation.
- Record where results came from: experiment, simulation, analytic calculation, external benchmark, or illustrative example.
- Use uncertainty or sensitivity analysis when it materially affects the conclusion.
- Avoid false precision and unsupported claims of optimization, superiority, novelty, or safety.
- Include enough method detail for the stated level of reproducibility.

For Linux/software/hardware analysis:

- Identify versions, hardware, configuration, date, workload, and test method when they matter.
- Distinguish developer claims, release notes, personal observation, and measured performance.
- Do not generalize one machine's experience into universal performance.
- Distinguish a planned integration from an available upstream feature.
- Check current project documentation for unstable facts, installation steps, APIs, licenses, and compatibility.
- Prefer primary sources and clearly label inference.

For AI-assisted work:

- Describe what the author asked the tool to do and what was independently inspected or tested when relevant.
- Do not imply manual implementation of code that was AI-generated, or validated results where only a model suggested an answer.
- Keep the focus on the technical question; disclose assistance proportionately rather than adding a generic disclaimer to every paragraph.

For references:

Use linked prose citations or a compact numbered list with `[1]` markers in text and matching entries under `## References`. Include document titles and organizations/authors where known. Every reference must be real and relevant. Do not invent DOIs, quotations, page numbers, source dates, or access to a paper's full text.

When browsing is unavailable, flag claims requiring verification outside the publication draft. A general source homepage is not evidence for a specific benchmark or specification.

## 10. Editorial voice

Write in the first person for the author's experience and intentions. Use a natural, technically curious voice that sounds like an engineering student thinking carefully about real work.

Use clear sentences and concrete details. Explain terminology without talking down to readers. Retain depth where the reasoning needs it; remove filler rather than flattening the explanation.

Avoid inflated résumé prose, corporate marketing language, exaggerated expertise, forced aerospace metaphors, and unsupported claims. Avoid em dashes by default. Prefer straightforward headings over titles such as “Revolutionizing the Future.” Do not call personal exploration a breakthrough or a research publication.

Match confidence to evidence:

- Concept: “I’m considering…” / “The proposed approach…”
- Work in progress: “I’ve implemented X; Y remains untested.”
- Observation: “On this setup, I observed…”
- Result: “Under these conditions, the calculation produced…”
- Inference: “This suggests…, although…”

Do not invent the author's feelings, childhood stories, collaborations, completed coursework, or outcomes. Offer suggested wording for confirmation if a personal statement is needed but not grounded.

## 11. Build, preview, and deployment

The established local environment uses Node 24 and npm. The repository lockfile should be committed.

```bash
npm ci
npm run check
npm run build
npm run preview
```

Use `npm install` when adding/updating dependencies or generating the initial lockfile. Use `npm ci` for repeatable installs once a matching lockfile exists. Preview requires a successful build.

The GitHub Pages workflow runs on pushes to `main` after its push trigger is enabled. The optimized setup keeps checks on PRs and the production check/build in the Pages workflow, rather than duplicating the same build on every push.

Build-time variables:

- `SITE_URL`: production origin; used for canonical URLs, RSS, and sitemap behavior.
- `BASE_PATH`: repository subpath, such as `/Site/`; normally supplied by the Pages workflow.

A successful Git push does not prove successful deployment. Inspect the Actions result. Repository settings must use GitHub Actions as the Pages source.

Keep generated directories out of Git:

```gitignore
node_modules/
dist/
.astro/
.wrangler/
```

Keep `package.json`, `package-lock.json`, source files, assets, configuration, and workflow files tracked. Before suggesting `git add .`, tell the user to inspect status and confirm the ignore rules; dependencies were accidentally committed once during setup. Prefer staging the specific content files and assets involved.

Do not suggest `npm audit fix --force` as a default repair. Review the actual advisory chain, update related packages coherently, and verify the build and rendered math after dependency overrides.

## 12. Known failure modes

| Symptom | Likely explanation | What to inspect |
| --- | --- | --- |
| Invalid date | Missing, placeholder, malformed, or impossible frontmatter date | The named content file's opening metadata |
| `art: Required` | A project lacks its required illustration selector | Add one of `wing`, `orbit`, `code` |
| Draft still fails validation | Draft filtering occurs after collection validation | Fix the metadata; do not rely on draft status |
| `z` already declared | Two imports declare the same identifier | Import `z` once from `astro/zod` |
| Config import-analysis failure | Broken JavaScript syntax in `astro.config.mjs` | Run `node --check astro.config.mjs` |
| Deprecated Markdown plugin settings | Plugins are placed outside `unified()` options | Move remark/rehype plugins into `unified({...})` |
| Page or image links break only on Pages | Root-relative URL ignores repository base | Inspect generated routes and link resolution |
| Unsupported custom frontmatter does nothing | Layout/schema has no corresponding implementation | Use body content or propose a separate code change |
| Empty references or missing figures | Unresolved writing placeholders | Keep draft, remove dependency, or obtain real materials |
| Article is missing | Draft flag, collection path, filename, or build failure | Inspect metadata, location, and Actions output |
| Push lists thousands of dependency files | Dependencies were staged or already tracked | Fix ignore rules and Git tracking before publishing |

## 13. Required handoff from the writing assistant

When asked for a site-ready file:

1. State the intended repository path outside the file.
2. Produce complete valid frontmatter followed by the actual article/project body.
3. Use `draft: true` for unfinished work unless the user explicitly wants publication-ready output and the draft meets that standard.
4. Provide real citations and resolve assets, or list remaining editorial tasks outside the file.
5. Explain any changes requiring application code separately.
6. Never claim the file built, rendered, deployed, or passed checks unless those actions were actually performed.

Read the companion template guide for concrete examples and task-specific structures. These documents are authoring support files; they should not themselves be placed in either public content collection unless the user wants to publish them.
