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
  const safeTitle = escapeXml(title);
  const homeTitle = home
    ? `<text x="600" y="330" text-anchor="middle" class="home-title">${safeTitle}</text>
       <rect x="562" y="376" width="76" height="5" rx="2.5" fill="#ff603b"/>`
    : (() => {
        const fontSize = title.length < 25 ? 68 : title.length < 45 ? 58 : 48;
        const maxCharacters = Math.floor(1024 / (fontSize * 0.58));
        const lines = wrapTitle(title, maxCharacters);
        const lineHeight = Math.round(fontSize * 1.22);
        const startY = Math.round(310 - ((lines.length - 1) * lineHeight) / 2);
        const titleLines = lines.map((line, index) =>
          `<text x="88" y="${startY + index * lineHeight}" class="page-title" font-size="${fontSize}px">${escapeXml(line)}</text>`
        ).join('\n');
        return `<text x="88" y="215" class="section">${escapeXml(section)}</text>
          ${titleLines}
          <rect x="88" y="485" width="66" height="5" rx="2.5" fill="#ff603b"/>`;
      })();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="warm" cx="84%" cy="18%" r="76%">
        <stop offset="0" stop-color="#b84228" stop-opacity=".38"/>
        <stop offset="1" stop-color="#b84228" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cool" cx="8%" cy="94%" r="62%">
        <stop offset="0" stop-color="#385a83" stop-opacity=".28"/>
        <stop offset="1" stop-color="#385a83" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#0a0a0a"/>
        <stop offset="1" stop-color="#101014"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#fade)"/>
    <rect width="1200" height="630" fill="url(#warm)"/>
    <rect width="1200" height="630" fill="url(#cool)"/>
    ${homeTitle}
    ${home ? '' : `<text x="88" y="80" class="brand">VANSH'S TECHNICAL BLOG</text>`}
    <style>
      text { font-family: Arial, Helvetica, sans-serif; }
      .brand { fill: #c3c3ca; font-size: 19px; font-weight: 600; letter-spacing: 1.4px; }
      .section { fill: #ff805f; font: 600 15px Arial, Helvetica, sans-serif; letter-spacing: 3px; }
      .page-title { fill: #f2f2f3; font-family: Arial, Helvetica, sans-serif; font-weight: 500; }
      .home-title { fill: #f2f2f3; font-family: Arial, Helvetica, sans-serif; font-size: 74px; font-weight: 500; }
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
