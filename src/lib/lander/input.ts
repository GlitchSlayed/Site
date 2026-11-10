/**
 * Robust input manager for LanderGame.
 * Handles keyboard, pointer events (multi-touch with pointer capture),
 * focus guards, modal guards, and auto-clearing stuck inputs.
 */

export interface InputState {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  isGameActive: boolean;
}

export interface InputManagerOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  btnLeft: HTMLElement | null;
  btnRight: HTMLElement | null;
  btnThrust: HTMLElement | null;
  onReset?: () => void;
  onToggleAudio?: () => void;
  onToggleSas?: () => void;
  onAction?: () => void;
  signal: AbortSignal;
}

export function shouldIgnoreKeyEvent(
  e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return true;
  }
  const target = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

export class InputManager {
  private thrustKeys = new Set<string>();
  private leftKeys = new Set<string>();
  private rightKeys = new Set<string>();
  private pointerThrust = false;
  private pointerLeft = false;
  private pointerRight = false;
  private gameActive = false;

  constructor(private options: InputManagerOptions) {
    this.setupListeners();
  }

  public getInput(): { thrust: boolean; rotateLeft: boolean; rotateRight: boolean } {
    return {
      thrust: this.pointerThrust || this.thrustKeys.size > 0,
      rotateLeft: this.pointerLeft || this.leftKeys.size > 0,
      rotateRight: this.pointerRight || this.rightKeys.size > 0,
    };
  }

  public get isGameActive(): boolean {
    return this.gameActive;
  }

  public setGameActive(active: boolean): void {
    this.gameActive = active;
    if (!active) {
      this.clearAll();
    }
  }

  public clearAll(): void {
    this.thrustKeys.clear();
    this.leftKeys.clear();
    this.rightKeys.clear();
    this.pointerThrust = false;
    this.pointerLeft = false;
    this.pointerRight = false;
  }

  private setupListeners(): void {
    const { container, canvas, btnLeft, btnRight, btnThrust, signal } = this.options;

    // Window focus / visibility blur: clear all held inputs immediately
    window.addEventListener(
      'blur',
      () => {
        this.clearAll();
      },
      { signal }
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.clearAll();
        }
      },
      { signal }
    );

    // Canvas click activates game focus
    canvas.addEventListener(
      'click',
      () => {
        this.gameActive = true;
        this.options.onAction?.();
        canvas.focus();
      },
      { signal }
    );

    // Canvas blur: clear keyboard inputs
    canvas.addEventListener(
      'blur',
      () => {
        this.thrustKeys.clear();
        this.leftKeys.clear();
        this.rightKeys.clear();
      },
      { signal }
    );

    // Keyboard handlers
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (shouldIgnoreKeyEvent(e)) return;

        const key = e.key.toLowerCase();
        const target = e.target as HTMLElement | null;
        const targetIsButton = target?.tagName?.toLowerCase() === 'button';

        // Check shortcuts
        if (key === 'r') {
          this.options.onReset?.();
          return;
        }
        if (key === 'm') {
          this.options.onToggleAudio?.();
          return;
        }
        if (key === 's') {
          this.options.onToggleSas?.();
          return;
        }

        const isGameKey = [
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'w',
          'a',
          's',
          'd',
          ' ',
        ].includes(key);

        if (!isGameKey) return;

        // Prevent page scroll only if game is focused/active
        const isGameFocused =
          document.activeElement === canvas ||
          container.contains(document.activeElement);

        if (isGameFocused && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          e.preventDefault();
        }

        // Special Space handling: if space is pressed on a button, let the button handle it
        if (key === ' ' || e.code === 'Space') {
          if (targetIsButton) {
            return;
          }
          if (isGameFocused) {
            e.preventDefault();
          }
        }

        this.gameActive = true;
        this.options.onAction?.();

        if (key === 'arrowup' || key === 'w' || key === ' ') {
          this.thrustKeys.add(key);
        }
        if (key === 'arrowleft' || key === 'a') {
          this.leftKeys.add(key);
        }
        if (key === 'arrowright' || key === 'd') {
          this.rightKeys.add(key);
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        this.thrustKeys.delete(key);
        this.leftKeys.delete(key);
        this.rightKeys.delete(key);
      },
      { signal }
    );

    // Pointer events for on-screen touch/mouse buttons
    this.bindPointer(
      btnLeft,
      () => {
        this.gameActive = true;
        this.options.onAction?.();
        this.pointerLeft = true;
      },
      () => {
        this.pointerLeft = false;
      },
      signal
    );

    this.bindPointer(
      btnRight,
      () => {
        this.gameActive = true;
        this.options.onAction?.();
        this.pointerRight = true;
      },
      () => {
        this.pointerRight = false;
      },
      signal
    );

    this.bindPointer(
      btnThrust,
      () => {
        this.gameActive = true;
        this.options.onAction?.();
        this.pointerThrust = true;
      },
      () => {
        this.pointerThrust = false;
      },
      signal
    );
  }

  private bindPointer(
    btn: HTMLElement | null,
    onDown: () => void,
    onUp: () => void,
    signal: AbortSignal
  ): void {
    if (!btn) return;

    const down = (e: PointerEvent) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      onDown();
    };

    const up = (e: PointerEvent) => {
      e.preventDefault();
      try {
        if (btn.hasPointerCapture(e.pointerId)) {
          btn.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe fallback
      }
      onUp();
    };

    btn.addEventListener('pointerdown', down, { signal });
    btn.addEventListener('pointerup', up, { signal });
    btn.addEventListener('pointercancel', up, { signal });
    btn.addEventListener('pointerleave', up, { signal });
  }
}
