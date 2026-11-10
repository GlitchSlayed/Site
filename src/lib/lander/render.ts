/**
 * DPR-aware, responsive canvas renderer for LanderGame.
 * Reads palette from container CSS variables with MutationObserver on data-theme.
 * Logical 640x320 world scaled crisply to Retina displays.
 * Supports reduced-motion preferences without stopping rendering.
 */

import type { GameConfig, ShipState } from './physics';

export interface VisualParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface RenderState {
  ship: ShipState;
  particles: VisualParticle[];
  beaconTick: number;
  isReady: boolean;
  score: number;
  streak: number;
  reducedMotion: boolean;
  wind?: number;
}

export interface Palette {
  ink: string;
  faint: string;
  accent: string;
  safe: string;
  warning: string;
  bg: string;
  terrain: string;
  shipFill: string;
  isDark: boolean;
}

export class LanderRenderer {
  private dpr = 1;
  private cssWidth = 640;
  private palette!: Palette;
  private themeObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    signal: AbortSignal
  ) {
    this.updateDpr();
    this.updatePalette();
    this.setupObservers(signal);
  }

  public updateDpr(): void {
    if (typeof window === 'undefined') return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resizeBackingStore();
  }

  public updatePalette(): void {
    if (typeof window === 'undefined') return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    const computed = window.getComputedStyle(this.container);

    const getVar = (name: string, fallback: string) => {
      const val = computed.getPropertyValue(name).trim();
      return val || fallback;
    };

    this.palette = {
      isDark,
      ink: getVar('--foreground', isDark ? '#EDE8DE' : '#1C1B18'),
      faint: getVar('--border', isDark ? '#2E2C26' : '#E5DFD1'),
      accent: getVar('--accent', isDark ? '#E25835' : '#B83E18'),
      safe: isDark ? '#5CD068' : '#1D8338',
      warning: isDark ? '#F5B041' : '#D97706',
      bg: getVar('--background', isDark ? '#161614' : '#F8F6F0'),
      terrain: getVar('--surface-2', isDark ? '#1F1E1B' : '#EFECE3'),
      shipFill: getVar('--surface', isDark ? '#2A2925' : '#FFFFFF'),
    };
  }

  public resizeBackingStore(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = rect.width || 640;

    const targetW = Math.round(640 * this.dpr);
    const targetH = Math.round(320 * this.dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    config: GameConfig,
    state: RenderState
  ): void {
    const { ship, particles, beaconTick, isReady, reducedMotion, wind } = state;
    const { dpr, palette } = this;
    const p = palette;

    ctx.save();
    // Scale canvas context to logical 640x320 coordinate space
    ctx.scale(dpr, dpr);

    // Dynamic font scaling for small mobile screens so HUD stays legible
    const scaleFactor = Math.max(1, 560 / Math.max(this.cssWidth, 280));
    const hudFontSize = Math.min(13, 10.5 * scaleFactor);

    // Background
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, config.worldWidth, config.worldHeight);

    // Radar grid lines
    ctx.strokeStyle = p.faint;
    ctx.lineWidth = 1;
    for (let x = 40; x < config.worldWidth; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, config.worldHeight);
      ctx.stroke();
    }
    for (let y = 40; y < config.worldHeight; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(config.worldWidth, y);
      ctx.stroke();
    }

    // Landing guide corridor (when ship is horizontally over pad)
    const { pad } = config;
    if (ship.x >= pad.x && ship.x <= pad.x + pad.width && ship.state === 'flying') {
      ctx.fillStyle = p.isDark ? 'rgba(92, 208, 104, 0.05)' : 'rgba(29, 131, 56, 0.05)';
      ctx.fillRect(pad.x, 0, pad.width, pad.y);

      ctx.strokeStyle = p.isDark ? 'rgba(92, 208, 104, 0.25)' : 'rgba(29, 131, 56, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.x, 0);
      ctx.lineTo(pad.x, pad.y);
      ctx.moveTo(pad.x + pad.width, 0);
      ctx.lineTo(pad.x + pad.width, pad.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Terrain
    ctx.beginPath();
    ctx.moveTo(config.terrain[0].x, config.terrain[0].y);
    for (let i = 1; i < config.terrain.length; i++) {
      ctx.lineTo(config.terrain[i].x, config.terrain[i].y);
    }
    ctx.lineTo(config.worldWidth, config.worldHeight);
    ctx.lineTo(0, config.worldHeight);
    ctx.closePath();
    ctx.fillStyle = p.terrain;
    ctx.fill();

    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(config.terrain[0].x, config.terrain[0].y);
    for (let i = 1; i < config.terrain.length; i++) {
      ctx.lineTo(config.terrain[i].x, config.terrain[i].y);
    }
    ctx.stroke();

    // Landing Pad
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pad.x, pad.y);
    ctx.lineTo(pad.x + pad.width, pad.y);
    ctx.stroke();

    // Beacon Lights (solid if reduced motion, blinking otherwise)
    const beaconOn = reducedMotion || Math.floor(beaconTick / 25) % 2 === 0;
    ctx.fillStyle = beaconOn ? p.safe : p.faint;
    ctx.beginPath();
    ctx.arc(pad.x + 3, pad.y - 3, 3.5, 0, Math.PI * 2);
    ctx.arc(pad.x + pad.width - 3, pad.y - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Pad Label
    ctx.fillStyle = p.accent;
    ctx.font = '10px monospace';
    ctx.fillText('[TARGET PAD 404]', pad.x + 6, pad.y + 16);

    // Particles
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      const size = Math.max(1, pt.size * (1 - pt.life / pt.maxLife));
      ctx.fillRect(pt.x, pt.y, size, size);
    }

    // Velocity Vector Predictor
    if (ship.state === 'flying') {
      const vecSafe =
        ship.vy <= config.maxDescentRate &&
        Math.abs(ship.vx) <= config.maxLateralRate &&
        Math.abs(ship.angle) <= config.maxTiltRad;

      ctx.strokeStyle = vecSafe ? p.safe : p.accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y);
      ctx.lineTo(ship.x + ship.vx * 16, ship.y + ship.vy * 16);
      ctx.stroke();
    }

    // Draw Ship
    if (ship.state !== 'crashed') {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);

      // Body lines
      ctx.strokeStyle = p.ink;
      ctx.fillStyle = p.shipFill;
      ctx.lineWidth = 1.6;

      // Capsule command module
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(7, 2);
      ctx.lineTo(-7, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Equipment module
      ctx.strokeRect(-8, 2, 16, 7);

      // Landing legs with feet
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.lineTo(-12, 14);
      ctx.lineTo(-15, 14);
      ctx.moveTo(8, 7);
      ctx.lineTo(12, 14);
      ctx.lineTo(15, 14);
      ctx.stroke();

      // Engine nozzle
      ctx.beginPath();
      ctx.moveTo(-4, 9);
      ctx.lineTo(4, 9);
      ctx.lineTo(2, 13);
      ctx.lineTo(-2, 13);
      ctx.closePath();
      ctx.fillStyle = p.accent;
      ctx.fill();
      ctx.stroke();

      // Thruster flame plume
      if (ship.thrusting && ship.fuel > 0) {
        ctx.beginPath();
        ctx.moveTo(-3, 13);
        ctx.lineTo(0, 18 + Math.random() * 8);
        ctx.lineTo(3, 13);
        ctx.fillStyle = p.accent;
        ctx.fill();
      }

      ctx.restore();
    }

    // Telemetry HUD overlay
    ctx.font = `${hudFontSize}px monospace`;
    ctx.fillStyle = p.ink;

    // Altitude
    const alt = Math.max(0, Math.round((pad.y - ship.y) * 4));
    ctx.fillText(`ALT: ${alt} M`, 14, 20);

    // Vertical descent
    const vSafe = ship.vy <= config.maxDescentRate;
    ctx.fillStyle = vSafe ? p.safe : p.accent;
    ctx.fillText(
      `V_VERT: ${ship.vy >= 0 ? '+' : ''}${(ship.vy * 4).toFixed(1)} M/S ${
        vSafe ? '[SAFE]' : '[WARN]'
      }`,
      14,
      36
    );

    // Lateral drift
    const hSafe = Math.abs(ship.vx) <= config.maxLateralRate;
    ctx.fillStyle = hSafe ? p.safe : p.accent;
    ctx.fillText(
      `V_HORIZ: ${ship.vx >= 0 ? '+' : ''}${(ship.vx * 4).toFixed(1)} M/S ${
        hSafe ? '[SAFE]' : '[WARN]'
      }`,
      14,
      52
    );

    // Attitude tilt
    const deg = Math.round((ship.angle * 180) / Math.PI);
    const angleSafe = Math.abs(ship.angle) <= config.maxTiltRad;
    ctx.fillStyle = angleSafe ? p.safe : p.accent;
    ctx.fillText(
      `ATTITUDE: ${deg >= 0 ? '+' : ''}${deg}° ${angleSafe ? '[SAFE]' : '[WARN]'}`,
      14,
      68
    );

    // Fuel gauge
    ctx.fillStyle = p.ink;
    ctx.fillText(`FUEL: ${Math.round(ship.fuel)}%`, 14, 84);
    ctx.strokeStyle = p.faint;
    ctx.strokeRect(82, 76, 52, 9);
    ctx.fillStyle = ship.fuel > 20 ? p.safe : p.accent;
    ctx.fillRect(83, 77, Math.max(0, (ship.fuel / 100) * 50), 7);

    // Wind indicator (if active from round 4)
    if (wind && Math.abs(wind) > 0.0001) {
      const windMs = (wind * 60 * 4).toFixed(1);
      ctx.fillStyle = p.warning;
      ctx.fillText(`WIND: ${wind > 0 ? '▶ +' : '◀ '}${windMs} M/S`, 14, 102);
    }

    // Ready state overlay
    if (isReady) {
      ctx.fillStyle = p.isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.72)';
      ctx.fillRect(0, 0, config.worldWidth, config.worldHeight);

      // Centered ready box
      const boxW = 380;
      const boxH = 110;
      const boxX = (config.worldWidth - boxW) / 2;
      const boxY = (config.worldHeight - boxH) / 2;

      ctx.fillStyle = p.shipFill;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.5;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = p.accent;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AGC PROGRAM 404 // READY', config.worldWidth / 2, boxY + 30);

      ctx.fillStyle = p.ink;
      ctx.font = '12px monospace';
      ctx.fillText('[ CLICK OR PRESS ANY CONTROL TO START ]', config.worldWidth / 2, boxY + 56);

      ctx.fillStyle = p.faint;
      ctx.font = '10px monospace';
      ctx.fillText('Controls: ← / → or A / D to steer · ↑ / W / Space for thrust', config.worldWidth / 2, boxY + 84);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  private setupObservers(signal: AbortSignal): void {
    if (typeof window === 'undefined') return;

    // Theme observer on document.documentElement data-theme attribute
    this.themeObserver = new MutationObserver(() => {
      this.updatePalette();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Resize observer on container to handle canvas resize
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeBackingStore();
    });
    this.resizeObserver.observe(this.container);

    signal.addEventListener('abort', () => {
      this.themeObserver?.disconnect();
      this.resizeObserver?.disconnect();
    });
  }
}
