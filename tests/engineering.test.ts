// Tests for the engineering model layer (pure TypeScript, independent of rendering).
import { describe, it, expect } from 'vitest';
import { liftModel } from '../src/lib/engineering/models/aerodynamics/lift';
import { dragPolarModel } from '../src/lib/engineering/models/aerodynamics/dragPolar';
import { aircraftPerformanceModel } from '../src/lib/engineering/models/aircraft-performance/bwb';
import {
  safeDivide,
  safeResult,
  significantFigures,
  validateInputs,
  clamp,
} from '../src/lib/engineering/validation';
import { convert, UNITS } from '../src/lib/engineering/units';
import { getModel } from '../src/lib/engineering/registry';

describe('lift model', () => {
  it('computes lift for standard conditions', () => {
    const out = liftModel.compute({
      rho: 1.225,
      velocity: 50,
      area: 20,
      cl: 0.5,
    });
    // L = 0.5 * 1.225 * 50^2 * 20 * 0.5 = 15312.5 N
    expect(out.lift.value).toBeCloseTo(15312.5, 4);
  });

  it('handles zero velocity safely', () => {
    const out = liftModel.compute({
      rho: 1.225,
      velocity: 0,
      area: 20,
      cl: 0.5,
    });
    expect(out.lift.value).toBe(0);
  });

  it('computes reference lift case: 61250 N', () => {
    // L = 0.5 * rho * V^2 * S * C_L = 0.5 * 1.225 * 100^2 * 20 * 0.5 = 61250 N
    const out = liftModel.compute({
      rho: 1.225,
      velocity: 100,
      area: 20,
      cl: 0.5,
    });
    expect(out.lift.value).toBeCloseTo(61250, 4);
  });

  it('lift scales linearly with density, area, and cl, quadratically with velocity', () => {
    const base = liftModel.compute({ rho: 1.225, velocity: 100, area: 20, cl: 0.5 }).lift.value!;
    const doubleDensity = liftModel.compute({ rho: 2.45, velocity: 100, area: 20, cl: 0.5 }).lift.value!;
    const doubleArea = liftModel.compute({ rho: 1.225, velocity: 100, area: 40, cl: 0.5 }).lift.value!;
    const doubleCL = liftModel.compute({ rho: 1.225, velocity: 100, area: 20, cl: 1.0 }).lift.value!;
    const doubleVelocity = liftModel.compute({ rho: 1.225, velocity: 200, area: 20, cl: 0.5 }).lift.value!;

    expect(doubleDensity).toBeCloseTo(base * 2, 4);
    expect(doubleArea).toBeCloseTo(base * 2, 4);
    expect(doubleCL).toBeCloseTo(base * 2, 4);
    expect(doubleVelocity).toBeCloseTo(base * 4, 4);
  });

  it('is registered in the model registry', () => {
    expect(getModel('aerodynamics.lift')).toBe(liftModel);
  });
});

describe('drag polar model', () => {
  it('computes k and C_D correctly', () => {
    const out = dragPolarModel.compute({ cd0: 0.02, e: 0.8, ar: 10, cl: 0.5 });
    // k = 1 / (pi * 0.8 * 10) = 0.039788...
    expect(out.k.value).toBeCloseTo(1 / (Math.PI * 0.8 * 10), 6);
    // C_D = 0.02 + k * 0.5^2
    const k = 1 / (Math.PI * 0.8 * 10);
    expect(out.cd.value).toBeCloseTo(0.02 + k * 0.25, 6);
  });

  it('handles e=0 safely (division by zero -> fallback)', () => {
    const out = dragPolarModel.compute({ cd0: 0.02, e: 0, ar: 10, cl: 0.5 });
    // e=0 => k fallback to 0 => C_D = cd0
    expect(out.k.value).toBe(0);
    expect(out.cd.value).toBe(0.02);
  });

  it('is symmetric in |C_L| (drag depends on C_L^2)', () => {
    const pos = dragPolarModel.compute({ cd0: 0.02, e: 0.8, ar: 10, cl: 0.8 }).cd.value;
    const neg = dragPolarModel.compute({ cd0: 0.02, e: 0.8, ar: 10, cl: -0.8 }).cd.value;
    expect(pos).toBeCloseTo(neg, 6);
  });
});

