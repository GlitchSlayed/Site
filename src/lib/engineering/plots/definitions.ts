// Plot definitions for the aircraft performance model, wired to the registry.
import type { PlotAxis } from '../types';
import { aircraftPerformanceModel } from '../models/aircraft-performance/bwb';
import { registerPlotDefinition } from './registry';
import { dragPolarModel } from '../models/aerodynamics/dragPolar';

const xAxisSpeed: PlotAxis = {
  title: 'Airspeed',
  unit: 'm/s',
  type: 'linear',
  range: [40, 200],
};

const yAxisCoefficient: PlotAxis = {
  title: 'Drag coefficient',
  unit: '-',
  type: 'linear',
};

const yAxisLD: PlotAxis = {
  title: 'Lift-to-drag ratio',
  unit: '-',
  type: 'linear',
};

const yAxisForce: PlotAxis = {
  title: 'Drag / Thrust required',
  unit: 'N',
  type: 'linear',
};

// Drag polar: sweep C_L, plot C_D
registerPlotDefinition({
  id: 'aircraft.dragPolar',
  modelId: aircraftPerformanceModel.id,
  title: 'Drag Polar Comparison',
  description: 'C_D = C_D,0 + k·C_L² across lift coefficient.',
  sweepParam: 'cl',
  xRange: [0.1, 2.0],
  xAxis: { title: 'Lift coefficient', unit: '-', type: 'linear', range: [0.1, 2.0] },
  yAxis: yAxisCoefficient,
  series: [{ outputId: 'cd', label: 'Drag coefficient C_D', mode: 'lines' }],
  xSamples: 200,
});

// L/D vs airspeed
registerPlotDefinition({
  id: 'aircraft.ldVsSpeed',
  modelId: aircraftPerformanceModel.id,
  title: 'L/D versus Airspeed',
  description: 'L/D = C_L / C_D across airspeed in steady, level flight.',
  sweepParam: 'velocity',
  xRange: [40, 200],
  xAxis: xAxisSpeed,
  yAxis: yAxisLD,
  series: [{ outputId: 'ld', label: 'Lift-to-drag ratio L/D', mode: 'lines' }],
  xSamples: 200,
});

// Thrust required vs airspeed
registerPlotDefinition({
  id: 'aircraft.thrustVsSpeed',
  modelId: aircraftPerformanceModel.id,
  title: 'Thrust Required versus Airspeed',
  description: 'T = D = ½ρV²SC_D across airspeed.',
  sweepParam: 'velocity',
  xRange: [40, 200],
  xAxis: xAxisSpeed,
  yAxis: yAxisForce,
  series: [{ outputId: 'thrust', label: 'Thrust required', mode: 'lines' }],
  xSamples: 200,
});

// L/D vs structural mass penalty
registerPlotDefinition({
  id: 'aircraft.ldVsMassPenalty',
  modelId: aircraftPerformanceModel.id,
  title: 'L/D versus Structural Mass Penalty',
  description: 'Sensitivity of L/D to an illustrative structural-mass penalty (Δm/m).',
  sweepParam: 'structuralPenalty',
  xRange: [0, 0.6],
  xAxis: { title: 'Structural mass penalty', unit: '-', type: 'linear', range: [0, 0.6] },
  yAxis: yAxisLD,
  series: [{ outputId: 'ld', label: 'Lift-to-drag ratio L/D', mode: 'lines' }],
  xSamples: 200,
});

// Drag polar uses the standalone dragPolarModel for a focused C_D vs C_L view.
registerPlotDefinition({
  id: 'aerodynamics.dragPolar',
  modelId: dragPolarModel.id,
  title: 'Drag Polar (C_D vs C_L)',
  description: 'C_D = C_D,0 + k·C_L², k = 1/(π·e·AR).',
  sweepParam: 'cl',
  xRange: [-1, 2.5],
  xAxis: { title: 'Lift coefficient', unit: '-', type: 'linear', range: [-1, 2.5] },
  yAxis: yAxisCoefficient,
  series: [{ outputId: 'cd', label: 'Drag coefficient C_D', mode: 'lines' }],
  xSamples: 200,
});

export { aircraftPerformanceModel };
