# Giscus discussion integration

`src/components/Comments.astro` owns the semantic section and configuration. `src/lib/comments.ts` owns lazy loading, retry/status and theme synchronization. Both project and notebook layouts use this component. The site's general theme toggle no longer contains a second Giscus controller.

## Behavior

- Load within 200 pixels of the discussion section, or immediately through Load discussion.
- Set the initial theme before inserting the external script, preventing the previous light/dark race.
- Observe the site's `data-theme` for subsequent changes and send Giscus `setConfig` messages.
- Show a retry after script failure or a 20-second timeout. A GitHub discussions link is always available, including without JavaScript.
- Accept frame messages only from `https://giscus.app` and the current iframe window. Valid metadata can replace the repository fallback with the exact thread URL.
- Leave authentication and comment submission to Giscus. No GitHub tokens are stored in this code.
- Retain public Giscus attribution. The section uses the site's serif heading/body, mono labels, warm surfaces and restrained borders. The iframe themes use matching palettes with Inter controls and Newsreader comment text.

## Configuration and existing threads

The repository and category IDs remain the supplied GlitchSlayed/Site values. Installation/category permissions must be verified against the live repository by its owner; this local pass did not authenticate or post comments.

Default mapping remains `title`, with strict matching off, to preserve the existing integration. Changing mapping to pathname or enabling strict mode can orphan existing thread matches. Do not change this globally without an explicit migration inventory.

Pin a known discussion when renaming a title:

```astro
<Comments discussionNumber={123} />
```

Or configure a new page deliberately:

```astro
<Comments mapping="specific" term="wind-tunnel-investigation" />
```

The numeric example is a placeholder, not an existing thread. `mapping` accepts title/pathname/specific/number; `term` is needed for specific/number unless discussionNumber is supplied. Only render one Comments component per page.

## Themes and deployment

`giscus-light.css` and `giscus-dark.css` keep the complete upstream-style variable set. URLs are derived from Astro's configured `site` and base path, so relocating the deployment does not require editing multiple script literals. The old `giscus-theme.css` remains a compatibility import of the light theme.

Custom iframe CSS must be publicly reachable over HTTPS and served with cross-origin access allowed. GitHub Pages supports public assets; confirm actual deployment headers if using another host. Localhost/127.0.0.1 previews use built-in light/dark_dimmed themes because the remote iframe cannot depend on local CSS. External fonts are optional: system/Georgia fallbacks remain if font loading is blocked.

Keep `SITE_URL` and `BASE_PATH` aligned with the final published origin/path. On a preview domain, custom CSS still resolves to the configured site. Deploy CSS before expecting remote Giscus to load the new theme. A network blocker or restrictive CSP can prevent the widget; the persistent GitHub link is the fallback. Where a CSP exists, allow the Giscus script/frame and the external resources you intentionally use.

## Verify before publishing

1. Open a project and a notebook article in both themes. Scroll to comments and confirm one iframe and no initial theme flash.
2. Toggle the site theme after loading; verify both the composer and existing comments change.
3. Block the Giscus script, verify retry and the GitHub fallback, then unblock and retry.
4. Open a page with an existing discussion; verify that the same thread appears. Test a new page without posting to confirm its empty composer is usable.
5. Test a narrow viewport, keyboard navigation, GitHub sign-in, and a long comment. Do not post test comments to a real article without intending to publish them.
6. Inspect the published CSS URLs and verify that Giscus receives successful cross-origin responses.

Browser regression tests intercept the external script and emulate a Giscus frame for deterministic loading/theme/retry assertions. They do not prove live GitHub app permissions or sign-in.

Official reference: https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md (custom themes, message contracts, strict matching and migration).
