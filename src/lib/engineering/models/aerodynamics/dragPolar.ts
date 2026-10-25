// Parabolic drag polar model: C_D = C_D,0 + k * C_L^2, k = 1 / (pi * e * AR)
import type { EngineeringModel } from '../../types';
import { safeDivide, safeResult } from '../../validation';

export const dragPolarModel: EngineeringModel = {
  id: 'aerodynamics.dragPolar',
  title: 'Drag Polar',
  description: 'Compute drag coefficient from a simplified parabolic drag polar.',
  assumptions: [
    'Parabolic drag polar: C_D = C_D,0 + k * C_L^2.',
    'Induced-drag factor k = 1 / (pi * e * AR).',
    'Oswald efficiency e and aspect ratio AR are constant.',
  ],
  limitations: [
    'Low-order approximation; does not capture transonic, compressibility, or viscous effects.',
    'Valid near the design lift coefficient only.',
  ],
  parameters: [
    {
      id: 'cd0',
      label: 'Zero-lift drag coefficient',
      symbol: 'C_D,0',
      unit: '-',
      min: 0.0,
      max: 0.2,
      step: 0.001,
      defaultValue: 0.02,
      scale: 'linear',
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
      id: 'ar',
      label: 'Aspect ratio',
      symbol: 'AR',
      unit: '-',
      min: 1,
      max: 40,
      step: 0.5,
      defaultValue: 10,
    },
    {
      id: 'cl',
      label: 'Lift coefficient',
      symbol: 'C_L',
      unit: '-',
      min: -2,
      max: 5,
      step: 0.01,
      defaultValue: 0.5,
    },
  ],
  outputs: {
    cd: { label: 'Drag coefficient', symbol: 'C_D', unit: '-', significantFigures: 4 },
    k: { label: 'Induced-drag factor', symbol: 'k', unit: '-', significantFigures: 4 },
  },
  compute(inputs) {
    const { cd0 = 0.02, e = 0.8, ar = 10, cl = 0.5 } = inputs;
    const k = safeDivide(1, Math.PI * e * ar, 0);
    const cd = cd0 + k * cl * cl;
    return { cd: { value: safeResult(cd) }, k: { value: safeResult(k) } };
  },
};

export default dragPolarModel;
