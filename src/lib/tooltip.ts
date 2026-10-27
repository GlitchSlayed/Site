// Global, lightweight, high-performance customizable tooltip engine.
// Uses event delegation, smart viewport collision detection, warm transitions,
// keyboard accessibility, and automatic external link domain detection.

export interface TooltipOptions {
  /** Delay before opening tooltip on hover (default: 150ms) */
  hoverDelay?: number;
  /** Grace window where moving to adjacent tooltips opens instantly (default: 300ms) */
  warmDelay?: number;
  /** Offset distance from target element in pixels (default: 8px) */
  offset?: number;
}

type Position = 'top' | 'bottom' | 'left' | 'right';

interface ActiveTooltipData {
  title: string;
  subtitle?: string;
  shortcut?: string;
  position: Position;
  target: HTMLElement;
}

let overlay: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let subtitleEl: HTMLElement | null = null;
let shortcutEl: HTMLElement | null = null;
let arrowEl: HTMLElement | null = null;

let activeTarget: HTMLElement | null = null;
let showTimer: any = null;
let warmTimer: any = null;
let isWarm = false;
let isInitialized = false;

function createOverlay(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'site-tooltip';
  el.className = 'site-tooltip';
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');

  el.innerHTML = `
    <div class="site-tooltip-header">
      <span class="site-tooltip-title"></span>
      <kbd class="site-tooltip-shortcut" style="display:none"></kbd>
    </div>
    <span class="site-tooltip-subtitle" style="display:none"></span>
    <div class="site-tooltip-arrow"></div>
  `;

  document.body.appendChild(el);

  titleEl = el.querySelector('.site-tooltip-title');
  shortcutEl = el.querySelector('.site-tooltip-shortcut');
  subtitleEl = el.querySelector('.site-tooltip-subtitle');
  arrowEl = el.querySelector('.site-tooltip-arrow');

  return el;
}

function getTooltipData(target: HTMLElement): ActiveTooltipData | null {
  // If target has a native title, intercept it to prevent double tooltips
  if (target.hasAttribute('title') && target.getAttribute('title')?.trim()) {
    const rawTitle = target.getAttribute('title')!.trim();
    target.setAttribute('data-tooltip', rawTitle);
    target.removeAttribute('title');
  }

  let text = target.getAttribute('data-tooltip')?.trim();
  let subtitle = target.getAttribute('data-tooltip-subtitle')?.trim();
  const shortcut = target.getAttribute('data-tooltip-shortcut')?.trim();
  const position = (target.getAttribute('data-tooltip-pos') || 'top') as Position;

  // Auto-detect external links if data-tooltip wasn't explicitly set
  if (!text && target.tagName === 'A') {
    const href = target.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      try {
        const url = new URL(href, window.location.href);
        const currentHost = window.location.hostname;
        if (url.hostname !== currentHost && url.hostname !== 'localhost') {
          text = `${url.hostname.replace(/^www\./, '')} ↗`;
          subtitle = 'External link';
        }
      } catch {
        // invalid URL, ignore
      }
    }
  }

  if (!text) return null;

  return {
    title: text,
    subtitle: subtitle || undefined,
    shortcut: shortcut || undefined,
    position,
    target,
  };
}

function positionTooltip(target: HTMLElement, preferredPos: Position) {
  if (!overlay || !arrowEl) return;

  const targetRect = target.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;
  const offset = 8;

  let pos = preferredPos;

  // Viewport collision checks and auto-flipping
  if (pos === 'top' && targetRect.top - overlayRect.height - offset < margin) {
    pos = 'bottom';
  } else if (pos === 'bottom' && targetRect.bottom + overlayRect.height + offset > viewportHeight - margin) {
    pos = 'top';
  } else if (pos === 'left' && targetRect.left - overlayRect.width - offset < margin) {
    pos = 'right';
  } else if (pos === 'right' && targetRect.right + overlayRect.width + offset > viewportWidth - margin) {
    pos = 'left';
  }

  let top = 0;
  let left = 0;

  if (pos === 'top') {
    top = targetRect.top - overlayRect.height - offset;
    left = targetRect.left + (targetRect.width - overlayRect.width) / 2;
  } else if (pos === 'bottom') {
    top = targetRect.bottom + offset;
    left = targetRect.left + (targetRect.width - overlayRect.width) / 2;
  } else if (pos === 'left') {
    top = targetRect.top + (targetRect.height - overlayRect.height) / 2;
    left = targetRect.left - overlayRect.width - offset;
  } else if (pos === 'right') {
    top = targetRect.top + (targetRect.height - overlayRect.height) / 2;
    left = targetRect.right + offset;
  }

  // Clamp horizontal position so tooltip never bleeds offscreen
  const clampedLeft = Math.max(margin, Math.min(viewportWidth - overlayRect.width - margin, left));
  const clampedTop = Math.max(margin, Math.min(viewportHeight - overlayRect.height - margin, top));

  overlay.style.top = `${Math.round(clampedTop)}px`;
  overlay.style.left = `${Math.round(clampedLeft)}px`;
  overlay.setAttribute('data-placement', pos);

  // Position arrow relative to trigger center
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const arrowX = targetCenterX - clampedLeft;

  if (pos === 'top' || pos === 'bottom') {
    const clampedArrowX = Math.max(12, Math.min(overlayRect.width - 12, arrowX));
    arrowEl.style.left = `${Math.round(clampedArrowX)}px`;
    arrowEl.style.top = '';
  } else {
    arrowEl.style.left = '';
    arrowEl.style.top = '50%';
  }
}

