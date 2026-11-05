const GISCUS_ORIGIN = 'https://giscus.app';
/** One owner for Giscus loading, retry, status and theme synchronization. */
export function initComments() {
  const section = document.querySelector<HTMLElement>('[data-comments]');
  if (!section || section.dataset.initialized) return;
  section.dataset.initialized = 'true';
  const host = section.querySelector<HTMLElement>('[data-comments-host]')!;
  const status = section.querySelector<HTMLElement>('[data-comments-status]')!;
  const button = section.querySelector<HTMLButtonElement>('[data-comments-load]')!;
  const link = section.querySelector<HTMLAnchorElement>('[data-discussion-link]')!;
  let loading = false;
  let ready = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let loader: HTMLScriptElement | undefined;
  const frame = () => host.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
  function theme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    // Custom themes must be publicly reachable; previews use the built-in equivalents.
    if (['localhost', '127.0.0.1'].includes(location.hostname)) return dark ? 'dark_dimmed' : 'light';
    return (dark ? section!.dataset.darkTheme : section!.dataset.lightTheme)!;
  }
  function syncTheme() {
    loader?.setAttribute('data-theme', theme());
    frame()?.contentWindow?.postMessage({ giscus: { setConfig: { theme: theme() } } }, GISCUS_ORIGIN);
  }
  function fail() {
    ready = false;
    clearTimeout(timeout);
    loading = false;
    status.textContent = 'The discussion could not load. Retry here or open it on GitHub.';
    button.textContent = 'Retry discussion';
    button.hidden = false;
    button.disabled = false;
  }
  function load() {
    if (loading || ready) return;
    loading = true;
    button.hidden = true;
    status.textContent = 'Loading discussion…';
    host.replaceChildren();
    loader = document.createElement('script');
    loader.src = `${GISCUS_ORIGIN}/client.js`;
    loader.async = true;
    loader.crossOrigin = 'anonymous';
    const attributes = {
      repo: 'GlitchSlayed/Site', 'repo-id': 'R_kgDOVWOW8Q',
      category: 'General', 'category-id': 'DIC_kwDOVWOW8c4DJjhG',
      mapping: section!.dataset.mapping || 'title', term: section!.dataset.term || '',
      strict: '0', 'reactions-enabled': '1', 'emit-metadata': '1',
      'input-position': 'top', theme: theme(), lang: 'en',
    };
    Object.entries(attributes).forEach(([key, value]) => loader!.setAttribute(`data-${key}`, value));
    loader.addEventListener('error', fail, { once: true });
    host.append(loader);
    clearTimeout(timeout);
    timeout = setTimeout(fail, 20000);
  }
  function receive(event: MessageEvent) {
    if (event.origin !== GISCUS_ORIGIN || !frame()?.contentWindow || event.source !== frame()!.contentWindow) return;
    const message = event.data?.giscus;
    if (!message || typeof message !== 'object') return;
    if (message.error && !String(message.error).toLowerCase().includes('discussion not found')) { fail(); return; }
    if ('resizeHeight' in message || 'discussion' in message) {
      clearTimeout(timeout);
      ready = true;
      loading = false;
      button.hidden = true;
      status.textContent = '';
    }
    if (message.discussion?.url) {
      try {
        const target = new URL(message.discussion.url);
        if (target.origin === 'https://github.com' && target.pathname.startsWith('/GlitchSlayed/Site/discussions/')) link.href = target.href;
      } catch { /* Unrecognized metadata never changes the fallback link. */ }
    }
  }
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const near = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { near.disconnect(); load(); }
  }, { rootMargin: '200px' });
  near.observe(section);
  button.hidden = false;
  button.addEventListener('click', load);
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    clearTimeout(timeout);
    near.disconnect();
    themeObserver.disconnect();
    window.removeEventListener('message', receive);
  });
}
