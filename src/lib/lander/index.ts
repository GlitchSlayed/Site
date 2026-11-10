/**
 * Primary wiring and game loop for LanderGame.
 * Manages fixed 60Hz physics accumulator, state transitions, scoring,
 * DOM banner updates without innerHTML, visibility pauses, and clean resource destruction.
 */

import { AudioManager } from './audio';
import { InputManager } from './input';
import {
  DEFAULT_PHYSICS_CONFIG,
  type GameConfig,
  type LandingEvaluation,
  type PadConfig,
  type ShipState,
  createTerrain,
  step,
  updatePhysicsAccumulator,
} from './physics';
import { LanderRenderer, type VisualParticle } from './render';

export interface LanderGameOptions {
  wrapper: HTMLElement;
  canvas: HTMLCanvasElement;
  banner: HTMLElement | null;
  scoreChip: HTMLElement | null;
  recoveriesEl: HTMLElement | null;
  resetBtn: HTMLElement | null;
  audioToggle: HTMLElement | null;
  audioLabel: HTMLElement | null;
  sasToggle: HTMLElement | null;
  sasLabel: HTMLElement | null;
  btnLeft: HTMLElement | null;
  btnRight: HTMLElement | null;
  btnThrust: HTMLElement | null;
}

export class LanderGame {
  private abortController = new AbortController();
  private renderer!: LanderRenderer;
  private input!: InputManager;
  private audio!: AudioManager;
  private ctx!: CanvasRenderingContext2D;

  private config!: GameConfig;
  private ship!: ShipState;
  private particles: VisualParticle[] = [];

  private isReady = true;
  private isPaused = false;
  private sasEnabled = true;
  private reducedMotion = false;

  private round = 1;
  private consecutiveFailures = 0;
  private recoveries = 0;
  private streak = 0;
  private sessionBest = 0;
  private allTimeBest = 0;

  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private physicsAccumulator = 0;
  private beaconTick = 0;
  private isOffscreen = false;

  constructor(private options: LanderGameOptions) {
    const ctx = options.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;

    const signal = this.abortController.signal;
    this.audio = new AudioManager();
    this.renderer = new LanderRenderer(options.canvas, options.wrapper, signal);

    this.input = new InputManager({
      container: options.wrapper,
      canvas: options.canvas,
      btnLeft: options.btnLeft,
      btnRight: options.btnRight,
      btnThrust: options.btnThrust,
      onReset: () => this.reset(true),
      onToggleAudio: () => this.toggleAudio(),
      onToggleSas: () => this.toggleSas(),
      onAction: () => this.onPlayerAction(),
      signal,
    });

    options.resetBtn?.addEventListener('click', () => this.reset(true), { signal });
    options.audioToggle?.addEventListener('click', () => this.toggleAudio(), { signal });
    options.sasToggle?.addEventListener('click', () => this.toggleSas(), { signal });

    this.allTimeBest = this.loadAllTimeBest();
    this.checkReducedMotion(signal);
    this.setupIntersectionObserver(signal);
    this.setupPageLifecycle(signal);
    this.updateControlsUI();
    this.updateScoreUI();

    this.reset(false);
    this.startLoop();
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.audio.destroy();
    this.abortController.abort();
  }

  private onPlayerAction(): void {
    if (this.isReady) {
      this.isReady = false;
      this.lastTimestamp = performance.now();
      this.startLoop();
    }
  }

  private reset(startImmediately = false): void {
    // Variety: calculate pad parameters based on current round progression
    // Pad width shrinks slightly after success down to minimum 95px
    const padWidth = Math.max(95, 155 - (this.round - 1) * 12);

    // Randomize pad x safely within reachable view
    const minX = 140;
    const maxX = 640 - padWidth - 80;
    const padX = Math.round(minX + Math.random() * (maxX - minX));
    const pad: PadConfig = { x: padX, y: 285, width: padWidth };

    // Wind from round 4 onwards (light breeze)
    let wind = 0;
    if (this.round >= 4) {
      wind = (Math.random() - 0.5) * 0.005;
    }

    this.config = {
      ...DEFAULT_PHYSICS_CONFIG,
      pad,
      terrain: createTerrain(pad),
      wind,
    };

    // Starting position: gentler initial drift
    const startX = Math.min(pad.x - 60, Math.max(80, pad.x - 120 + Math.random() * 40));
    this.ship = {
      x: startX,
      y: 45 + Math.random() * 20,
      vx: 0.2 + Math.random() * 0.2,
      vy: 0.05,
      angle: 0,
      fuel: 100,
      state: 'flying',
    };

    this.particles = [];
    this.physicsAccumulator = 0;
    this.isReady = !startImmediately;
    this.audio.silenceContinuous();
    this.hideBanner();
    this.lastTimestamp = performance.now();

    this.startLoop();
  }

