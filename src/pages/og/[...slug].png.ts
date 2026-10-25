import sharp from 'sharp';
import { getCollection } from 'astro:content';

type Card = {
  title: string;
  section?: string;
  home?: boolean;
};

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

function wrapTitle(title: string, maxCharacters: number) {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function cardSvg({ title, section = 'PAGE', home = false }: Card) {
  const homeTitle = home
    ? `<text x="600" y="294" text-anchor="middle" class="home-title">VANSH'S</text>
       <text x="600" y="390" text-anchor="middle" class="home-title">TECHNICAL BLOG</text>`
    : (() => {
        const fontSize = title.length < 25 ? 76 : title.length < 52 ? 64 : 54;
        const maxCharacters = Math.floor(1024 / (fontSize * 0.63));
        const lines = wrapTitle(title.toLocaleUpperCase('en-US'), maxCharacters);
        const lineHeight = Math.round(fontSize * 1.25);
        const startY = Math.round(330 - ((lines.length - 1) * lineHeight) / 2);
        const titleLines = lines.map((line, index) =>
          `<text x="88" y="${startY + index * lineHeight}" class="page-title" font-size="${fontSize}px">${escapeXml(line)}</text>`
        ).join('\n');
        return `<text x="88" y="190" class="section">${escapeXml(section)}</text>
          ${titleLines}
          `;
      })();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="warm" cx="84%" cy="18%" r="76%">
        <stop offset="0" stop-color="#8c3223" stop-opacity=".3"/>
        <stop offset="1" stop-color="#b84228" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cool" cx="8%" cy="94%" r="62%">
        <stop offset="0" stop-color="#304d6e" stop-opacity=".2"/>
        <stop offset="1" stop-color="#385a83" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#08090c"/>
        <stop offset="1" stop-color="#0c0d11"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#fade)"/>
    <rect width="1200" height="630" fill="url(#warm)"/>
    <rect width="1200" height="630" fill="url(#cool)"/>
    ${homeTitle}
    ${home ? '' : `<text x="88" y="80" class="brand">VANSH'S TECHNICAL BLOG</text>`}
    <style>
      text { font-family: Arial, Helvetica, sans-serif; }
      .brand { fill: #c3c3ca; font-size: 19px; font-weight: 600; letter-spacing: 1.8px; }
      .section { fill: #ff805f; font: 600 15px Arial, Helvetica, sans-serif; letter-spacing: 3px; }
      .page-title { fill: #f2f2f3; font-family: Arial, Helvetica, sans-serif; font-weight: 650; letter-spacing: 2px; }
      .home-title { fill: #f2f2f3; font-family: Arial, Helvetica, sans-serif; font-size: 82px; font-weight: 650; letter-spacing: 4px; }
    </style>
  </svg>`;
}

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
      card: { title: entry.data.title, section: 'ARTICLE' },
    })),
    ...projects.map((entry) => ({
      slug: `projects/${entry.id}`,
      card: { title: entry.data.title, section: 'PROJECT' },
    })),
  ];

  return cards.map(({ slug, card }) => ({ params: { slug }, props: card }));
}

export async function GET({ props }: { props: Card }) {
  const png = await sharp(Buffer.from(cardSvg(props))).png({ compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
