# Engineering design refinement

Second design pass, November 5, 2026. Builds on personal-redesign.md.

## Ten substantial improvements

1. **Homepage assembly drawing.** Replaced the small informal sketch with an original exploded flight-vehicle plate: nose, payload, airframe, fins, nozzle, centerline, assembly guides, and reference axes. It is explicitly an illustrative assembly, not a fabricated vehicle or working drawing.
2. **Project-specific covers.** The airfoil proposal has generated NACA 0012/4412 section profiles and a plate reference; BWB has a conceptual planform and a noncircular cabin section; RustyUKI has a boot-image assembly and trial-boot diagram; GOFR has proposed system layers. Shared ink, paper, line weights, captions, and annotations replace unrelated gradient shapes.
3. **Default visual system and image frames.** Wing, orbit, and software fallbacks use the same drawing language. Supplied screenshots and images retain support in paper-colored frames. Missing image assets show a useful schematic rather than a prompt to add an export. The optional old hero backdrop is now drafting-paper texture.
4. **Purposeful shaders.** A small custom WebGL shader adds subtle paper grain and a slow material sheen behind the homepage drawing. Cover textures render statically. Drawing geometry and labels are always separate SVG/HTML. There is a saved Texture on/off control. Animation pauses offscreen and in hidden tabs; reduced motion produces static output. Canvas resolution is capped at approximately 180,000 pixels, DPR at 1.5, and animated draws at 20 per second. No new dependency or decorative React island is required. Unavailable/lost WebGL leaves the readable CSS/SVG fallback.
5. **Consistent personal identity and share cards.** A V-and-datum mark replaces the generic rocket icon in the site chrome and favicon. Open Graph cards now use the site's paper, serif, rule, and drawing vocabulary. Project cards use their specific illustration; software articles use the software schematic. Titles are wrapped and escaped.
6. **Engineering briefs.** Each existing project now has an explicit question, approach, existing evidence, limiting constraint, methods, and next check, summarized from its own write-up. These appear in a structured brief on project detail pages and a next-check note on cards. An expandable larger project drawing is available on detail pages.
7. **Engineering register.** The project index offers drawing cards or a table of project stage, question/method, and next check. View preference is saved; search, filters, sorting, resets, and counts apply to both views. Search now includes methods and the engineering question. The table scrolls on small screens.
8. **Homepage question board.** Actual project questions and next checks replace generic activity cues. The board derives from the same project metadata as the brief and register, so updates stay consistent.
9. **Source shelves.** Project and blog pages collect external Markdown links already in the write-up into an expandable resource list, with human labels and source domains. Duplicate URLs and image links are omitted. This is a navigation aid, not a claim that sources have been independently verified.
10. **Working method on the About page.** Tools are connected to tasks rather than proficiency claims. A short engineering-method section describes the intended practice of defining comparison conditions, keeping assumptions visible, and retaining methods/settings/limitations with results.

## Authoring fields

Project collection schema now supports these optional fields. Existing content without them still renders.

```yaml
drawing: airfoils
engineering:
  question: "What question does this project answer?"
  approach: "The actual or proposed approach."
  constraint: "The constraint that matters to this work."
  evidence: "What exists, without implying unperformed validation."
  nextCheck: "The next specific thing to establish."
  methods: ["Method one", "Method two planned"]
```

Valid drawing values: `airfoils`, `bwb`, `uki`, `gofr`, `rocket`, `wing`, `orbit`, `code`.

Custom `asset` or `screenshot` visuals with a supplied `visualImage` take precedence. Otherwise cards use `drawing`, falling back to the required `art` value. Legacy `visual: mesh/dither/grain/grid/dots` metadata remains schema-compatible but no longer selects an unrelated colored shader as the default cover. `visualAnimate` is retained for compatibility; the new technical cover texture is intentionally static. The homepage alone opts into slow motion.

## Geometry and evidence

The airfoil drawing uses the standard four-digit thickness polynomial, cosine-spaced points, camber-normal thickness, and the closed trailing-edge coefficient `-0.1036`. The 0012 has zero camber; the 4412 has 4% maximum camber at 40% chord; both have nominal 12% thickness. This creates an illustrative profile comparison, not the final manufactured geometry. Flat-plate thickness remains illustrative. BWB, rocket, orbit, and software diagrams are schematic. Dimension-style guides show reference geometry without fabricated numerical dimensions.

No engineering model, project prose body, or blog prose body was changed. Project frontmatter was extended with the summaries and illustration selection. No results, benchmarks, test completion, or employer-specific numbers were invented.

## Files

- `src/lib/drawings.ts`: shared SVG geometry and descriptive captions.
- `src/components/drawings/TechnicalPlate.astro`: accessible figure wrapper and decorative canvas.
- `src/lib/technicalSurface.ts`: shader, visibility lifecycle, preference, and theme handling.
- `src/styles/technical.css`: plates, brief, register, resource shelf, and method styling.
- `src/lib/socialCard.ts`: standalone social-card SVG renderer used by the existing Sharp endpoint.
- `src/components/EngineeringBrief.astro` and `SourceShelf.astro`: content-backed overview components.
- `src/lib/sourceLinks.ts`: actual-link extraction and deduplication.
- `tests/drawings.test.ts`: geometry and link-extraction regression cases for the existing Vitest suite.

## Verification

- Rendered all seven distinct plate designs and the longest existing project social card with Sharp; visually inspected the cover sheet, homepage rocket, corrected airfoil profile, and social layout.
- Executed independent Node assertions for 0012 symmetry, thickness, trailing-edge closure, 4412 maximum camber, SVG instance-ID isolation, and source-link filtering/deduplication. Passed.
- Parsed all four project frontmatter blocks with YAML and checked the new brief fields. Passed.
- Parsed updated browser scripts through Node's TypeScript stripper and JavaScript parser; checked shader-controller and social-renderer JavaScript syntax. Passed.
- Retained the original Markdown/MDX prose and numerical implementation. Checked ZIP integrity on delivery.
- Full Astro build, TypeScript type checking, Vitest, browser interaction, and live WebGL rendering remain unverified in this environment. The previous dependency install failed with registry HTTP 403 and Chromium launch was denied a required socket operation. No successful browser validation is claimed.

After installing dependencies, use the existing `bun run check`, `bun run test`, and `bun run build`. In preview, verify both themes, mobile layouts, register filter/sort parity, WebGL fallback, texture preference, and reduced-motion behavior.