  private toggleAudio(): void {
    const enabled = this.audio.toggle();
    if (this.options.audioLabel) {
      this.options.audioLabel.textContent = `Sound: ${enabled ? 'On' : 'Off'}`;
    }
  }

  private toggleSas(): void {
    this.sasEnabled = !this.sasEnabled;
    this.updateControlsUI();
  }

  private updateControlsUI(): void {
    if (this.options.sasLabel) {
      this.options.sasLabel.textContent = this.sasEnabled ? 'ON' : 'OFF';
    }
    if (this.options.sasToggle) {
      if (this.sasEnabled) {
        this.options.sasToggle.classList.add('active');
      } else {
        this.options.sasToggle.classList.remove('active');
      }
    }
    if (this.options.audioLabel) {
      this.options.audioLabel.textContent = `Sound: ${this.audio.isEnabled() ? 'On' : 'Off'}`;
    }
  }

  private updateScoreUI(): void {
    if (this.options.recoveriesEl) {
      this.options.recoveriesEl.textContent = String(this.recoveries);
    }
    if (this.options.scoreChip) {
      // Clear children safely
      while (this.options.scoreChip.firstChild) {
        this.options.scoreChip.removeChild(this.options.scoreChip.firstChild);
      }

      const recText = document.createTextNode('RECOVERIES: ');
      const recStrong = document.createElement('strong');
      recStrong.textContent = String(this.recoveries);

      const streakText = document.createTextNode(' · STREAK: ');
      const streakStrong = document.createElement('strong');
      streakStrong.textContent = String(this.streak);

      const bestText = document.createTextNode(' · BEST: ');
      const bestStrong = document.createElement('strong');
      bestStrong.textContent = String(this.allTimeBest);

      this.options.scoreChip.append(recText, recStrong, streakText, streakStrong, bestText, bestStrong);
    }
  }

