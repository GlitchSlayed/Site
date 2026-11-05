/** Progressive enhancement: keep the original article nodes and hydrated islands. */
export function initReader() {
  const reader = document.querySelector<HTMLElement>('#reader');
  const body = document.querySelector<HTMLElement>('#story-body');
  if (!reader || !body || reader.dataset.ready) return;
  reader.dataset.ready = 'true';
  const pagination = reader.querySelector<HTMLElement>('.reader-pagination')!;
  const prev = reader.querySelector<HTMLButtonElement>('#reader-prev')!;
  const next = reader.querySelector<HTMLButtonElement>('#reader-next')!;
  const position = reader.querySelector<HTMLElement>('#reader-position')!;
  const modeButtons = [...reader.querySelectorAll<HTMLButtonElement>('.reader-modes button')];
  const small = reader.querySelector<HTMLButtonElement>('#type-down')!;
  const large = reader.querySelector<HTMLButtonElement>('#type-up')!;
  const toolbar = reader.querySelector<HTMLElement>('.reader-toolbar')!;
  const header = document.querySelector<HTMLElement>('.header');
  const media = window.matchMedia('(min-width: 1000px)');
  let mode = 'continuous';
  let spread = 0;
  let size = 18;
  try {
    mode = localStorage.getItem('notebook-layout') === 'spread' ? 'spread' : 'continuous';
    size = Math.max(16, Math.min(24, Number(localStorage.getItem('notebook-size')) || 18));
  } catch { /* Storage is optional in private/embedded browsers. */ }

  const pages: HTMLElement[] = [];
  function newPage() {
    const page = document.createElement('section');
    page.className = 'story-page';
    page.setAttribute('aria-label', `Article section ${pages.length + 1}`);
    pages.push(page);
    return page;
  }
  let page = newPage();
  for (const node of [...body.childNodes]) {
    if (node instanceof HTMLElement && node.tagName === 'H2' && page.textContent?.trim()) page = newPage();
    page.append(node);
  }
  body.append(...pages);
  const blocks = pages.flatMap(p => [...p.children].filter((node): node is HTMLElement => node instanceof HTMLElement));
  let anchor: HTMLElement | undefined;

  function rememberPosition() {
    const top = Math.max(header?.getBoundingClientRect().bottom ?? 0, toolbar.getBoundingClientRect().bottom);
    const bounds = body!.getBoundingClientRect();
    anchor = bounds.top <= top && bounds.bottom > top
      ? blocks.find(node => !node.closest('[hidden]') && node.getBoundingClientRect().bottom > top)
      : undefined;
  }
  function apply() {
    const facing = media.matches && mode === 'spread';
    reader!.dataset.mode = facing ? 'spread' : 'continuous';
    pages.forEach((p, i) => {
      if (facing && Math.floor(i / 2) !== spread) p.setAttribute('hidden', 'until-found');
      else p.removeAttribute('hidden');
    });
    pagination.hidden = !facing;
    prev.disabled = spread === 0;
    next.disabled = spread >= Math.ceil(pages.length / 2) - 1;
    position.textContent = `Pages ${spread * 2 + 1}–${Math.min(spread * 2 + 2, pages.length)} of ${pages.length}`;
    modeButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === (facing ? 'spread' : 'continuous')));
      button.disabled = button.dataset.mode === 'spread' && !media.matches;
    });
    reader!.style.setProperty('--reader-size', `${size}px`);
    small.disabled = size <= 16;
    large.disabled = size >= 24;
  }
  function reflow() {
    const target = anchor;
    if (target) spread = Math.floor(pages.findIndex(p => p.contains(target)) / 2);
    apply();
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function measure() {
    reader!.style.setProperty('--site-header-height', `${header?.getBoundingClientRect().height ?? 0}px`);
    reader!.style.setProperty('--reader-toolbar-height', `${toolbar.getBoundingClientRect().height}px`);
  }
  const resize = new ResizeObserver(measure);
  if (header) resize.observe(header);
  resize.observe(toolbar);
  measure();
  window.addEventListener('scroll', rememberPosition, { passive: true });
  window.addEventListener('pagehide', event => { if (!event.persisted) resize.disconnect(); });
  media.addEventListener('change', reflow);
  pages.forEach((p, i) => p.addEventListener('beforematch', () => {
    spread = Math.floor(i / 2);
    apply();
  }));
  // Switch before the browser opens Find. Menu Find uses beforematch where supported.
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      rememberPosition();
      mode = 'continuous';
      reflow();
    }
  });
  modeButtons.forEach(button => button.addEventListener('click', () => {
    rememberPosition();
    mode = button.dataset.mode!;
    try { localStorage.setItem('notebook-layout', mode); } catch {}
    reflow();
  }));
  function turn(delta: number) {
    spread = Math.max(0, Math.min(Math.ceil(pages.length / 2) - 1, spread + delta));
    apply();
    body!.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  // Arrow keys act only inside the pager, never inside a chart or input.
  pagination.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turn(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  function resizeType(delta: number) {
    rememberPosition();
    size = Math.max(16, Math.min(24, size + delta));
    try { localStorage.setItem('notebook-size', String(size)); } catch {}
    reflow();
  }
  small.addEventListener('click', () => resizeType(-1));
  large.addEventListener('click', () => resizeType(1));
  reader.querySelector('#print-story')?.addEventListener('click', () => window.print());
  function reveal(hash: string, scroll: boolean) {
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const index = pages.findIndex(p => p.contains(target));
    if (index < 0) return;
    spread = Math.floor(index / 2);
    apply();
    if (scroll) target?.scrollIntoView();
  }
  reader.querySelectorAll<HTMLAnchorElement>('.reader-contents a').forEach(link => {
    link.addEventListener('click', () => reveal(link.hash, false));
  });
  window.addEventListener('hashchange', () => reveal(location.hash, true));
  const copy = reader.querySelector<HTMLButtonElement>('#copy-story')!;
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    const status = reader.querySelector('#copy-status')!;
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      status.textContent = 'Link copied.';
    } catch { status.textContent = 'Copy the URL from your address bar.'; }
  });
  reader.querySelector<HTMLElement>('.reader-enhancements')!.hidden = false;
  apply();
  reveal(location.hash, true);
}
