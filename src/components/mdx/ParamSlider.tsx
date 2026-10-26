import React, { useEffect, useState, useId } from 'react';
import { getParameter, setParameter, subscribeParameter } from '../../lib/engineering/scopedState';

export interface ParamSliderProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  unit?: string;
  symbol?: string;
  scopeId?: string;
  onChange?: (val: number) => void;
  className?: string;
}

export const ParamSlider: React.FC<ParamSliderProps> = ({
  id,
  label,
  min,
  max,
  step,
  defaultValue,
  unit = '',
  symbol,
  scopeId,
  onChange,
  className = '',
}) => {
  const inputId = useId();
  const calculatedStep = step ?? (max - min <= 1 ? 0.01 : max - min <= 10 ? 0.1 : 1);

  // Initialize value from scoped state or defaultValue
  const [val, setVal] = useState<number>(() => {
    if (scopeId) {
      const existing = getParameter(scopeId, id);
      if (typeof existing === 'number') return existing;
    }
    return defaultValue;
  });

  // Keep in sync with scoped state if another controller modifies this param
  useEffect(() => {
    if (!scopeId) return;

    // Set initial value in scope
    setParameter(scopeId, id, val);

    const unsubscribe = subscribeParameter(scopeId, (paramId, newVal) => {
      if (paramId === id) {
        setVal(newVal);
      }
    });

    return unsubscribe;
  }, [scopeId, id]);

  const handleChange = (newVal: number) => {
    setVal(newVal);
    if (scopeId) {
      setParameter(scopeId, id, newVal);
    }
    onChange?.(newVal);
  };

  const handleReset = () => {
    handleChange(defaultValue);
  };

  const isModified = Math.abs(val - defaultValue) > 1e-9;

  return (
    <div className={`eng-param-slider ${className}`}>
      <div className="eng-param-slider-header">
        <label htmlFor={inputId} className="eng-param-label">
          {symbol && <span className="eng-param-symbol">{symbol}</span>}
          <span className="eng-param-name">{label}</span>
        </label>
        <div className="eng-param-value-container">
          <span className="eng-param-val-badge">
            {val}
            {unit ? <span className="eng-param-unit"> {unit}</span> : null}
          </span>
          {isModified && (
            <button
              type="button"
              onClick={handleReset}
              className="eng-param-reset-btn"
              title={`Reset to default (${defaultValue})`}
              aria-label={`Reset ${label} to ${defaultValue}`}
            >
              ↺
            </button>
          )}
        </div>
      </div>

      <div className="eng-param-slider-track">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={calculatedStep}
          value={val}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className="eng-param-input-range"
        />
        <div className="eng-param-range-bounds">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
};

export default ParamSlider;
