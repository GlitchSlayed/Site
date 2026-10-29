import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeEngineeringAnnotations from './src/lib/rehype/rehypeEngineeringAnnotations';
import react from '@astrojs/react';
import pagefind from 'astro-pagefind';

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  output: 'static',
  compressHTML: true,

  integrations: [
    mdx(),
    ...(process.env.SITE_URL ? [sitemap()] : []),
    react(),
    pagefind(),
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