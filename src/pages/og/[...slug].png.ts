import sharp from 'sharp';
import { getCollection } from 'astro:content';

import { socialCardSvg, type SocialCard as Card } from '../../lib/socialCard';

export async function getStaticPaths() {
  const writing = await getCollection('writing', ({ data }) => !data.draft);
  const projects = await getCollection('projects', ({ data }) => !data.draft);

  const cards: Array<{ slug: string; card: Card }> = [
    { slug: 'home', card: { title: "Vansh's Technical Blog", home: true } },
    { slug: 'about', card: { title: 'About Vansh', section: 'ABOUT' } },
    { slug: 'writing', card: { title: 'Writing', section: 'THE NOTEBOOK' } },
    { slug: 'projects', card: { title: 'Projects', section: 'THE WORK' } },
    { slug: '404', card: { title: 'Page not found', section: '404' } },
    ...writing.map((entry) => ({
      slug: `writing/${entry.id}`,
      card: { title: entry.data.title, section: 'ARTICLE', drawing: entry.data.tags.some(tag => /linux|fedora|rust|software|gnome/i.test(tag)) ? 'code' as const : 'wing' as const },
    })),
    ...projects.map((entry) => ({
      slug: `projects/${entry.id}`,
      card: { title: entry.data.title, section: 'PROJECT', drawing: entry.data.drawing || entry.data.art },
    })),
  ];

  return cards.map(({ slug, card }) => ({ params: { slug }, props: card }));
}

export async function GET({ props }: { props: Card }) {
  const png = await sharp(Buffer.from(socialCardSvg(props))).png({ compressionLevel: 7 }).toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
