import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriKatex } from 'satteri-katex';
import { satteriEngineeringAnnotations } from './src/lib/satteri/satteriEngineeringAnnotations.ts';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

export default defineConfig({
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
