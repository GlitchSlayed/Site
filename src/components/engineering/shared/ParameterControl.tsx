// Reusable parameter control: slider and numeric input stay synchronized.
import { useId, useRef, useState } from 'react';
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
  const [inputValue, setInputValue] = useState(() => formatValue(param, value));
  const inputRef = useRef<HTMLInputElement>(null);
  // Unique per-instance DOM id so multiple ParameterSets on a page never collide,
  // while scopeId+paramId still shares the underlying parameter state.
  const uid = useId().replace(/:/g, '-');

  // Synchronize local input string when external value changes and user isn't typing
  if (!editing && inputValue !== formatValue(param, value)) {
    setInputValue(formatValue(param, value));
  }

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value);
    // Convert slider position back from log space when logarithmic scaling is active.
    const next = param.scale === 'log' ? Math.pow(10, raw) : raw;
    setValue(next);
    setInputValue(formatValue(param, next));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setInputValue(raw);
    const num = Number(raw);
    if (!Number.isNaN(num) && Number.isFinite(num) && num >= param.min && num <= param.max) {
      setValue(num);
    }
  };

  const handleInputBlur = () => {
    setEditing(false);
    const next = sanitizeInput(inputValue, param);
    setValue(next);
    setInputValue(formatValue(param, next));
  };

  const handleInputFocus = () => {
    setEditing(true);
    setInputValue(value.toString());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  const handleReset = () => {
    setValue(param.defaultValue);
    setInputValue(formatValue(param, param.defaultValue));
  };

  const scaledMin = param.scale === 'log' ? Math.log10(param.min) : param.min;
  const scaledMax = param.scale === 'log' ? Math.log10(param.max) : param.max;
  const scaledValue = param.scale === 'log' ? Math.log10(Math.max(value, 1e-9)) : value;

  return (
    <div className="eng-parameter-control" role="group" aria-label={param.label}>
      <label className="eng-parameter-label" htmlFor={`eng-input-${uid}-${param.id}`}>
        {param.label}
        {param.symbol && <span className="eng-parameter-symbol"> ({param.symbol})</span>}
        {param.unit && <span className="eng-parameter-unit">[{param.unit}]</span>}
      </label>
      <div className="eng-parameter-inputs">
        <input
          type="range"
          min={String(scaledMin)}
          max={String(scaledMax)}
          step={String(param.scale === 'log' ? 0.01 : param.step)}
          value={String(scaledValue)}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-valuenow={value}
          aria-valuemin={param.min}
          aria-valuemax={param.max}
          aria-label={`${param.label} slider`}
        />
        <input
          ref={inputRef}
          id={`eng-input-${uid}-${param.id}`}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
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
