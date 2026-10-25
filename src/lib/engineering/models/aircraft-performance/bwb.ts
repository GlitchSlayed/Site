// Simplified aircraft performance model for steady, level flight.
//
// C_L = 2 * m * g / (rho * V^2 * S)
// k = 1 / (pi * e * AR)
// C_D = C_D,0 + k * C_L^2
// L/D = C_L / C_D
// D = 1/2 * rho * V^2 * S * C_D
// Thrust required (steady level) = D
//
// An illustrative structural-mass penalty scales the aircraft mass so the
// sensitivity of drag and L/D to added structural mass can be explored. It is
// explicitly an assumption, not a validated BWB structural prediction.
import type { EngineeringModel } from '../../types';
import { safeDivide, safeResult } from '../../validation';

const G = 9.80665;

export const aircraftPerformanceModel: EngineeringModel = {
  id: 'aircraft.performance',
  title: 'Aircraft Performance (Steady, Level Flight)',
  description: 'Compute lift coefficient, drag, and L/D for an aircraft in steady, level flight, with an optional illustrative structural-mass penalty.',
  assumptions: [
    'Steady, level flight: lift equals weight and thrust equals drag.',
    'Parabolic drag polar: C_D = C_D,0 + k * C_L^2.',
    'Induced-drag factor: k = 1 / (pi * e * AR).',
    'Constant air density over the flight segment.',
    'C_L and C_D referenced to the same wing reference area S.',
  ],
  limitations: [
    'Low-order model; omits compressibility, transonic, viscous, and interference effects.',
    'Structural-mass penalty is illustrative and not a validated BWB prediction.',
    'Does not model climb, descent, maneuver, or mission fuel burn.',
  ],
  parameters: [
    {
      id: 'mass',
      label: 'Aircraft mass',
      symbol: 'm',
      unit: 'kg',
      min: 100,
      max: 500000,
      step: 100,
      defaultValue: 70000,
      description: 'Operating mass used as the weight basis.',
    },
    {
      id: 'structuralPenalty',
      label: 'Structural mass penalty',
      symbol: 'Δm/m',
      unit: '-',
      min: 0,
      max: 0.6,
      step: 0.01,
      defaultValue: 0,
      description: 'Illustrative additional structural mass as a fraction of base mass. Not a validated BWB prediction.',
    },
    {
      id: 'area',
      label: 'Wing reference area',
      symbol: 'S',
      unit: 'm²',
      min: 1,
      max: 2000,
      step: 1,
      defaultValue: 300,
    },
    {
      id: 'span',
      label: 'Wingspan',
      symbol: 'b',
      unit: 'm',
      min: 5,
      max: 120,
      step: 0.5,
      defaultValue: 45,
      description: 'Entered for geometry reference; aspect ratio is used directly in the induced-drag term.',
    },
    {
      id: 'ar',
      label: 'Aspect ratio',
      symbol: 'AR',
      unit: '-',
      min: 1,
      max: 50,
      step: 0.5,
      defaultValue: 9,
      description: 'Aspect ratio used in the induced-drag factor k = 1/(pi * e * AR).',
    },
    {
      id: 'e',
      label: 'Oswald efficiency factor',
      symbol: 'e',
      unit: '-',
      min: 0.5,
      max: 1.0,
      step: 0.01,
      defaultValue: 0.8,
    },
    {
      id: 'cd0',
      label: 'Zero-lift drag coefficient',
      symbol: 'C_D,0',
      unit: '-',
      min: 0.0,
      max: 0.2,
      step: 0.001,
      defaultValue: 0.02,
    },
    {
      id: 'inducedCorrection',
      label: 'Induced-drag correction factor',
      symbol: 'f_k',
      unit: '-',
      min: 0.5,
      max: 2.0,
      step: 0.05,
      defaultValue: 1.0,
      description: 'Multiplier applied to k to explore sensitivity of induced drag.',
    },
    {
      id: 'rho',
      label: 'Air density',
      symbol: 'ρ',
      unit: 'kg/m³',
      min: 0.01,
      max: 2.0,
      step: 0.01,
      defaultValue: 1.225,
    },
    {
      id: 'velocity',
      label: 'Flight velocity',
      symbol: 'V',
      unit: 'm/s',
      min: 10,
      max: 300,
      step: 1,
      defaultValue: 80,
    },
  ],
  outputs: {
    totalMass: { label: 'Total mass', symbol: 'm_total', unit: 'kg', significantFigures: 4 },
    weight: { label: 'Weight', symbol: 'W', unit: 'N', significantFigures: 4 },
    cl: { label: 'Lift coefficient', symbol: 'C_L', unit: '-', significantFigures: 4 },
    k: { label: 'Induced-drag factor', symbol: 'k', unit: '-', significantFigures: 4 },
    cd: { label: 'Drag coefficient', symbol: 'C_D', unit: '-', significantFigures: 4 },
    ld: { label: 'Lift-to-drag ratio', symbol: 'L/D', unit: '-', significantFigures: 3 },
    drag: { label: 'Drag', symbol: 'D', unit: 'N', significantFigures: 4 },
    thrust: { label: 'Thrust required', symbol: 'T', unit: 'N', significantFigures: 4 },
    dynamicPressure: { label: 'Dynamic pressure', symbol: 'q', unit: 'Pa', significantFigures: 4 },
  },
  presets: {
    conventional: {
      mass: 70000, structuralPenalty: 0, area: 300, span: 45, ar: 9, e: 0.8, cd0: 0.02, inducedCorrection: 1, rho: 1.225, velocity: 80,
    },
    bwbOptimistic: {
      mass: 70000, structuralPenalty: 0.05, area: 450, span: 55, ar: 7, e: 0.85, cd0: 0.018, inducedCorrection: 1, rho: 1.225, velocity: 80,
    },
    bwbPenalized: {
      mass: 70000, structuralPenalty: 0.15, area: 450, span: 55, ar: 7, e: 0.85, cd0: 0.018, inducedCorrection: 1, rho: 1.225, velocity: 80,
    },
  },
  compute(inputs: Record<string, number>) {
    const {
      mass = 70000,
      structuralPenalty = 0,
      area = 300,
      ar = 9,
      e = 0.8,
      cd0 = 0.02,
      inducedCorrection = 1,
      rho = 1.225,
      velocity = 80,
    } = inputs;

    const totalMass = mass * (1 + structuralPenalty);
    const weight = totalMass * G;
    const dynamicPressure = 0.5 * rho * velocity * velocity;

    // Guard against division by zero / nonpositive area or density.
    const cl = safeDivide(2 * weight, dynamicPressure * area, 0);
    const k = safeDivide(inducedCorrection, Math.PI * e * ar, 0);
    const cd = cd0 + k * cl * cl;
    const ld = safeDivide(cl, cd, 0);
    const drag = dynamicPressure * area * cd;
    const thrust = drag;

    return {
      totalMass: { value: safeResult(totalMass) },
      weight: { value: safeResult(weight) },
      cl: { value: safeResult(cl) },
      k: { value: safeResult(k) },
      cd: { value: safeResult(cd) },
      ld: { value: safeResult(ld) },
      drag: { value: safeResult(drag) },
      thrust: { value: safeResult(thrust) },
      dynamicPressure: { value: safeResult(dynamicPressure) },
    };
  },
};

export default aircraftPerformanceModel;
