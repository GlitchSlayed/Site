# Glitchy's Technical Blog

A personal blog and project portfolio covering aerospace, engineering, rocketry, and technology.

Built with a minimal layout, light and dark themes, and subtle red-orange accents.

## Stack

- **Astro 7:** static site generation
- **TypeScript:** typed configuration and application code
- **Markdown / MDX:** articles and project pages
- **KaTeX:** mathematical equations
- **Plain CSS:** styling and responsive layouts
- **React + Paper Design shaders:** decorative project and homepage visuals
- **GitHub Pages + Actions:** hosting and deployment

## Development

Requires **Node.js 24** and npm.

```bash
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run check` | Check Astro and TypeScript |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Preview the production build |

## Project Structure

| Path | Contents |
| --- | --- |
| `src/content/writing/` | Blog articles |
| `src/content/projects/` | Project pages |
| `src/pages/` | Routes and main pages |
| `src/components/` | Reusable components and illustrations |
| `src/components/visuals/` | Project-card shader, pattern, image, and screenshot treatments |
| `src/layouts/` | Shared page layouts |
| `src/styles/global.css` | Site styling and theme colors |
| `src/config.ts` | Public identity and contact links |
| `public/` | Static assets |
| `.github/workflows/` | Build and deployment workflows |
| `docs/` | Writing playbook and technical reference |

## Writing Content

Add a `.md` or `.mdx` file to the appropriate content directory:

```yaml
---
title: "Article title"
description: "A short summary."
date: 2026-10-24
tags: [Aerospace, Simulation]
draft: false
sample: false
---
```

Write the article below the metadata. The filename determines its URL.

- Use `##` headings for article contents navigation.
- Use `$...$` for inline math and `$$...$$` for display equations.
- Use fenced code blocks with a language for syntax highlighting.
- Set `draft: true` to exclude unfinished content.
- Dates control ordering; future dates do not schedule publication.

Project entries also require `status` and `art`. Set `featured: true` to make a project eligible for the homepage. Available artwork values are `wing`, `orbit`, and `code`.

For the full writing workflow, editorial templates, content schema, and project visual options, see [`docs/technical-reference.md`](docs/technical-reference.md) and [`docs/writing-playbook.md`](docs/writing-playbook.md).

## Configuration

Edit `src/config.ts` for the public name, description, and contact links. Empty contact fields remain hidden.

Edit `src/styles/global.css` for typography, colors, spacing, and responsive styles. Fonts load from Google Fonts with system fallbacks.

Use the `url()` helper for internal links in Astro components so they work under the GitHub Pages repository path.

## Deployment

The included GitHub Pages workflow builds and publishes the site through GitHub Actions. It configures the production URL and repository base path automatically.

Run it from the **Actions** tab, or enable its push trigger for automatic deployment from `main`.

## Notes

Search runs locally in the browser. The site requires no database or application server.

Starter articles are labeled as samples, and initial project entries describe proposed studies. Replace them with original content as the site develops.
