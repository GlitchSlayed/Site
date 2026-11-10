import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriKatex } from 'satteri-katex';
import { satteriEngineeringAnnotations } from './src/lib/satteri/satteriEngineeringAnnotations.ts';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

export default defineConfig({
  prefetch: { prefetchAll: true },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fraunces',
      cssVariable: '--serif-display',
      weights: [400, 500, 600],
      styles: ['normal', 'italic'],
      fallbacks: ['Newsreader', 'Garamond', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Newsreader',
      cssVariable: '--serif',
      weights: [400, 500],
      styles: ['normal', 'italic'],
      fallbacks: ['Garamond', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--sans',
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'IBM Plex Mono',
      cssVariable: '--mono',
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['SF Mono', 'Menlo', 'Consolas', 'monospace'],
    },
  ],
  site: process.env.SITE_URL || 'https://glitchslayed.github.io',
  base: process.env.BASE_PATH || '/Site/',
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,
  build: {
    concurrency: 4,
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/og/'),
    }),
    react(),
    ...(process.env.FAST_BUILD === '1' ? [] : [pagefind()]),
    ...(process.env.SITE_BROWSER_TESTS === '1'
      ? [
          {
            name: 'browser-test-fixtures',
            hooks: {
              'astro:config:setup': ({ injectRoute }) => {
                injectRoute({
                  pattern: '/__checks/[case]',
                  entrypoint: './src/pages/__checks/[case].astro',
                });
              },
            },
          },
        ]
      : []),
  ],

  markdown: {
    processor: satteri({
      features: {
        math: true,
        rawHtml: true,
      },
      mdastPlugins: [satteriKatex()],
      hastPlugins: [satteriEngineeringAnnotations()],
    }),
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
