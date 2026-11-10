import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHYSICS_CONFIG,
  type GameConfig,
  type LanderInput,
  type PadConfig,
  type ShipState,
  createTerrain,
  evaluateLanding,
  step,
  updatePhysicsAccumulator,
} from '../src/lib/lander/physics';

describe('Lander Physics Engine', () => {
  const pad: PadConfig = { x: 235, y: 285, width: 155 };
  const terrain = createTerrain(pad);
  const baseConfig: GameConfig = {
    ...DEFAULT_PHYSICS_CONFIG,
    pad,
    terrain,
  };

  it('is strictly deterministic: N steps with same input produce identical states', () => {
    const initialState: ShipState = {
      x: 100,
      y: 50,
      vx: 0.25,
      vy: 0.05,
      angle: 0.02,
      fuel: 100,
      state: 'flying',
    };

    const input: LanderInput = {
      thrust: true,
      rotateLeft: false,
      rotateRight: true,
      sas: false,
    };

    let run1 = { ...initialState };
    for (let i = 0; i < 60; i++) {
      run1 = step(run1, input, baseConfig);
    }

    let run2 = { ...initialState };
    for (let i = 0; i < 60; i++) {
      run2 = step(run2, input, baseConfig);
    }

    expect(run1).toEqual(run2);
  });

  describe('updatePhysicsAccumulator', () => {
    it('produces the same number of steps (+/- 1) across 60, 120, and 144 fps for 1 second of simulation', () => {
      const durationSeconds = 1.0;
      const stepSize = 1 / 60;

      // 60 Hz simulation
      let acc60 = 0;
      let steps60 = 0;
      const dt60 = 1 / 60;
      for (let t = 0; t < durationSeconds; t += dt60) {
        const res = updatePhysicsAccumulator(acc60, dt60, stepSize);
        steps60 += res.steps;
        acc60 = res.remainingAccumulator;
      }

      // 120 Hz simulation
      let acc120 = 0;
      let steps120 = 0;
      const dt120 = 1 / 120;
      for (let t = 0; t < durationSeconds; t += dt120) {
        const res = updatePhysicsAccumulator(acc120, dt120, stepSize);
        steps120 += res.steps;
        acc120 = res.remainingAccumulator;
      }

      // 144 Hz simulation
      let acc144 = 0;
      let steps144 = 0;
      const dt144 = 1 / 144;
      for (let t = 0; t < durationSeconds; t += dt144) {
        const res = updatePhysicsAccumulator(acc144, dt144, stepSize);
        steps144 += res.steps;
        acc144 = res.remainingAccumulator;
      }

      expect(Math.abs(steps60 - 60)).toBeLessThanOrEqual(1);
      expect(Math.abs(steps120 - 60)).toBeLessThanOrEqual(1);
      expect(Math.abs(steps144 - 60)).toBeLessThanOrEqual(1);
    });

    it('clamps frame gaps when returning from background tab', () => {
      // 5 seconds frame gap
      const res = updatePhysicsAccumulator(0, 5.0, 1 / 60, 5);
      expect(res.steps).toBe(5);
    });
  });

  describe('evaluateLanding', () => {
    it('evaluates successful touchdown when within limits and both feet on pad', () => {
      const state: ShipState = {
        x: pad.x + pad.width / 2,
        y: pad.y - 14,
        vx: 0.4,
        vy: 1.2,
        angle: 0.05,
        fuel: 65,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.success).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.descentRate).toBe(1.2);
      expect(result.lateralRate).toBe(0.4);
      expect(result.descentRateMs).toBeCloseTo(4.8);
      expect(result.lateralRateMs).toBeCloseTo(1.6);
      expect(result.bothFeetOnPad).toBe(true);
    });

    it('fails when descent rate is too fast vertically', () => {
      const state: ShipState = {
        x: pad.x + pad.width / 2,
        y: pad.y - 14,
        vx: 0.2,
        vy: 2.5, // limit is 2.0
        angle: 0,
        fuel: 50,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('hard-vertical');
    });

    it('fails when horizontal speed is too fast laterally', () => {
      const state: ShipState = {
        x: pad.x + pad.width / 2,
        y: pad.y - 14,
        vx: 1.8, // limit is 1.3
        vy: 0.8,
        angle: 0,
        fuel: 50,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('hard-lateral');
    });

    it('fails when tilt angle exceeds limit', () => {
      const state: ShipState = {
        x: pad.x + pad.width / 2,
        y: pad.y - 14,
        vx: 0.2,
        vy: 0.8,
        angle: 0.45, // limit is 0.35 rad
        fuel: 50,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('excessive-tilt');
    });

    it('fails when touchdown occurs off-pad', () => {
      const state: ShipState = {
        x: pad.x - 50, // entirely outside pad
        y: 270,
        vx: 0.2,
        vy: 0.8,
        angle: 0,
        fuel: 50,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('missed-pad');
    });

    it('fails when one foot is off the pad edge', () => {
      // Pad is at pad.x, width 155. Left foot is at x - 15.
      // If ship center is at pad.x + 8, left foot is at pad.x - 7 (off the left edge!)
      const state: ShipState = {
        x: pad.x + 8,
        y: pad.y - 14,
        vx: 0.1,
        vy: 0.8,
        angle: 0,
        fuel: 50,
        state: 'flying',
      };

      const result = evaluateLanding(state, pad);
      expect(result.bothFeetOnPad).toBe(false);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('missed-pad');
    });

    it('regression: captures impact velocities before zeroing (old zero-before-read bug)', () => {
      // Initial flight state approaching ground
      const state: ShipState = {
        x: pad.x + 50,
        y: pad.y - 15,
        vx: 0.45,
        vy: 1.55,
        angle: 0.02,
        fuel: 72,
        state: 'flying',
      };

      const noInput: LanderInput = {
        thrust: false,
        rotateLeft: false,
        rotateRight: false,
        sas: true,
      };

      // Step until contact
      const next = step(state, noInput, baseConfig);
      expect(next.state).toBe('landed');
      // ship vy and vx are zeroed on landing so ship rests in place
      expect(next.vy).toBe(0);
      expect(next.vx).toBe(0);
      // but lastEvaluation must record the TRUE impact velocities
      expect(next.lastEvaluation).toBeDefined();
      expect(next.lastEvaluation?.impactVelocities.vy).toBeGreaterThan(1.5);
      expect(next.lastEvaluation?.descentRate).toBeGreaterThan(1.5);
      expect(next.lastEvaluation?.fuelRemaining).toBe(72);
    });
  });

  describe('Scripted Autopilot Win Proof', () => {
    it('proves the game is winnable on round-1 defaults with bang-bang controller', () => {
      let state: ShipState = {
        x: 120,
        y: 45,
        vx: 0.25,
        vy: 0.05,
        angle: 0,
        fuel: 100,
        state: 'flying',
      };

      const targetX = pad.x + pad.width / 2;
      let steps = 0;
      const maxSteps = 1200; // 20 seconds at 60 Hz

      while (state.state === 'flying' && steps < maxSteps) {
        steps++;
        const dx = targetX - state.x;

        // If not yet over pad, cruise horizontally and maintain altitude
        let targetSpeedY = 1.0;
        if (Math.abs(dx) > 40) {
          targetSpeedY = state.y > 110 ? -0.3 : 0.4;
        } else if (state.y > pad.y - 60) {
          targetSpeedY = 0.8;
        }

        // Desired horizontal speed based on distance to pad
        const targetSpeedX = Math.max(-0.8, Math.min(0.8, dx * 0.02));

        // Attitude control
        let rotateLeft = false;
        let rotateRight = false;
        const desiredAngle = Math.max(-0.25, Math.min(0.25, (targetSpeedX - state.vx) * 0.45));

        if (state.angle < desiredAngle - 0.02) {
          rotateRight = true;
        } else if (state.angle > desiredAngle + 0.02) {
          rotateLeft = true;
        }

        // Thrust control
        const thrust =
          state.vy > targetSpeedY ||
          (Math.abs(dx) <= 40 && state.y > pad.y - 40 && state.vy > 0.5);

        state = step(
          state,
          {
            thrust,
            rotateLeft,
            rotateRight,
            sas: true,
          },
          baseConfig
        );
      }

      expect(state.state).toBe('landed');
      expect(state.lastEvaluation?.success).toBe(true);
      expect(state.fuel).toBeGreaterThan(0);
    });
  });
});
