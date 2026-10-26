// Preset selector: applies a named configuration of parameter values.
import { useState } from 'react';
import type { EngineeringModel } from '../../../lib/engineering/types';
import { setParameter } from '../../../lib/engineering/scopedState';

interface PresetSelectorProps {
  model: EngineeringModel;
  scopeId: string;
  label?: string;
}

const PRESET_LABELS: Record<string, string> = {
  conventional: 'Conventional Reference',
  bwbOptimistic: 'BWB Optimistic (+5% mass)',
  bwbPenalized: 'BWB Penalized (+15% mass)',
};

function formatPresetLabel(id: string): string {
  return PRESET_LABELS[id] || id.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export function PresetSelector({ model, scopeId, label = 'Configuration' }: PresetSelectorProps) {
  const presets = model.presets;
  const presetIds = presets ? Object.keys(presets) : [];
  const [active, setActive] = useState<string | null>(presetIds[0] ?? null);

  if (presetIds.length === 0) return null;

  const handleApply = (presetId: string) => {
    const values = presets![presetId];
    if (!values) return;
    for (const [paramId, value] of Object.entries(values)) {
      const param = model.parameters.find((p) => p.id === paramId);
      if (param && value !== undefined) {
        setParameter(scopeId, paramId, Number(value));
      }
    }
    setActive(presetId);
  };

  return (
    <div className="eng-preset-selector" role="group" aria-label={label}>
      <div className="eng-preset-header">
        <span className="eng-preset-label">{label}</span>
        <button
          type="button"
          className="eng-preset-reset"
          onClick={() => {
            for (const param of model.parameters) {
              setParameter(scopeId, param.id, param.defaultValue);
            }
            setActive(presetIds[0] ?? null);
          }}
          aria-label="Reset all parameters to defaults"
        >
          ↺ Reset
        </button>
      </div>
      <div className="eng-preset-pills" role="tablist">
        {presetIds.map((id) => (
          <button
            key={id}
            type="button"
            className={`eng-preset-pill ${active === id ? 'eng-preset-pill-active' : ''}`}
            onClick={() => handleApply(id)}
            role="tab"
            aria-selected={active === id}
          >
            {formatPresetLabel(id)}
          </button>
        ))}
      </div>
    </div>
  );
}
