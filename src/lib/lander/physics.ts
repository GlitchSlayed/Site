/**
 * Pure, deterministic lunar lander physics engine.
 * No DOM, no browser globals, fully testable in Node/Vitest.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TerrainSegment {
  x: number;
  y: number;
}

export interface PadConfig {
  x: number;
  y: number;
  width: number;
}

export interface LanderInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  sas: boolean;
}

export interface GameConfig {
  gravity: number;
  thrustPower: number;
  turnRate: number;
  fuelBurnRate: number;
  worldWidth: number;
  worldHeight: number;
  wind?: number;
  terrain: TerrainSegment[];
  pad: PadConfig;
  maxDescentRate: number; // e.g. 2.0 (displayed as 8.0 m/s)
  maxLateralRate: number; // e.g. 1.3 (displayed as 5.2 m/s)
  maxTiltRad: number; // e.g. 0.35 rad (~20.0 deg)
}

export interface ShipState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians (0 = upright)
  fuel: number; // 0 to 100
  state: 'flying' | 'landed' | 'crashed';
  thrusting?: boolean;
  lastEvaluation?: LandingEvaluation;
}

export type CrashReason =
  | 'missed-pad'
  | 'hard-vertical'
  | 'hard-lateral'
  | 'excessive-tilt'
  | 'out-of-fuel-hard-landing';

export interface LandingEvaluation {
  success: boolean;
  reason: CrashReason | null;
  descentRate: number; // game units/step
  lateralRate: number; // game units/step
  descentRateMs: number; // displayed m/s (vy * 4)
  lateralRateMs: number; // displayed m/s (|vx| * 4)
  tiltDeg: number;
  bothFeetOnPad: boolean;
  fuelRemaining: number;
  impactVelocities: {
    vx: number;
    vy: number;
  };
}

export const DEFAULT_PHYSICS_CONFIG: Omit<GameConfig, 'terrain' | 'pad'> = {
  gravity: 0.036,
  thrustPower: 0.082,
  turnRate: 0.024,
  fuelBurnRate: 0.1,
  worldWidth: 640,
  worldHeight: 320,
  maxDescentRate: 2.0,
  maxLateralRate: 1.3,
  maxTiltRad: 0.35,
};

export function createTerrain(pad: PadConfig, worldWidth = 640): TerrainSegment[] {
  const p1x = Math.max(30, Math.min(pad.x * 0.4, pad.x - 80));
  const p2x = Math.max(p1x + 20, pad.x - 35);
  const p3x = Math.min(worldWidth - 50, pad.x + pad.width + 45);
  const p4x = Math.min(worldWidth - 20, Math.max(p3x + 25, pad.x + pad.width + 110));

  return [
    { x: 0, y: 260 },
    { x: p1x, y: 280 },
    { x: p2x, y: 270 },
    { x: pad.x, y: pad.y },
    { x: pad.x + pad.width, y: pad.y },
    { x: p3x, y: 265 },
    { x: p4x, y: 290 },
    { x: worldWidth, y: 275 },
  ];
}

export function getTerrainY(x: number, terrain: TerrainSegment[]): number {
  if (terrain.length === 0) return 290;
  if (x <= terrain[0].x) return terrain[0].y;
  const last = terrain[terrain.length - 1];
  if (x >= last.x) return last.y;

  for (let i = 0; i < terrain.length - 1; i++) {
    const p1 = terrain[i];
    const p2 = terrain[i + 1];
    if (x >= p1.x && x <= p2.x) {
      if (p2.x === p1.x) return p1.y;
      const t = (x - p1.x) / (p2.x - p1.x);
      return p1.y + t * (p2.y - p1.y);
    }
  }
  return last.y;
}

export function getShipFootPositions(
  x: number,
  y: number,
  angle: number
): { leftFoot: Point; rightFoot: Point; nozzle: Point; bodyCenter: Point } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    leftFoot: {
      x: x + (-15) * cos - 14 * sin,
      y: y + (-15) * sin + 14 * cos,
    },
    rightFoot: {
      x: x + 15 * cos - 14 * sin,
      y: y + 15 * sin + 14 * cos,
    },
    nozzle: {
      x: x - 13 * sin,
      y: y + 13 * cos,
    },
    bodyCenter: {
      x,
      y: y + 4 * cos,
    },
  };
}

export function evaluateLanding(
  state: ShipState,
  pad: PadConfig,
  maxDescentRate = 2.0,
  maxLateralRate = 1.3,
  maxTiltRad = 0.35
): LandingEvaluation {
  const feet = getShipFootPositions(state.x, state.y, state.angle);
  const padMargin = 4;
  const padLeft = pad.x + padMargin;
  const padRight = pad.x + pad.width - padMargin;

  const leftFootOnPad = feet.leftFoot.x >= padLeft && feet.leftFoot.x <= padRight;
  const rightFootOnPad = feet.rightFoot.x >= padLeft && feet.rightFoot.x <= padRight;
  const bothFeetOnPad = leftFootOnPad && rightFootOnPad;

  const descentRate = state.vy;
  const lateralRate = Math.abs(state.vx);
  const tiltDeg = Math.abs(state.angle) * (180 / Math.PI);
  const descentRateMs = descentRate * 4;
  const lateralRateMs = lateralRate * 4;

  const softVertical = descentRate <= maxDescentRate;
  const softLateral = lateralRate <= maxLateralRate;
  const upright = Math.abs(state.angle) <= maxTiltRad;

  const success = bothFeetOnPad && softVertical && softLateral && upright;
  let reason: CrashReason | null = null;

  if (!success) {
    if (!bothFeetOnPad) {
      reason = 'missed-pad';
    } else if (!softVertical) {
      reason = 'hard-vertical';
    } else if (!softLateral) {
      reason = 'hard-lateral';
    } else if (!upright) {
      reason = 'excessive-tilt';
    } else if (state.fuel <= 0) {
      reason = 'out-of-fuel-hard-landing';
    } else {
      reason = 'hard-vertical';
    }
  }

  return {
    success,
    reason,
    descentRate,
    lateralRate,
    descentRateMs,
    lateralRateMs,
    tiltDeg,
    bothFeetOnPad,
    fuelRemaining: Math.max(0, state.fuel),
    impactVelocities: {
      vx: state.vx,
      vy: state.vy,
    },
  };
}

/**
 * Pure, deterministic step of lander physics.
 */
