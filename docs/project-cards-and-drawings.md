# Project Cards & Technical Drawings Guide

This document explains how project card drawings work on the homepage and projects catalogue, how the fallback system behaves, and how to swap or add drawings for new projects.

---

## 1. How Project Cards Work

Every project card on the **Home page** (`Selected work`) and the **Projects catalogue** (`/projects/`) renders an illustrative technical drawing plate above the project title and metadata:

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Frontmatter                      │
│                                                             │
│  Option A (Direct File Path):   Option B (Named Preset):    │
│  drawing: "/Site/.../card.svg"  drawing: "bracket"          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      ProjectCard.astro                      │
│             Passes drawing to TechnicalPlate.               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TechnicalPlate.astro                     │
│  • Direct SVG/Image: inlines or frames the file directly    │
│  • Named Preset: calls drawingSvg(preset)                   │
│  Applies paper/ink/accent theme tokens and corner marks.    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Why the Old System Was Rigid (The BWB Duplicate Bug)

Previously, two issues made card swapping confusing:
1. **The BWB Duplicate Bug:** In `src/lib/drawings.ts`, both `'bwb'` and the generic fallback `'wing'` pointed to `bwb()`. If an aerospace project only had `art: wing` and no explicit `drawing`, it silently displayed the Blended Wing Body aircraft drawing.
2. **Three-File Requirement:** Adding a new drawing required editing `src/content.config.ts` (strict enum), `src/lib/drawings.ts` (string concatenation functions and metadata), and `tests/drawings.test.ts`.

Both have been decoupled:
- Direct SVG and raster file paths are now supported directly in frontmatter without editing code.
- `art: wing` now maps to an independent generic wing planform (`wing()`), not the BWB aircraft.

---

## 3. How to Set or Swap a Card

### Method A: Direct File Path (Recommended for Quick Swaps)
Put your SVG (or PNG/WebP) in `public/` (e.g. `public/images/` or under your notebook figures directory). Then reference it in the project's frontmatter:

```yaml
---
title: "My Aerospace Investigation"
drawing: "/Site/notebooks/aerospace-bracket/figures/bracket_load_paths_card.svg"
---
```

Astro will automatically:
- Read and inline the SVG at build time into `<figure class="technical-plate">`.
- Apply technical plate styles and corner framing.
- Require zero TypeScript or schema edits.

### Method B: Named Code Preset (For Procedural / Themed SVGs)
When you want procedural math (like `airfoilCoordinates()`) or custom canvas background shaders, use a registered preset:

```yaml
---
title: "Aerospace Bracket FEA"
drawing: bracket
---
```

Available presets in `src/lib/drawings.ts`:
- `bracket`: Single-lug bracket under downward vs lateral bending and fillet sensitivity.
- `bwb`: Blended wing body planform and cabin pressure vessel cross-section.
- `airfoils`: NACA 0012, 4412, and flat-plate chord/camber comparison.
- `uki`: Unified Kernel Image EFI boot assembly.
- `gofr`: Fedora Linux system layers stack.
- `rocket`: Exploded flight vehicle assembly schematic.
- `wing`: Generic aerodynamic wing planform and mean chord.
- `orbit`: Celestial mechanics reference frame and velocity vector.
- `code`: Software pipeline contracts and test checks.

---

## 4. SVG Design Specifications

To ensure custom SVGs look authentic to the site's editorial drafting style, follow these guidelines:

### ViewBox & Dimensions
- ViewBox: `viewBox="0 0 800 480"` (standard 5:3 ratio).
- Coordinate space: $800 \times 480$ units.

### Semantic CSS Classes
Use the following class names inside your SVG:
| Class | Role | Default Light | Default Dark |
| --- | --- | --- | --- |
| `.body` | Main solid geometry outline and fill | Stroke `#383d36`, Fill `#f1eee4` | Stroke `#d7d7c8`, Fill `#242622` |
| `.side` | 3D extruded side facets | Fill with subtle shade | Fill with subtle shade |
| `.bore` | Internal holes / cutouts | Fill with inner shade | Fill with inner shade |
| `.line` | Standard outlines and callout leaders | Stroke `#383d36` | Stroke `#d7d7c8` |
| `.faint` | Dimension lines, extension ticks | Stroke `#b8b6a8` | Stroke `#62675c` |
| `.datum` | Centerlines / reference axes | Dashed stroke (`9 5 2 5`) | Dashed stroke (`9 5 2 5`) |
| `.mesh` | Finite element mesh lines | Fine stroke (`0.65px`) | Fine stroke (`0.65px`) |
| `.accent` | Primary vectors (forces, arrows) | Stroke `#a4462b` | Stroke `#da936a` |
| `.accent-fill` | Highlighted regions (fillets, areas) | Fill `#a4462b` (9% opacity) | Fill `#da936a` (9% opacity) |
| `.small` | Mono labels and dimensions | Monospace 11px | Monospace 11px |
| `.axis-label` | Vector labels ($F_y, F_z$) | Serif italic 19px | Serif italic 19px |
| `.caption` | Primary headline in bottom left | Serif 19px | Serif 19px |

### Color Tokens
If using inline styles or CSS variables, use:
- `var(--plate-paper)`: `#f1eee4` (light) / `#242622` (dark)
- `var(--plate-ink)`: `#383d36` (light) / `#d7d7c8` (dark)
- `var(--plate-accent)`: `#a4462b` (light) / `#da936a` (dark)
- `var(--plate-faint)`: `#b8b6a8` (light) / `#62675c` (dark)

---

## 5. Featuring a Project on the Home Page

In the project frontmatter, set:
```yaml
featured: true
```
The project with `featured: true` and the newest `date` is selected as the lead project on the home page (`src/pages/index.astro`), displaying its technical card prominently under **Selected work / On my workbench**.