describe('aircraft performance model', () => {
  const base = {
    mass: 70000,
    structuralPenalty: 0,
    area: 300,
    ar: 9,
    e: 0.8,
    cd0: 0.02,
    inducedCorrection: 1,
    rho: 1.225,
    velocity: 80,
  };

  it('computes steady level flight values', () => {
    const out = aircraftPerformanceModel.compute(base);
    const weight = 70000 * 9.80665;
    const q = 0.5 * 1.225 * 80 * 80;
    const cl = weight / (q * 300);
    const k = 1 / (Math.PI * 0.8 * 9);
    const cd = 0.02 + k * cl * cl;
    expect(out.weight.value).toBeCloseTo(weight, 2);
    expect(out.cl.value).toBeCloseTo(cl, 4);
    expect(out.k.value).toBeCloseTo(k, 6);
    expect(out.cd.value).toBeCloseTo(cd, 4);
    expect(out.ld.value).toBeCloseTo(cl / cd, 4);
    expect(out.thrust.value).toBeCloseTo(q * 300 * cd, 2);
    // Thrust equals drag in steady level flight.
    expect(out.thrust.value).toBeCloseTo(out.drag.value, 4);
  });

  it('structural mass penalty raises required C_L and drag', () => {
    // Use velocity=60 so required C_L exceeds the L/D-optimal point (~0.67),
    // ensuring added mass reduces L/D.
    const lowSpeedBase = { ...base, velocity: 60 };
    const baseline = aircraftPerformanceModel.compute({ ...lowSpeedBase, structuralPenalty: 0 });
    const penalized = aircraftPerformanceModel.compute({ ...lowSpeedBase, structuralPenalty: 0.2 });
    expect(penalized.cl.value).toBeGreaterThan(baseline.cl.value);
    expect(penalized.cd.value).toBeGreaterThan(baseline.cd.value);
    expect(penalized.ld.value).toBeLessThan(baseline.ld.value);
    expect(penalized.totalMass.value).toBeCloseTo(70000 * 1.2, 4);
  });

  it('guards against zero/negative area', () => {
    const out = aircraftPerformanceModel.compute({ ...base, area: 0 });
    expect(Number.isFinite(out.cl.value)).toBe(true);
    expect(out.cl.value).toBe(0);
  });

  it('L/D = C_L / C_D identity', () => {
    const out = aircraftPerformanceModel.compute(base);
    expect(out.ld.value).toBeCloseTo(out.cl.value / out.cd.value, 4);
  });

  it('lift equals weight in steady level flight', () => {
    const out = aircraftPerformanceModel.compute(base);
    // In steady level flight, L = W = m_total * g
    expect(out.lift.value).toBeCloseTo(out.weight.value, 4);
  });

  it('geometry consistency: AR = b^2 / S', () => {
    // With span=45, area=300: AR = 45^2/300 = 6.75
    const out = aircraftPerformanceModel.compute({ ...base, ar: 6.75 });
    const expectedAR = (45 * 45) / 300;
    expect(expectedAR).toBeCloseTo(6.75, 4);
    // The induced-drag factor uses the provided AR
    const k = 1 / (Math.PI * 0.8 * expectedAR);
    expect(out.k.value).toBeCloseTo(k, 6);
  });

  it('structural mass penalty reduces L/D through increased required C_L', () => {
    // Use velocity=60 so required C_L exceeds the L/D-optimal point (~0.67),
    // ensuring added mass reduces L/D.
    const lowSpeedBase = { ...base, velocity: 60 };
    const baseline = aircraftPerformanceModel.compute({ ...lowSpeedBase, structuralPenalty: 0 });
    const penalized = aircraftPerformanceModel.compute({ ...lowSpeedBase, structuralPenalty: 0.2 });
    expect(penalized.cl.value).toBeGreaterThan(baseline.cl.value);
    expect(penalized.cd.value).toBeGreaterThan(baseline.cd.value);
    expect(penalized.ld.value).toBeLessThan(baseline.ld.value);
    expect(penalized.totalMass.value).toBeCloseTo(70000 * 1.2, 4);
  });
});

describe('validation', () => {
  it('safeDivide returns fallback for zero denominator', () => {
    expect(safeDivide(10, 0, -1)).toBe(-1);
    expect(safeDivide(10, 1e-12, -1)).toBe(-1);
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('safeResult returns fallback for non-finite', () => {
    expect(safeResult(Infinity, -1)).toBe(-1);
    expect(safeResult(NaN, -1)).toBe(-1);
    expect(safeResult(42, -1)).toBe(42);
  });

  it('significantFigures rounds correctly', () => {
    expect(significantFigures(1234.56, 3)).toBe(1230);
    expect(significantFigures(0.004567, 2)).toBeCloseTo(0.0046, 6);
    expect(significantFigures(0, 3)).toBe(0);
    expect(significantFigures(Infinity, 3)).toBe(Infinity);
  });

  it('validateInputs clamps out-of-range and reports errors', () => {
    const params = [
      { id: 'a', label: 'A', min: 0, max: 10, step: 1, defaultValue: 5 },
    ];
    const { values, errors } = validateInputs({ a: 99 }, params);
    expect(values.a).toBe(10);
    expect(errors.a).toBeDefined();
  });

  it('validateInputs uses defaults for missing values', () => {
    const params = [
      { id: 'a', label: 'A', min: 0, max: 10, step: 1, defaultValue: 5 },
    ];
    const { values } = validateInputs({}, params);
    expect(values.a).toBe(5);
  });

  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('unit conversions', () => {
  it('converts knots to m/s and back', () => {
    const mps = convert(100, 'kt', 'm/s');
    expect(mps).toBeCloseTo(100 * 0.514444, 6);
    expect(convert(mps, 'm/s', 'kt')).toBeCloseTo(100, 6);
  });

  it('converts feet to meters', () => {
    expect(convert(10, 'ft', 'm')).toBeCloseTo(3.048, 6);
  });

  it('returns input for unknown or mismatched units', () => {
    expect(convert(5, 'm', 'kg')).toBe(5);
    expect(convert(5, 'nope', 'm')).toBe(5);
  });

  it('UNITS exposes SI density and speed', () => {
    expect(UNITS['kg/m³'].dimension).toBe('density');
    expect(UNITS['m/s'].dimension).toBe('speed');
  });
});

describe('model registry', () => {
  it('lists all registered models', () => {
    expect(getModel(liftModel.id)).toBeDefined();
    expect(getModel(dragPolarModel.id)).toBeDefined();
    expect(getModel(aircraftPerformanceModel.id)).toBeDefined();
    expect(getModel('nonexistent')).toBeUndefined();
  });

  it('aircraft performance model has expected presets', () => {
    const model = getModel(aircraftPerformanceModel.id);
    expect(model?.presets?.conventional).toBeDefined();
    expect(model?.presets?.bwbOptimistic).toBeDefined();
    expect(model?.presets?.bwbPenalized).toBeDefined();
  });
});