function show(data: ActiveTooltipData) {
  if (!overlay) overlay = createOverlay();

  activeTarget = data.target;

  if (titleEl) titleEl.textContent = data.title;

  if (shortcutEl) {
    if (data.shortcut) {
      shortcutEl.textContent = data.shortcut;
      shortcutEl.style.display = 'inline-block';
    } else {
      shortcutEl.style.display = 'none';
    }
  }

  if (subtitleEl) {
    if (data.subtitle) {
      subtitleEl.textContent = data.subtitle;
      subtitleEl.style.display = 'block';
    } else {
      subtitleEl.style.display = 'none';
    }
  }

  // Pre-render to measure layout
  overlay.style.visibility = 'hidden';
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');

  positionTooltip(data.target, data.position);

  overlay.style.visibility = 'visible';
  data.target.setAttribute('aria-describedby', 'site-tooltip');

  // Mark warm transition state
  isWarm = true;
  if (warmTimer) clearTimeout(warmTimer);
}

function hide() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }

  if (activeTarget) {
    activeTarget.removeAttribute('aria-describedby');
    activeTarget = null;
  }

  if (overlay) {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // Warm grace period: keep isWarm true for 300ms so moving to another item is instant
  if (warmTimer) clearTimeout(warmTimer);
  warmTimer = setTimeout(() => {
    isWarm = false;
  }, 300);
}

function findTrigger(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    '[data-tooltip], [data-tooltip-content], [title], a[href^="http://"], a[href^="https://"]',
  );
}

export function initTooltips(options: TooltipOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {};
  if (isInitialized) return () => {};
  isInitialized = true;

  const hoverDelay = options.hoverDelay ?? 150;

  const handlePointerOver = (e: PointerEvent) => {
    // Ignore touch interactions (tooltips on touch can obstruct interaction)
    if (e.pointerType === 'touch') return;

    const trigger = findTrigger(e.target);
    if (!trigger) {
      hide();
      return;
    }

    if (trigger === activeTarget) return;

    const data = getTooltipData(trigger);
    if (!data) {
      hide();
      return;
    }

    if (showTimer) clearTimeout(showTimer);

    if (isWarm) {
      // Instant transition between adjacent tooltips
      show(data);
    } else {
      showTimer = setTimeout(() => {
        show(data);
      }, hoverDelay);
    }
  };

  const handlePointerOut = (e: PointerEvent) => {
    const trigger = findTrigger(e.target);
    const related = findTrigger(e.relatedTarget);
    if (trigger && trigger !== related) {
      hide();
    }
  };

  const handleFocusIn = (e: FocusEvent) => {
    const trigger = findTrigger(e.target);
    if (!trigger) return;
    const data = getTooltipData(trigger);
    if (data) show(data);
  };

  const handleFocusOut = (e: FocusEvent) => {
    const trigger = findTrigger(e.target);
    if (trigger) hide();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  const handleScrollOrClick = () => {
    hide();
  };

  document.addEventListener('pointerover', handlePointerOver, { passive: true });
  document.addEventListener('pointerout', handlePointerOut, { passive: true });
  document.addEventListener('focusin', handleFocusIn, { passive: true });
  document.addEventListener('focusout', handleFocusOut, { passive: true });
  document.addEventListener('keydown', handleKeyDown, { passive: true });
  document.addEventListener('scroll', handleScrollOrClick, { passive: true, capture: true });
  document.addEventListener('pointerdown', handleScrollOrClick, { passive: true });

  return () => {
    document.removeEventListener('pointerover', handlePointerOver);
    document.removeEventListener('pointerout', handlePointerOut);
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('scroll', handleScrollOrClick, true);
    document.removeEventListener('pointerdown', handleScrollOrClick);
    hide();
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
    isInitialized = false;
  };
}
