// Lift equation model: L = 1/2 * rho * V^2 * S * C_L
import type { EngineeringModel } from '../../types';
import { safeResult } from '../../validation';

export const liftModel: EngineeringModel = {
  id: 'aerodynamics.lift',
  title: 'Lift Equation',
  description: 'Compute lift for steady flight from density, velocity, wing area, and lift coefficient.',
  assumptions: [
    'Steady, level flight.',
    'Incompressible flow (low subsonic).',
    'C_L and area referenced to the same planform area.',
  ],
  limitations: [
    'Does not account for compressibility, viscosity, or high-angle-of-attack stall.',
    'C_L must be supplied; it is not predicted by this model.',
  ],
  parameters: [
    {
      id: 'rho',
      label: 'Air density',
      symbol: 'ρ',
      unit: 'kg/m³',
      min: 0.01,
      max: 2.0,
      step: 0.01,
      defaultValue: 1.225,
      description: 'Freestream air density. ISA sea level is approximately 1.225 kg/m³.',
    },
    {
      id: 'velocity',
      label: 'Velocity',
      symbol: 'V',
      unit: 'm/s',
      min: 1,
      max: 500,
      step: 1,
      defaultValue: 50,
      description: 'Freestream airspeed.',
    },
    {
      id: 'area',
      label: 'Wing reference area',
      symbol: 'S',
      unit: 'm²',
      min: 0.1,
      max: 10000,
      step: 0.1,
      defaultValue: 20,
    },
    {
      id: 'cl',
      label: 'Lift coefficient',
      symbol: 'C_L',
      unit: '-',
      min: 0,
      max: 5,
      step: 0.01,
      defaultValue: 0.5,
    },
  ],
  outputs: {
    lift: { label: 'Lift', symbol: 'L', unit: 'N', significantFigures: 4 },
  },
  compute(inputs) {
    const { rho = 1.225, velocity = 50, area = 20, cl = 0.5 } = inputs;
    const lift = 0.5 * rho * velocity * velocity * area * cl;
    return { lift: { value: safeResult(lift) } };
  },
};

export default liftModel;
