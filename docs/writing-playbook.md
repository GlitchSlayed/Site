# Glitchy's Technical Blog: Writing Playbook and Templates

Use with [`technical-reference.md`](technical-reference.md). This guide defines how to develop original blog articles and project pages for the aerospace and technology site. Treat the templates as starting structures, not mandatory section counts or claims about completed work.

## 1. Suggested ChatGPT Project instructions

Copy the following into the Project's instructions field if using this guide with a writing assistant. Upload this file and `technical-reference.md` as reference material.

> Help me plan, write, and revise content for Glitchy's Technical Blog, publicly branded as Vansh's site. Follow the supplied technical reference and writing playbook, using my latest messages and current source files when they differ from older reference material. Write thoughtful, technically detailed first-person prose in a natural voice. Distinguish ideas, plans, implemented features, observations, tested results, and published evidence. Never invent personal experience, data, benchmarks, citations, collaborations, or completed work. Use current primary sources for unstable technical facts when browsing is available. Most outputs should be Markdown files compatible with my Astro writing and projects collections. When I request both a project page and a blog post, make the project page a durable overview and the post a dated narrative; cross-link them without repeating the entire content. Keep required metadata valid, use real dates, include project status and a valid art value, and default unfinished drafts to draft: true. Give the intended repository path, complete file content, and a short list of unresolved facts or assets outside the file. Do not change site code or invent unsupported frontmatter fields just to fit an article. Avoid em dashes, corporate filler, overclaiming expertise, and forced space metaphors. Never claim that you tested or deployed something unless you actually did.

This instruction block can guide style and workflow, but it does not supply missing project facts. Ask focused questions when a missing fact would change the article's central claim.

## 2. Choose the right deliverable

| User request | Best output |
| --- | --- |
| “Explain why I want to build this” | Concept/motivation blog post |
| “Describe the project and roadmap” | Project overview |
| “I tried X and here is what happened” | Experiment or progress article |
| “Compare these technologies” | Analysis with explicit evaluation criteria |
| “Teach this engineering idea” | Technical explainer with assumptions and examples |
| “Here is my data or code” | Evidence-led write-up, with verification limits |
| “Give me both a project page and a post” | A linked pair with distinct purposes |

Do not require a finished project before writing about an idea. A concept post can be substantial if it clearly explains motivation, design choices, unknowns, and the next experiment.

## 3. Lightweight intake

Before drafting, extract the answers already present in the conversation or supplied files:

1. What is the topic or project?
2. Is this a concept, prototype, active investigation, or completed piece of work?
3. What has the author actually done?
4. What question should the reader understand by the end?
5. What evidence, code, notes, images, or sources are available?
6. Which decisions are settled, tentative, or open?
7. Who is the likely reader, and what background can be assumed?
8. Does the user want a rough draft, polished draft, or publish-ready file?
9. Which date and filenames should be used?
10. Is there a related project page, blog post, or repository to link?

Do not turn every request into a questionnaire. Draft from known facts and mark the few consequential unknowns separately. If the user requests a rough starting point, make useful progress with conservative claims.

## 4. Shared frontmatter conventions

Use this shape for writing:

```yaml
---
title: "A clear, specific title"
description: "One or two concise sentences explaining what this post covers."
date: "2026-10-24"
tags: [Technology, Open source]
draft: true
sample: false
---
```

For a project, add:

```yaml
status: Concept
art: code
featured: false
visual: dither
visualAccent: "#739cda"
visualLabel: "Project label"
visualAnimate: false
```

The visual fields are optional. `visual` accepts `dither`, `grain`, `mesh`, `grid`, `dots`, `asset`, or `screenshot`; `visualAccent` must be a six-digit hex color. Image variants may also use `visualImage` and `visualImageAlt`. See `technical-reference.md` for behavior and examples. Keep `art` because it remains required even when a custom visual is selected.

The examples use a valid example date. Replace it with the intended date when generating a real file. Do not leave `YYYY-MM-DD` or `TBD` in ready-to-save frontmatter.

Recommended editorial defaults:

- `draft: true` for a first draft or incomplete file.
- `sample: false` for the author's actual writing, including conceptual work.
- `featured: false` unless the user chooses homepage placement.
- Two to four consistent tags, with the main subject first.
- A stable, descriptive filename without the date unless a dated filename is requested.

A conceptual article can be published with `draft: false` when its claims and sources are ready. A completed project can remain a draft if its write-up is unfinished. Publication state and project maturity are independent.

## 5. Template A: Concept or motivation blog post

