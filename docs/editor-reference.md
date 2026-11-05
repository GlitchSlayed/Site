# Glitchy's Technical Blog: Master Editor Reference & Writing Guide

> Engineering visual update: [engineering-design-refinement.md](engineering-design-refinement.md) defines the current drawing and engineering-brief fields, default cover behavior, register, source shelves, and texture effects. It supersedes earlier decorative-shader defaults.

> Layout update (2026-11-05): See [personal-redesign.md](personal-redesign.md) for the current homepage, project catalogue, writing archive, about page, and section-based newspaper reader. Earlier layout descriptions below are historical; author grounding, schemas, and component guidance still apply.

> **Purpose**: This document is the authoritative reference for the AI writing assistant, human editor, or custom GPT/Claude Project that plans, drafts, and audits content for **Glitchy's Technical Blog** (publicly branded as **Vansh's Technical Blog**).
> 
> Keep this document updated whenever site features, collection schemas, or author contexts evolve.

---

## 1. Ready-to-Copy System Prompt for the Writing Assistant

Copy and paste the block below into the **System Prompt**, **Custom Instructions**, or **Project Instructions** field of your editor (e.g., ChatGPT Project, Claude Project, Cursor / Antigravity rule):

```markdown
You are the Technical Writing Assistant and Editor for Glitchy's Technical Blog (publicly branded as Vansh's Technical Blog), an aerospace, engineering, and open-technology publication hosted at https://glitchslayed.github.io/Site/.

Follow these core operating principles:
1. VOICE & TONE: Write thoughtful, technically detailed first-person singular ("I") prose in a natural, grounded engineering voice. Never use corporate marketing buzzwords ("revolutionize", "cutting-edge", "game-changer"), breathless hype, artificial transitions, or em dashes (—). Use plain hyphens or colons instead.
2. FACTUAL INTEGRITY: Ground every statement in author-provided facts or verified engineering principles. Strictly match confidence to evidence: clearly distinguish conceptual designs, proposed experiments, active prototypes, and validated results. Never invent personal anecdotes, completed coursework, proprietary employer data, or benchmark numbers.
3. AUTHOR GROUNDING: The author is Vansh Datta, a mechanical engineering student at Hofstra University (aerospace concentration, class of 2027), Co-President of Hofstra's AIAA chapter, former manufacturing co-op at Arkwin Industries (hydraulic actuators, tooling, inspection), and ideaHUb makerspace research intern. He uses Fedora Linux, Rust, Python, and TypeScript. Preserve nonconfidentiality: never disclose proprietary aerospace company drawings, internal tolerances, or customer specifics.
4. OUTPUT FORMAT: Deliver production-ready Markdown (.md) or MDX (.mdx) files with complete, valid YAML frontmatter. Provide the intended file path, full code, and a brief bulleted list of any remaining factual questions or asset needs outside the file.
5. TECH STACK COMPLIANCE: Adhere to Astro 7 collection schemas, GitHub Pages repository base paths (`/Site/`), KaTeX equation syntax ($ and $$), and verified interactive MDX visualization components when authoring .mdx.
```

---

## 2. Author Profile, Experience & Voice

### Author Grounding Details
- **Name**: Vansh / Vansh Datta.
- **Affiliation**: Mechanical Engineering student at Hofstra University (Aerospace concentration, class of 2027).
- **Leadership**: Co-President of Hofstra's AIAA Student Branch.
- **Hands-on Manufacturing Experience**: Six-month aerospace manufacturing co-op at **Arkwin Industries** (January–July 2026). Hands-on experience with hydraulic actuation systems, precision CNC machining production support, tooling and fixture design, workholding, GD&T, inspection, coordinate measuring techniques, and manufacturing instructions.
- **Makerspace Research**: Research intern at Hofstra's **ideaHUb**, supporting rapid prototyping, 3D printing, mechanical testing, equipment manuals, and student project troubleshooting.
- **Computing & Systems**: Daily driver is **Fedora Linux**. Strong interest in modern Linux architecture (systemd, UKI, dracut, Wayland, DNF5), systems programming in **Rust**, scientific computing in **Python** & **MATLAB**, and thoughtful analysis of desktop technology and open hardware.

### Editorial Tone Rules
- **First-Person ("I")**: Speak directly and personally. "I wanted to understand whether...", "In my test setup, I observed..."
- **Intellectual Honesty**: Treat failures, unexpected errors, and boundary limits as first-class engineering insights.
- **No Em Dashes**: The site style specifically avoids em dashes (`—`). Use parentheticals, colons, or clean separate sentences instead.
- **No Grandiosity**: Avoid describing undergraduate exploration or initial concepts as "groundbreaking research", "breakthroughs", or "revolutionary paradigms". Call them what they are: "preliminary study", "conceptual trade analysis", "prototype", "opinionated remix".
- **Confidentiality Guard**: Do not cite internal Arkwin part numbers, customer programs, proprietary drawing tolerances, or confidential defense/aerospace data. Focus on general engineering principles (e.g., standard ANSI/ISO fits, hydraulic seal mechanics, fixture rigidity).

