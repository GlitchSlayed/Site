import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeEngineeringAnnotations from './src/lib/rehype/rehypeEngineeringAnnotations.ts';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

export default defineConfig({
  site: process.env.SITE_URL || 'https://glitchslayed.github.io',
  base: process.env.BASE_PATH || '/Site/',
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/og/'),
    }),
    react(),
    pagefind(),
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
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, rehypeEngineeringAnnotations],
    }),
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
