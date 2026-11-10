# Personal site redesign · November 5, 2026

This revision follows the author grounding and voice in editor-reference.md, the separation of projects from dated writing in writing-playbook.md, and the existing collection, base-path, and MDX architecture. No project body, model, plot, or numerical calculation was rewritten. This document supersedes older descriptions of the homepage, indexes, and newspaper reader.

## Homepage: 12 changes

1. Replaced the institutional-sounding hero with a first-person introduction and a clear personal headline.
2. Made the author, university, concentration, location, and graduation year visible without a dossier format.
3. Replaced the rocket trajectory and invented stage-separation altitude with a labeled illustrative airfoil sketch.
4. Added a personal notebook annotation tied to the actual wind tunnel proposal.
5. Created three distinct navigation paths for work, writing, and the person behind it.
6. Rebuilt selected work as an asymmetric lead project and companion notes.
7. Derived the workbench from published project data instead of invented active investigations and specifications.
8. Kept actual project status visible alongside each companion project.
9. Added a grounded manufacturing-experience passage linked to the relevant about section.
10. Replaced the compact writing list with a three-column editorial layout, descriptions, dates, and estimated reading time.
11. Added a personal sign-off and RSS follow path.
12. Built a responsive serif-led opening, annotated paper note, restrained rules, and quieter metadata instead of repeated lab labels.

## Projects: 13 changes across index and detail pages

1. Replaced research-monograph branding with approachable project-workbench framing.
2. Added collection-derived counts by actual maturity stage.
3. Added project title, description, and tag search.
4. Replaced handcoded discipline guesses with exact topic choices from content.
5. Added project-stage filtering that combines with search and topic.
6. Added selected-first, newest-first, and alphabetical sorting.
7. Added reset, live result counts, and useful no-match feedback.
8. Removed the duplicated featured project from the catalogue structure.
9. Added readable stage explanations beneath cards and an expandable stage guide.
10. Replaced the generic methods legend with an explanation of why conceptual work belongs here.
11. Reworked detail-page scope, author labels, category fallback, publication date, and estimated reading time.
12. Added a current-state explanation and accessible small-screen section navigation to project details.
13. Added tag-related blog reading and replaced the false 'investigation concluded' sign-off with neutral wording.

## Blog: 15 changes across archive and articles

1. Created a named personal masthead, The Notebook, with author and subject line.
2. Made the newest real article a front-page lead with date and reading time.
3. Added an editor's note in the author's voice.
4. Built a numbered chronological archive with larger headlines and quieter metadata.
5. Added full-body local article search combined with exact topic filtering.
6. Added reset, accurate unique-entry counts, and an empty-result message.
7. Added RSS paths at the top and bottom of the archive.
8. Replaced the duplicate-slot and clone-based reader with one canonical article body.
9. Added chapter-based facing pages: major sections become pages with natural height, so long sections and figures are not clipped to pixel budgets.
10. Retained a continuous reading option and automatically use it on narrow screens.
11. Persisted layout choice and bounded text-size preferences, with safe storage fallbacks.
12. Added a section menu that reveals the correct spread, including direct incoming heading links.
13. Added contextual previous/next controls; arrow keys apply only within the pager, not inside charts or forms.
14. Added print, copy-link feedback, an author colophon, and related reading selected by tag overlap.
15. Added a no-JavaScript readable default and print rules that show every page, including currently hidden pages.

The reader intentionally uses section-length pages rather than pretending that all articles fit identical paper sheets. It moves original DOM nodes instead of duplicating IDs and hydrated islands. When JavaScript is unavailable, the original continuous article remains visible. Reading times are approximate, not measured.

## About: 12 changes

1. Replaced the dossier introduction with a direct first-person greeting.
2. Added a concise academic/location facts line.
3. Reorganized the biography around engineering, manufacturing, computing, interests, and the notebook.
4. Grounded the manufacturing section in documented Arkwin responsibilities.
5. Gave the manufacturing lesson a prominent typographic pull quote derived from the existing bio.
6. Connected makerspace and accessibility experience to the main story.
7. Explained the AIAA role in terms of student projects and opportunities.
8. Rewrote the Linux and programming section around actual interests and thoughtful AI use.
9. Added personal car, rotary-engine, and modded-Minecraft interests from author-provided context, explicitly describing the NSX as a dream build.
10. Replaced the fake operational status and technical dossier with initials, in-page navigation, and contextual tool notes.
11. Added a scannable experience record without invented employment dates or metrics.
12. Added a personal invitation to connect, displaying only configured contact channels, plus cross-links to the work and writing.

## Implementation

- Main routes: src/pages/index.astro, projects/index.astro, writing/index.astro, about.astro.
- Article templates: src/layouts/Article.astro and BlogArticle.astro.
- Shared presentation: src/styles/personal.css, imported by Base.astro.
- Shared text utilities: src/lib/editorial.ts.
- ProjectCard.astro uses 'Selected work', semantic dates, and explicit sample labeling.
- Existing content files, collection schemas, publication URLs, engineering components, dependencies, and lockfile are preserved.
- The older newspaper.css is retained but is no longer imported by BlogArticle.astro.
- Internal links continue to use url() for repository-base hosting.

## Validation and limitations

- Extracted and parsed the three new browser scripts with Node 24's TypeScript stripper and JavaScript parser: passed.
- Reviewed local imports, content-linked project IDs, filtering state, single-slot reader structure, and packaging against the source archive.
- npm ci was attempted with the existing lockfile. The registry returned HTTP 403, preventing dependency installation. Astro check, tests, and the full build could not run.
- Browser interaction fixtures were prepared, but Chromium could not start because the environment denied its socket operation. Browser rendering and interaction verification are therefore not claimed.
- Verify responsive presentation, keyboard navigation, MDX island behavior when moving between spreads, and print output in a real browser after installing dependencies.
- On a machine with dependencies: bun install, bun run check, bun test, bun run build, bun run preview. Existing CI also performs checks.