---

## 3. Site Architecture & Environment

| Component | Technology | Detail |
| :--- | :--- | :--- |
| **Framework** | Astro 7 (SSG) | Static HTML generation with React 19 client islands |
| **Hosting** | GitHub Pages | Deployed via GitHub Actions to `https://glitchslayed.github.io/Site/` |
| **Base Path** | `/Site/` | Handled automatically via `url()` helper in Astro templates |
| **Search** | Pagefind | Full-text static search inside a native accessible `<dialog>` with `⌘K` shortcut |
| **Equations** | KaTeX | Fast build-time LaTeX rendering via `remark-math` and `rehype-katex` |
| **Plots & Charts** | uPlot + WebGL | High-performance interactive 2D scientific plotting (`EngineeringPlot`) |
| **Path Aliases** | TypeScript | `@components/*`, `@lib/*`, `@layouts/*`, `@styles/*` configured in `tsconfig.json` |
| **Comments** | Giscus | GitHub Discussions integration styled via site-hosted stylesheets |
| **SEO & Feeds** | Sitemap & RSS | Dynamic sitemaps, `robots.txt`, and `/rss.xml` generated at build |

---

## 4. Content Collections & Frontmatter Schemas

Content lives in two distinct Astro collections in `src/content/`:
- `src/content/writing/**/*.{md,mdx}`: Blog posts, essays, analysis, tutorials.
- `src/content/projects/**/*.{md,mdx}`: Durable project specifications, hardware/software roadmaps, research studies.

### Writing Frontmatter Specification (`src/content/writing/`)
```yaml
---
title: "Article Title Here"
description: "A concise 1-2 sentence description explaining the central topic or problem."
date: 2026-10-24
tags:
  - Linux
  - Fedora
  - Systems
draft: false
sample: false
featured: false
category: "Operating Systems" # Optional eyebrow category
---
```

### Projects Frontmatter Specification (`src/content/projects/`)
```yaml
---
title: "Project Title Here"
description: "A clear overview of the project's goal, technical scope, and current status."
date: 2026-10-25
status: "Concept"
art: "wing"
tags:
  - Aircraft Design
  - Aerodynamics
  - Simulation
draft: false
featured: true
category: "Aerospace"

# Optional Visual Presentation Fields
visual: "mesh"              # Options: dither | grain | mesh | grid | dots | asset | screenshot
visualAccent: "#33d17a"     # Valid 6-digit hex color
visualLabel: "BWB Study"    # Overlay badge text
visualAnimate: false        # Gentle shader motion on scroll
visualImage: "images/ex.webp" # Relative to public/ for asset or screenshot variants
visualImageAlt: "Model preview"
---
```

#### Strict Field Enumerations
- **`status`** (Strict Enum): Must be exactly one of:
  - `'Concept'`: Theoretical exploration, governing equations, research plan.
  - `'In Development'`: Active prototype, simulation code being drafted/tested.
  - `'Prototype'`: Working software CLI or physical hardware undergoing validation.
  - `'Completed'`: Peer-reviewed or fully validated study with published deliverables.
- **`art`** (Strict Enum): Required fallback illustration. Must be one of:
  - `'wing'`: Aerospace, aerodynamics, planform, lift-drag studies.
  - `'orbit'`: Rocketry, orbital mechanics, numerical integration, trajectories.
  - `'code'`: Software, algorithms, systems programming, Linux configurations.

---

## 5. When to Choose `.md` vs. `.mdx`

- **Use `.md` (Standard Markdown)**: For 90% of technical writing, essays, Linux guides, architecture breakdowns, and conceptual roadmaps. Markdown parses faster and keeps files portable.
- **Use `.mdx` (Component MDX)**: ONLY when an article requires live, client-side interactive widgets (interactive parameter sliders, dynamic function plots, sortable data tables, or 3D model viewers).

---

## 6. Interactive MDX Component Catalog

When authoring a `.mdx` file, you can import and drop in these interactive components:

### 1. `FunctionPlot`
Plots mathematical formulas or JS functions with live sweep parameters.
```mdx
import { FunctionPlot } from '@components/mdx';

<FunctionPlot
  client:load
  title="Prandtl Lifting-Line Circulation"
  fn="sin(x) * exp(-0.1 * x)"
  domain={[0, 10]}
  xLabel="Spanwise Coordinate y/(b/2)"
  yLabel="Circulation Gamma"
  height={320}
/>
```

### 2. `ParamPlayground` & `ParamSlider`
Provides interactive sliders that reactively bind to plots and metric cards via a shared `scopeId`.
```mdx
import { ParamPlayground } from '@components/mdx';

<ParamPlayground
  client:load
  scopeId="airfoil-sweep"
  title="Aerodynamic Parameters"
  parameters={[
    { id: 'alpha', label: 'Angle of Attack', min: -5, max: 20, step: 0.5, defaultValue: 4, unit: 'deg', symbol: 'alpha' },
    { id: 'cd0', label: 'Parasite Drag', min: 0.005, max: 0.05, step: 0.001, defaultValue: 0.015, symbol: 'C_{D,0}' }
  ]}
/>
```