Suggested path: `src/content/writing/why-im-building-example.md`.

The following is an editable skeleton. Its metadata is valid, but the editorial comments need to be addressed before publication.

````markdown
---
title: "Why I’m exploring this idea"
description: "The problem behind a proposed project, the approach I’m considering, and what I need to establish next."
date: "2026-10-24"
tags: [Technology, Open source]
draft: true
sample: false
---

<!-- Open with the actual question, frustration, observation, or experience. Do not invent a personal anecdote. -->

## The problem I keep coming back to

<!-- Describe the problem in concrete terms. Explain the current situation and who or what is affected. -->

## The idea

<!-- State the proposed concept in a few sentences. Say explicitly that it is conceptual if nothing has been implemented. -->

## Why this approach interests me

<!-- Connect the design choices to the original problem. Explain alternatives and tradeoffs where useful. -->

## What I haven’t established yet

<!-- Identify uncertainty, feasibility questions, dependencies, or decisions still under consideration. -->

## The first thing I want to test

<!-- Describe one concrete experiment, prototype, or investigation and what it would help decide. -->

## Where this goes next

<!-- Link a real project page if one exists. End with a grounded next step, not an exaggerated promise. -->

## References

<!-- Include only real sources used in the post. Remove this section if no external claims require references. -->
````

For a more personal article, fewer headings may read better. Preserve the distinction between a clear motivation and an unsupported claim that the proposed solution is superior.

## 6. Template B: Durable project overview

Suggested path: `src/content/projects/example-project.md`.

````markdown
---
title: "Example Project"
description: "A concise description of the problem this project addresses and its proposed approach."
date: "2026-10-24"
tags: [Technology, Open source]
status: Concept
art: code
featured: false
draft: true
sample: false
---

<!-- Give the project's purpose in one short opening paragraph. -->

## Current status

<!-- State what exists today. Separate documentation, code, prototypes, and verified results. -->

## The problem

<!-- Describe the need, baseline, and constraints. -->

## Goals and scope

<!-- Name concrete goals. State boundaries when they prevent misunderstanding. -->

## Proposed approach

<!-- Describe architecture, engineering methods, or implementation stages. Clearly distinguish proposed and existing components. -->

## Decisions and tradeoffs

<!-- Explain why options are being considered and what evidence would change a decision. -->

## Roadmap

| Milestone | Intended deliverable | Completion criterion | State |
| --- | --- | --- | --- |
| Define the baseline | Written scope and inputs | Assumptions and constraints documented | Planned |
| Build the first prototype | Minimal implementation or model | A specified basic behavior can be demonstrated | Planned |
| Evaluate the approach | Test notes and comparison | Results checked against stated criteria | Planned |

## Verification and evaluation

<!-- Explain how future results will be checked. If testing has occurred, state exactly what was run and observed. -->

## Open questions

<!-- Record the unresolved issues that matter to the next stage. -->

## Progress notes

<!-- Add dated, factual updates as work happens. Do not mark roadmap work complete without evidence. -->

## Related writing and resources

<!-- Link the actual repository, companion articles, public documentation, and references. -->
````

For an early concept, replace “Results” with a proposed evaluation method. For an active project, add real evidence and dated progress. For a completed project, retain limitations and distinguish the finished scope from possible future extensions.

## 7. Template C: Engineering investigation or simulation article

Suggested path: `src/content/writing/example-investigation.md`.

````markdown
---
title: "A specific engineering question"
description: "The model, operating conditions, and comparison used to investigate a defined question."
date: "2026-10-24"
tags: [Aerospace, Simulation]
draft: true
sample: false
---

<!-- Introduce the question and the actual state of the investigation. -->

## Question and scope

<!-- Define the system, operating range, comparison, and exclusions. -->

## Model and assumptions

<!-- Identify governing equations, simplifying assumptions, and applicable regimes. -->

## Inputs and conditions

| Parameter | Symbol | Value | Unit | Source or assumption |
| --- | --- | --- | --- | --- |
| <!-- Add a real input --> | | | | |

## Method

<!-- Explain calculation steps, numerical methods, software versions, and convergence criteria where relevant. -->

## Verification

<!-- Compare with an analytic case, independent implementation, or traceable benchmark. Distinguish verification from experimental validation. -->

## Results

<!-- Insert only results that actually exist. Include figure conditions, axes, units, and interpretation. For a planned study, rename this to Planned outputs. -->

## Sensitivity and limitations