  private startLoop(): void {
    if (this.animationFrameId !== null) return;
    this.lastTimestamp = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private loop(now: number): void {
    // If game is offscreen or page hidden, pause and await resume
    if (this.isPaused || this.isOffscreen || document.hidden) {
      this.animationFrameId = null;
      this.audio.silenceContinuous();
      return;
    }

    const dtSeconds = Math.max(0, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    this.beaconTick++;

    // Only step physics if not in paused "READY" screen
    if (!this.isReady && this.ship.state === 'flying') {
      const controls = this.input.getInput();
      const landerInput = {
        thrust: controls.thrust,
        rotateLeft: controls.rotateLeft,
        rotateRight: controls.rotateRight,
        sas: this.sasEnabled,
      };

      // Audio feedback updates
      this.audio.setThrustActive(controls.thrust && this.ship.fuel > 0);
      this.audio.setRcsActive(controls.rotateLeft || controls.rotateRight);

      // Fixed 60Hz physics accumulator (max 5 steps per frame)
      const { steps, remainingAccumulator } = updatePhysicsAccumulator(
        this.physicsAccumulator,
        dtSeconds,
        1 / 60,
        5
      );
      this.physicsAccumulator = remainingAccumulator;

      for (let s = 0; s < steps; s++) {
        const prevState = this.ship.state;
        this.ship = step(this.ship, landerInput, this.config);

        // Spawn thruster exhaust particles
        if (landerInput.thrust && this.ship.fuel > 0 && !this.reducedMotion) {
          const exhaustAngle = this.ship.angle + Math.PI + (Math.random() - 0.5) * 0.3;
          const speed = 2.2 + Math.random() * 1.8;
          this.particles.push({
            x: this.ship.x,
            y: this.ship.y + 10,
            vx: Math.sin(exhaustAngle) * speed + this.ship.vx * 0.2,
            vy: -Math.cos(exhaustAngle) * speed + this.ship.vy * 0.2,
            life: 1,
            maxLife: 15 + Math.random() * 10,
            color: Math.random() > 0.4 ? '#E25835' : '#F5B041',
            size: 2.5,
          });
        }

        // State transition check
        if (prevState === 'flying' && this.ship.state !== 'flying') {
          this.handleFlightOutcome(this.ship.state, this.ship.lastEvaluation);
          break;
        }
      }
    } else {
      this.audio.silenceContinuous();
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life++;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Render frame
    this.renderer.render(this.ctx, this.config, {
      ship: this.ship,
      particles: this.particles,
      beaconTick: this.beaconTick,
      isReady: this.isReady,
      score: this.sessionBest,
      streak: this.streak,
      reducedMotion: this.reducedMotion,
      wind: this.config.wind,
    });

    // Idle cost optimization: if round has concluded and particles expired, stop rAF
    if (this.ship.state !== 'flying' && this.particles.length === 0) {
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private handleFlightOutcome(
    outcome: 'landed' | 'crashed',
    evalResult?: LandingEvaluation
  ): void {
    this.audio.silenceContinuous();

    if (outcome === 'landed') {
      this.audio.playTouchdown();
      this.recoveries++;
      this.streak++;
      this.round++;
      this.consecutiveFailures = 0;

      // Scoring calculation
      const fuelBonus = Math.round((evalResult?.fuelRemaining ?? 50) * 10);
      const softnessBonus = Math.max(
        0,
        Math.round((2.0 - (evalResult?.descentRate ?? 1.5)) * 150)
      );
      const roundScore = 500 + fuelBonus + softnessBonus;

      if (roundScore > this.sessionBest) this.sessionBest = roundScore;
      if (roundScore > this.allTimeBest) {
        this.allTimeBest = roundScore;
        this.saveAllTimeBest(this.allTimeBest);
      }

      this.updateScoreUI();

      // Celebration sparks (fewer if reduced motion)
      const count = this.reducedMotion ? 8 : 32;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.2 + Math.random() * 3.5;
        this.particles.push({
          x: this.ship.x,
          y: this.ship.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          maxLife: 35 + Math.random() * 20,
          color: Math.random() > 0.5 ? '#5CD068' : '#F5B041',
          size: 3,
        });
      }

      this.showLandingBanner(evalResult, roundScore);
    } else {
      this.audio.playCrash();
      this.streak = 0;
      this.consecutiveFailures++;

      // If failed 2 consecutive times, reset difficulty
      if (this.consecutiveFailures >= 2) {
        this.round = 1;
      }

      this.updateScoreUI();

      // Explosion debris
      const count = this.reducedMotion ? 6 : 28;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 3.5;
        this.particles.push({
          x: this.ship.x,
          y: this.ship.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          maxLife: 25 + Math.random() * 15,
          color: Math.random() > 0.5 ? '#B83E18' : '#747065',
          size: 2.5,
        });
      }

      this.showCrashBanner(evalResult);
    }
  }

  private showLandingBanner(evalResult: LandingEvaluation | undefined, score: number): void {
    const banner = this.options.banner;
    if (!banner) return;

    while (banner.firstChild) {
      banner.removeChild(banner.firstChild);
    }

    const card = document.createElement('div');
    card.className = 'banner-success';

    const title = document.createElement('strong');
    title.textContent = '✔ TOUCHDOWN NOMINAL!';

    const desc = document.createElement('p');
    desc.textContent = `Airframe secured on Target Pad 404 with ${Math.round(
      evalResult?.fuelRemaining ?? 0
    )}% fuel remaining. Score: +${score} PTS.`;

    const stats = document.createElement('div');
    stats.className = 'banner-stats';

    const statDescent = document.createElement('span');
    statDescent.textContent = `Descent: ${(evalResult?.descentRateMs ?? 0).toFixed(1)} m/s`;

    const statLateral = document.createElement('span');
    statLateral.textContent = `Lateral: ${(evalResult?.lateralRateMs ?? 0).toFixed(1)} m/s`;

    const statStreak = document.createElement('span');
    statStreak.textContent = `Streak: ${this.streak}`;

    stats.append(statDescent, statLateral, statStreak);

    const links = document.createElement('div');
    links.className = 'banner-links';

    const btnAgain = document.createElement('button');
    btnAgain.type = 'button';
    btnAgain.className = 'sim-retry-btn';
    btnAgain.textContent = '↺ Next Target (R)';
    btnAgain.addEventListener('click', () => this.reset(true));

    const homeLink = document.createElement('a');
    homeLink.href = this.options.canvas.dataset.home || '/Site/';
    homeLink.className = 'button primary';
    homeLink.textContent = 'Enter Flight Deck →';

    const writingLink = document.createElement('a');
    writingLink.href = this.options.canvas.dataset.writing || '/Site/writing/';
    writingLink.className = 'text-link';
    writingLink.textContent = 'Field Dispatches →';

    links.append(btnAgain, homeLink, writingLink);
    card.append(title, desc, stats, links);
    banner.append(card);
    banner.style.display = '';
    banner.hidden = false;
  }

  private showCrashBanner(evalResult?: LandingEvaluation): void {
    const banner = this.options.banner;
    if (!banner) return;

    while (banner.firstChild) {
      banner.removeChild(banner.firstChild);
    }

    const card = document.createElement('div');
    card.className = 'banner-fail';

    const title = document.createElement('strong');
    title.textContent = '⚠ TOUCHDOWN DEVIATION';

    let reasonText = 'Structural overload: Exceeded flight envelope.';
    if (evalResult?.reason === 'missed-pad') {
      reasonText = 'Missed Target Pad 404: Touched down on uneven lunar rock.';
    } else if (evalResult?.reason === 'hard-vertical') {
      reasonText = `Hard landing: Descent rate ${(evalResult.descentRateMs).toFixed(
        1
      )} m/s exceeded 8.0 m/s gear limit.`;
    } else if (evalResult?.reason === 'hard-lateral') {
      reasonText = `Lateral shear: Horizontal velocity ${(evalResult.lateralRateMs).toFixed(
        1
      )} m/s exceeded 5.2 m/s limit.`;
    } else if (evalResult?.reason === 'excessive-tilt') {
      reasonText = `Airframe rollover: Touchdown tilt (${Math.round(
        evalResult.tiltDeg
      )}°) exceeded 20° stability envelope.`;
    }

    const desc = document.createElement('p');
    desc.textContent = reasonText;

    const hint = document.createElement('div');
    hint.className = 'banner-hint';
    hint.textContent = 'Tip: Use short thrust bursts and let SAS auto-level your attitude.';

    const links = document.createElement('div');
    links.className = 'banner-links';

    const btnRetry = document.createElement('button');
    btnRetry.type = 'button';
    btnRetry.className = 'button primary';
    btnRetry.textContent = '↺ Recalibrate Vector (R)';
    btnRetry.addEventListener('click', () => this.reset(true));

    const homeLink = document.createElement('a');
    homeLink.href = this.options.canvas.dataset.home || '/Site/';
    homeLink.className = 'text-link';
    homeLink.textContent = 'Exit to Flight Deck →';

    links.append(btnRetry, homeLink);
    card.append(title, desc, hint, links);
    banner.append(card);
    banner.style.display = '';
    banner.hidden = false;
  }

  private hideBanner(): void {
    if (this.options.banner) {
      this.options.banner.style.display = 'none';
      this.options.banner.hidden = true;
      while (this.options.banner.firstChild) {
        this.options.banner.removeChild(this.options.banner.firstChild);
      }
    }
  }

  private checkReducedMotion(signal: AbortSignal): void {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = media.matches;

    media.addEventListener(
      'change',
      (e) => {
        this.reducedMotion = e.matches;
      },
      { signal }
    );
  }

  private setupIntersectionObserver(signal: AbortSignal): void {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isOffscreen = !entry.isIntersecting;
        if (this.isOffscreen) {
          this.audio.silenceContinuous();
        } else if (!this.isReady && this.ship.state === 'flying') {
          this.lastTimestamp = performance.now();
          this.startLoop();
        }
      }
    });

    observer.observe(this.options.wrapper);
    signal.addEventListener('abort', () => observer.disconnect());
  }

  private setupPageLifecycle(signal: AbortSignal): void {
    if (typeof document === 'undefined') return;

    // Visibility change
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          this.audio.silenceContinuous();
        } else if (!this.isReady && this.ship.state === 'flying') {
          this.lastTimestamp = performance.now();
          this.startLoop();
        }
      },
      { signal }
    );

    // Astro page swap / navigation cleanup
    document.addEventListener(
      'astro:before-swap',
      () => {
        this.destroy();
      },
      { signal }
    );

    window.addEventListener(
      'pagehide',
      () => {
        this.destroy();
      },
      { signal }
    );
  }

  private loadAllTimeBest(): number {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem('lander_best_score');
        return val ? parseInt(val, 10) || 0 : 0;
      }
    } catch {
      // Storage blocked
    }
    return 0;
  }

  private saveAllTimeBest(score: number): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('lander_best_score', String(score));
      }
    } catch {
      // Storage blocked
    }
  }
}