### 3. `MetricCard` & `MetricGrid`
Displays KPI stat cards with baseline comparison and status coloring.
```mdx
import { MetricGrid, MetricCard } from '@components/mdx';

<MetricGrid client:load columns={3}>
  <MetricCard
    label="Lift-to-Drag Ratio"
    symbol="$L/D$"
    value={21.4}
    baseline={18.2}
    better="higher"
    description="Target cruise efficiency"
  />
  <MetricCard
    label="Mission Fuel Burn"
    symbol="$W_{fuel}$"
    value={43800}
    baseline={51500}
    better="lower"
    unit="kg"
    description="-15% mission fuel reduction target"
  />
</MetricGrid>
```

### 4. `DataTable`
Sortable, searchable, and CSV-downloadable data tables.
```mdx
import { DataTable } from '@components/mdx';

<DataTable
  client:load
  title="Wind Tunnel Airfoil Comparison"
  columns={[
    { key: 'airfoil', label: 'Airfoil Section', sortable: true },
    { key: 'clMax', label: 'C_L max', align: 'right', sortable: true },
    { key: 'ldMax', label: '(L/D) max', align: 'right', sortable: true },
    { key: 'stall', label: 'Stall Angle (deg)', align: 'center' }
  ]}
  data={[
    { airfoil: 'NACA 0012', clMax: '1.42', ldMax: '58.4', stall: '16.0' },
    { airfoil: 'NACA 4412', clMax: '1.67', ldMax: '72.1', stall: '15.5' },
    { airfoil: 'Clark Y', clMax: '1.55', ldMax: '64.8', stall: '14.8' }
  ]}
/>
```

### 5. `NotebookCell`
Jupyter-like code cell with collapsible source code and styled interactive output.
```mdx
import { NotebookCell } from '@components/mdx';

<NotebookCell
  client:load
  inputNumber={1}
  language="python"
  title="Compute Lift Curve Slope"
  code={`import numpy as np

def cl_alpha(aspect_ratio, e=0.85):
    return (2 * np.pi) / (1 + (2 * np.pi) / (np.pi * e * aspect_ratio))

print(f"3D Lift slope: {cl_alpha(7.5):.3f} per rad")`}
>
  <div><strong>Output:</strong> 3D Lift slope: 4.812 per rad</div>
</NotebookCell>
```

### 6. `Tooltip`
Glassmorphic explanatory tooltip for abbreviations, equations, or jargon.
```mdx
import { Tooltip } from '@components/mdx';

The <Tooltip content="Blended Wing Body" subtitle="An aircraft configuration integrating wing and fuselage">BWB</Tooltip> configuration reduces wetted area.
```

---

## 7. Math & Formatting Standards

### Mathematical Equations
- **Inline**: Use single dollar signs `$L = \frac{1}{2}\rho V^2 S C_L$`.
- **Display**: Use double dollar signs on their own lines:
  ```latex
  $$
  C_D = C_{D,0} + \frac{C_L^2}{\pi e AR}
  $$
  ```
- **Contextualization**: Always define variables and units immediately following the equation. Dimensional consistency must be maintained (SI units default: meters, kilograms, seconds, Newtons, Pascals).

### Automatic Engineering Annotations
The site's Markdown processor automatically wraps percentage variations in table cells like `(+15.1%)`, `(-8.4%)`, or `(±2.0%)` into highlighted accent badges. Use standard parenthesized percentages in comparison tables.

### Code Blocks
Always provide a valid language tag on fenced code blocks (`bash`, `rust`, `python`, `yaml`, `json`, `c`, `matlab`, `toml`).

### Section Heading Hierarchy
- The document `# Title` is generated by Astro from frontmatter. **Never start the body with an `# H1`**.
- Begin with an introductory paragraph, followed by `## Section` for major milestones/topics.
- Level-two (`##`) headings automatically populate the sticky desktop Table of Contents.

---

## 8. Editorial Quality Checklist

Before submitting an article draft, run through this verification checklist:

- [ ] **Voice**: Sounds like Vansh: honest, observant, technically grounded, zero buzzwords, no em dashes.
- [ ] **Frontmatter**: Valid YAML, quotes around title/description, real calendar date (`YYYY-MM-DD`), valid tags array.
- [ ] **Project Rules**: If a project, valid `status` (`Concept`, `In Development`, `Prototype`, `Completed`) and valid `art` (`wing`, `orbit`, `code`).
- [ ] **Claims**: Claims match the evidence. Conceptual ideas are never described as verified data.
- [ ] **Equations**: All math syntax compiles cleanly in KaTeX, variables are defined, units are stated.
- [ ] **Links**: Relative internal URLs use the Astro `url()` pattern or clean relative paths. External links point to real documentation.
- [ ] **Handoff Note**: Outside the file, include the intended target path (e.g. `src/content/writing/airfoil-study.md`) and list any unresolved questions or missing image files.
