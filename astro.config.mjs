import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// Set SITE_URL in your host settings once you know your public address.
export default defineConfig({
 site: process.env.SITE_URL || 'https://example.com',
 base: process.env.BASE_PATH || '/',
 trailingSlash: 'always',
 output: 'static',
 integrations: [mdx(), ...(process.env.SITE_URL ? [sitemap()] : [])],
 markdown: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex], shikiConfig: { theme: 'github-dark' } },
});
