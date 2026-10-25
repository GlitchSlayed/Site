// Preset selector: applies a named configuration of parameter values.
import { useState } from 'react';
import type { EngineeringModel } from '../../../lib/engineering/types';
import { setParameter } from '../../../lib/engineering/scopedState';

interface PresetSelectorProps {
  model: EngineeringModel;
  scopeId: string;
  label?: string;
}

export function PresetSelector({ model, scopeId, label = 'Preset' }: PresetSelectorProps) {
  const presets = model.presets;
  const presetIds = presets ? Object.keys(presets) : [];
  const [active, setActive] = useState<string | null>(null);

  if (presetIds.length === 0) return null;

    const handleApply = (presetId: string) => {
      const values = presets![presetId];
    if (!values) return;
    for (const [paramId, value] of Object.entries(values)) {
      const param = model.parameters.find((p) => p.id === paramId);
      if (param && value !== undefined) {
        // eslint-disable-next-line no-restricted-globals
        setParameter(scopeId, paramId, Number(value));
      }
    }
    setActive(presetId);
  };

  return (
    <div className="eng-preset-selector" role="group" aria-label={label}>
      <span className="eng-preset-label">{label}</span>
      <select
        value={active || ''}
        onChange={(event) => handleApply(event.target.value)}
        aria-label="Select preset configuration"
      >
        <option value="">—</option>
        {presetIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          for (const param of model.parameters) {
            setParameter(scopeId, param.id, param.defaultValue);
          }
          setActive(null);
        }}
        aria-label="Reset all parameters to defaults"
      >
        Reset
      </button>
    </div>
  );
}
