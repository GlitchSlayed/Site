// Central registry of engineering models. Models are pure calculation logic;
// rendering components depend only on this registry and the model type.
import type { EngineeringModel } from './types';
import { liftModel } from './models/aerodynamics/lift';
import { dragPolarModel } from './models/aerodynamics/dragPolar';
import { aircraftPerformanceModel } from './models/aircraft-performance/bwb';

const models: Record<string, EngineeringModel> = {
  [liftModel.id]: liftModel,
  [dragPolarModel.id]: dragPolarModel,
  [aircraftPerformanceModel.id]: aircraftPerformanceModel,
};

export function getModel(id: string): EngineeringModel | undefined {
  return models[id];
}

export function listModels(): EngineeringModel[] {
  return Object.values(models);
}

export function getPreset(modelId: string, presetId: string): Record<string, number> | undefined {
  const model = getModel(modelId);
  if (!model || !model.presets) return undefined;
  return model.presets[presetId] as Record<string, number> | undefined;
}

export function listPresets(modelId: string): string[] {
  const model = getModel(modelId);
  if (!model || !model.presets) return [];
  return Object.keys(model.presets);
}

export { liftModel, dragPolarModel, aircraftPerformanceModel };

// Register plot definitions so they are available to ModelEngineeringPlot.
import './plots/definitions';