<!-- Explain influential assumptions, uncertainty, numerical error, and phenomena the model cannot represent. -->

## What the result supports

<!-- Answer the original question within the evidence's actual limits. -->

## Reproducing the work

<!-- Include real code/data links and execution details. If work is not reproducible yet, say what is missing. -->

## References

<!-- Real sources only, cited near the claims they support. -->
````

Good figures answer a question; they do not merely make the post look technical. If there are no data yet, propose a plot specification outside the finished article rather than inventing points or trends.

A figure specification can include: filename, variable on each axis, units, operating conditions, series definitions, source data, intended comparison, and caption. Label illustrative calculations as illustrative.

## 8. Template D: Linux, software, or hardware analysis

Suggested path: `src/content/writing/example-technology-analysis.md`.

````markdown
---
title: "A specific technology question"
description: "An examination of the design, practical tradeoffs, and evidence behind a tool or technical approach."
date: "2026-10-24"
tags: [Linux, Technology]
draft: true
sample: false
---

<!-- Introduce the actual question. Distinguish personal testing from research based on public documentation. -->

## What I’m evaluating

<!-- Identify versions, hardware, workload, configuration, and evaluation date when applicable. -->

## How it works

<!-- Explain the relevant architecture or mechanism in reader-friendly technical terms. -->

## Why the design matters

<!-- Connect technical decisions to usability, performance, compatibility, maintainability, or control. -->

## Comparison and tradeoffs

| Criterion | Approach A | Approach B | Evidence or caveat |
| --- | --- | --- | --- |
| <!-- Choose a meaningful criterion --> | | | |

## What I observed

<!-- Include only actual observations. If no testing occurred, use What the documentation establishes instead. -->

## What remains uncertain

<!-- Identify unanswered questions, missing measurements, and context that may change the outcome. -->

## My current assessment

<!-- State a bounded opinion tied to the evidence and the author's use case. -->

## References

<!-- Prefer project docs, release notes, issue discussions, standards, and relevant primary benchmarks. -->
````

Do not infer performance from language choice alone. A Rust rewrite, new renderer, or newer kernel is not automatically faster. Explain the mechanism and seek a relevant measurement.

Avoid turning every comparison into a winner/loser ranking. Sometimes the useful conclusion is which constraints make each approach appropriate.

## 9. Template E: Progress update or build log

Suggested path: `src/content/writing/example-project-progress.md`.

````markdown
---
title: "Project update: a specific milestone or question"
description: "What changed, what was checked, and what the next iteration needs to resolve."
date: "2026-10-24"
tags: [Technology, Simulation]
draft: true
sample: false
---

<!-- Open with the material change since the previous update. -->

## What changed

<!-- Describe completed changes, not the whole backlog. -->

## How I checked it

<!-- Record commands, cases, measurements, or visual checks actually performed. -->

## What didn’t work

<!-- Describe useful failures and what they changed in the author's understanding. -->

## What I learned

<!-- Connect the evidence to a decision or explanation. -->

## Next steps

<!-- Name the next bounded tasks. Cross-link the project's durable overview. -->
````

A failed test can support a valuable article. Do not rewrite a failure as success simply to give the post a satisfying conclusion.

## 10. Example of a linked pair for a conceptual project

For an idea such as GOFR, use two different deliverables. The following is a structural example, not a statement that implementation exists or that design decisions are final.

Project page:

- Path: `src/content/projects/gofr.md`.
- Focus: the proposed remix's purpose, intended scope, candidate architecture, decisions, feasibility questions, and roadmap.
- Appropriate state: `Concept` or the author's confirmed current status.
- Appropriate art: `code`.
- Link to the motivation post using its actual rendered route.

Blog post:

- Path: `src/content/writing/why-im-planning-gofr.md`.
- Focus: the author's actual motivation, why selected approaches are interesting, what is settled, and what still needs investigation.
- Link to the project overview for ongoing scope and progress.
- Identify intended defaults as proposed until confirmed implemented.

The project overview should not duplicate every personal motivation paragraph. The blog post should not become a second copy of the milestone table.

If a prior project brief or notes file is supplied, read it before making specific claims. These templates do not supersede that source.

## 11. References and evidence patterns

A site-ready citation can be written as:

```markdown
The project's documentation describes the intended behavior [1]. My local
observations cover only the configuration described above.

## References

1. [Actual documentation title](https://example.org/confirmed-document),
   publishing organization.
```

The URL above is a syntax example, not a reference to include in a real article.

Keep an editorial evidence table outside the publication file when useful:

| Claim | Basis | Confidence or limitation | Follow-up |
| --- | --- | --- | --- |
| A feature exists in a specified version | Official documentation | Confirm release/version | Check release notes |
| A test produced a result | Author's supplied log or data | Limited to stated setup | Retest if conditions change |
| An approach may improve performance | Inference from mechanism | Not measured | Design a benchmark |
| A project will include a feature | Author's stated plan | Not implemented | Confirm feasibility |

Do not cite the ChatGPT conversation as independent evidence for a technical fact. It can establish what the author intends or reports, but not validate the underlying physics or software behavior.

## 12. Useful prompts for the writing Project

### Draft a linked pair

> Use the technical reference and writing playbook. Based on the notes below, create a project overview and a separate motivation blog post. The project is still conceptual. Separate confirmed decisions, tentative ideas, and open questions. Provide valid frontmatter, filenames, and working relative cross-links. Default both files to draft: true. List missing facts outside the files and do not invent results.

### Turn notes into a technical article

> Turn these notes into a detailed but readable article for my site. Preserve the technical reasoning, define unfamiliar terms, and check every claim against the evidence I supplied. Identify anything requiring external verification. Give me the complete Markdown file plus a short editorial task list.

### Explain a method without claiming it was tested

> Write an educational walkthrough of this proposed method. Distinguish the general theory, illustrative calculations, and tests I would need to run. Do not imply I implemented or validated it. Use equations and code only where they clarify the explanation.

### Update a project page

> Update this existing project page using the new progress notes below. Preserve its filename and existing metadata unless a change is necessary. Move work into completed status only when the notes support it. Add a dated progress entry and revise the roadmap to match the current state.

### Review before publication

> Review this Markdown against the technical reference. Check frontmatter, claim accuracy, equations and units, citations, project status, figures, relative links, readability, and duplication with the linked project page. Return the corrected file and explain material changes. Do not claim a build passed unless you actually ran it.

### Revise for my voice

> Keep the technical substance, but make this sound like a curious engineering student documenting real work. Use first person where grounded, keep uncertainty explicit, remove corporate language and inflated expertise, and avoid em dashes. Do not turn it into a generic beginner tutorial unless I ask.

## 13. Output contract

When the user asks for files, deliver `.md` files where supported. Otherwise provide one complete fenced Markdown block per file, with the target path outside the block. Use an outer four-backtick fence when the document itself contains triple-backtick code examples.

A strong handoff contains:

1. **Target path:** where the file belongs in the site repository.
2. **Complete content:** valid frontmatter and an editable article body.
3. **Asset list:** only real supplied assets, plus separately identified requested figures.
4. **Open questions:** essential unresolved facts, clearly outside the file.
5. **Validation status:** what was actually checked and what the author must still preview.

Do not wrap site Markdown in ChatGPT writing-block syntax. Do not include explanatory chat text before the opening YAML delimiter inside the file. Do not leave unsupported citation tokens or local download links in the publication text.

## 14. Editorial review checklist

### Metadata and publication

- The filename and target collection are correct.
- The date is real and appropriate.
- Required fields are present and correctly typed.
- Projects include status and a valid art selector.
- Draft and sample flags mean what they say.
- Featured placement is intentional.

### Technical substance

- The central question is clear.
- Every claim about the author's work is supported.
- Proposed work is visibly proposed.
- Inputs, units, notation, and assumptions are defined.
- Numerical examples are calculated and checked, or labeled unverified.
- Results are traceable to actual evidence.
- Limitations and unanswered questions are proportionate and specific.
- AI assistance is described accurately where material.

### Sources and assets

- References exist and support the nearby claims.
- Version-sensitive facts are checked against current sources.
- Figure files exist at the referenced locations.
- Captions and alt text are useful.
- Illustrations are not presented as data.
- Internal links resolve under the site's base path.

### Writing and presentation

- The article opens with its question or point.
- The body does not repeat the layout's H1.
- Main sections use `##` headings.
- Jargon is explained as needed.
- Tables are readable and not excessively wide.
- No fabricated anecdotes, inflated expertise, or forced conclusions remain.
- No publication-visible TODOs remain in a publish-ready file.

### Final verification

- Run `npm run check`.
- Run `npm run build`.
- Preview the built site and inspect desktop/mobile layouts.
- Check math, code blocks, images, search labels, and cross-links.
- Stage the intended source files and assets, not node_modules or generated output.
- Inspect the deployment result after pushing.

If these checks were not executed, describe the output as a prepared draft, not a verified deployment.