export function step(state: ShipState, input: LanderInput, config: GameConfig): ShipState {
  if (state.state !== 'flying') {
    return state;
  }

  let { x, y, vx, vy, angle, fuel } = state;

  // Steering
  if (input.rotateLeft) {
    angle -= config.turnRate;
  } else if (input.rotateRight) {
    angle += config.turnRate;
  } else if (input.sas) {
    // SAS auto-leveling
    angle *= 0.94;
    if (Math.abs(angle) < 0.003) {
      angle = 0;
    }
  }

  // Main thruster
  if (input.thrust && fuel > 0) {
    vx += Math.sin(angle) * config.thrustPower;
    vy -= Math.cos(angle) * config.thrustPower;
    fuel = Math.max(0, fuel - config.fuelBurnRate);
  }

  // Wind acceleration (if any)
  if (config.wind) {
    vx += config.wind;
  }

  // Gravity
  vy += config.gravity;

  // Update positions
  x += vx;
  y += vy;

  // Ceiling soft boundary
  if (y < 12 && vy < 0) {
    y = 12;
    vy = -vy * 0.25;
  }

  // Horizontal wrap-around
  if (x < 0) {
    x += config.worldWidth;
  } else if (x > config.worldWidth) {
    x -= config.worldWidth;
  }

  // Terrain contact check
  const feet = getShipFootPositions(x, y, angle);
  const leftTerrainY = getTerrainY(feet.leftFoot.x, config.terrain);
  const rightTerrainY = getTerrainY(feet.rightFoot.x, config.terrain);
  const nozzleTerrainY = getTerrainY(feet.nozzle.x, config.terrain);
  const bodyTerrainY = getTerrainY(feet.bodyCenter.x, config.terrain);

  const contactLeft = feet.leftFoot.y >= leftTerrainY;
  const contactRight = feet.rightFoot.y >= rightTerrainY;
  const contactNozzle = feet.nozzle.y >= nozzleTerrainY;
  const contactBody = feet.bodyCenter.y >= bodyTerrainY;

  if (contactLeft || contactRight || contactNozzle || contactBody) {
    // Ground impact reached: capture impact state BEFORE zeroing velocities
    const impactState: ShipState = {
      x,
      y,
      vx,
      vy,
      angle,
      fuel,
      state: 'flying',
    };

    const evaluation = evaluateLanding(
      impactState,
      config.pad,
      config.maxDescentRate,
      config.maxLateralRate,
      config.maxTiltRad
    );

    if (evaluation.success) {
      return {
        x,
        y: config.pad.y - 14,
        vx: 0,
        vy: 0,
        angle: 0,
        fuel,
        state: 'landed',
        lastEvaluation: evaluation,
      };
    }

    // Crashed
    return {
      x,
      y,
      vx,
      vy,
      angle,
      fuel,
      state: 'crashed',
      lastEvaluation: evaluation,
    };
  }

  return {
    x,
    y,
    vx,
    vy,
    angle,
    fuel,
    state: 'flying',
  };
}

/**
 * Pure fixed-timestep accumulator helper.
 * Clamps maximum simulated steps per frame to avoid teleportation or spiral of death.
 */
export function updatePhysicsAccumulator(
  accumulator: number,
  deltaSeconds: number,
  stepSizeSeconds = 1 / 60,
  maxSteps = 5
): { steps: number; remainingAccumulator: number } {
  // Guard against negative or NaN deltas
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return { steps: 0, remainingAccumulator: accumulator };
  }

  // Clamp large frame gaps (e.g. background tab)
  const safeDelta = Math.min(deltaSeconds, stepSizeSeconds * maxSteps);
  let acc = accumulator + safeDelta;
  let steps = 0;

  while (acc >= stepSizeSeconds && steps < maxSteps) {
    acc -= stepSizeSeconds;
    steps++;
  }

  // If accumulator still exceeds stepSize because steps hit maxSteps, discard overflow
  if (steps >= maxSteps && acc >= stepSizeSeconds) {
    acc = acc % stepSizeSeconds;
  }

  return { steps, remainingAccumulator: acc };
}
