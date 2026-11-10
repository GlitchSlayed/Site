import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { markdownToHtml } from 'satteri';
import { site, url } from '../config';

export async function GET(context: APIContext) {
  const posts = (
    await getCollection('writing', ({ data }) => !data.draft && !data.sample)
  ).sort((a, b) => +b.data.date - +a.data.date);

  const siteUrl = context.site
    ? new URL(import.meta.env.BASE_URL, context.site).href
    : 'https://glitchslayed.github.io/Site/';

  const items = posts.map((p) => {
    const rendered = p.body ? markdownToHtml(p.body) : null;
    return {
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.updated || p.data.date,
      link: url(`writing/${p.id}/`),
      content: rendered?.html || p.data.description,
      categories: p.data.tags,
    };
  });

  return rss({
    title: site.title,
    description: site.description,
    site: siteUrl,
    items,
  });
}
