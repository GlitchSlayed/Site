// Reusable parameter control: slider and numeric input stay synchronized.
import { useRef, useState } from 'react';
import type { EngineeringParameter } from '../../../lib/engineering/types';
import { sanitizeInput } from '../../../lib/engineering/validation';
import { useScopedParameter } from './useScopedParameter';

interface ParameterControlProps {
  param: EngineeringParameter;
  scopeId: string;
  disabled?: boolean;
}

export function ParameterControl({ param, scopeId, disabled = false }: ParameterControlProps) {
  const [value, setValue] = useScopedParameter({
    scopeId,
    paramId: param.id,
    defaultValue: param.defaultValue,
  });

  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(Number(event.target.value));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeInput(event.target.value, param);
    setValue(next);
  };

  const handleInputBlur = () => {
    setEditing(false);
  };

  const handleInputFocus = () => {
    setEditing(true);
  };

  const handleReset = () => {
    setValue(param.defaultValue);
  };

  const scaledMin = param.scale === 'log' ? Math.log10(param.min) : param.min;
  const scaledMax = param.scale === 'log' ? Math.log10(param.max) : param.max;
  const scaledValue = param.scale === 'log' ? Math.log10(Math.max(value, 1e-9)) : value;

  return (
    <div className="eng-parameter-control" role="group" aria-label={param.label}>
      <label className="eng-parameter-label" htmlFor={`eng-input-${param.id}`}>
        {param.label}
        {param.symbol && <span className="eng-parameter-symbol"> ({param.symbol})</span>}
        {param.unit && <span className="eng-parameter-unit">[{param.unit}]</span>}
      </label>
      <div className="eng-parameter-inputs">
        <input
          ref={inputRef}
          type="range"
          min={String(scaledMin)}
          max={String(scaledMax)}
          step={String(param.scale === 'log' ? 0.1 : param.step)}
          value={String(scaledValue)}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-valuenow={value}
          aria-valuemin={param.min}
          aria-valuemax={param.max}
          aria-label={`${param.label} slider`}
        />
        <input
          id={`eng-input-${param.id}`}
          type="text"
          value={editing ? value.toString() : formatValue(param, value)}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          disabled={disabled}
          spellCheck={false}
          aria-label={`${param.label} value`}
        />
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          aria-label={`Reset ${param.label} to default`}
        >
          ↺
        </button>
      </div>
      {param.description && <p className="eng-parameter-description">{param.description}</p>}
    </div>
  );
}

function formatValue(param: EngineeringParameter, value: number): string {
  if (param.scale === 'log') return value.toExponential(3);
  return Number.isInteger(value) ? value.toString() : value.toFixed(3);
}
