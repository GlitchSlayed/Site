import React, { useEffect, useState, useRef, useId } from 'react';
import { getParameter, setParameter, subscribeParameter } from '../../lib/engineering/scopedState';
import { renderMathText } from '../../lib/engineering/formatMath';

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
  animate?: boolean;
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
  animate = false,
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

  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);

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

  // Handle animation sweep loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const sweepDuration = 4; // seconds for full range
    const speed = (max - min) / sweepDuration;

    const stepAnim = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      setVal((prev) => {
        let next = prev + directionRef.current * speed * dt;
        if (next >= max) {
          next = max;
          directionRef.current = -1;
        } else if (next <= min) {
          next = min;
          directionRef.current = 1;
        }

        // Round to 3 decimal places to keep value clean
        const rounded = Math.round(next * 1000) / 1000;
        if (scopeId) {
          setParameter(scopeId, id, rounded);
        }
        onChange?.(rounded);
        return rounded;
      });

      animRef.current = requestAnimationFrame(stepAnim);
    };

    animRef.current = requestAnimationFrame(stepAnim);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, min, max, scopeId, id, onChange]);

  const handleChange = (newVal: number) => {
    if (isPlaying) setIsPlaying(false);
    setVal(newVal);
    if (scopeId) {
      setParameter(scopeId, id, newVal);
    }
    onChange?.(newVal);
  };

  const handleReset = () => {
    if (isPlaying) setIsPlaying(false);
    handleChange(defaultValue);
  };

  const isModified = Math.abs(val - defaultValue) > 1e-9;

  return (
    <div className={`eng-param-slider ${className}`}>
      <div className="eng-param-slider-header">
        <label htmlFor={inputId} className="eng-param-label">
          {symbol && <span className="eng-param-symbol">{renderMathText(symbol)}</span>}
          <span className="eng-param-name">{renderMathText(label)}</span>
        </label>
        <div className="eng-param-value-container">
          <span className="eng-param-val-badge">
            {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(calculatedStep < 0.1 ? 2 : 1)) : val}
            {unit ? <span className="eng-param-unit"> {renderMathText(unit)}</span> : null}
          </span>
          {animate && (
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`eng-param-play-btn ${isPlaying ? 'playing' : ''}`}
              data-tooltip={isPlaying ? 'Pause sweep' : 'Auto sweep'}
              data-tooltip-subtitle="Continuously oscillate parameter"
              data-tooltip-pos="top"
              aria-label={isPlaying ? 'Pause sweep' : 'Play sweep'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}
          {isModified && (
            <button
              type="button"
              onClick={handleReset}
              className="eng-param-reset-btn"
              data-tooltip="Reset value"
              data-tooltip-subtitle={`Default: ${defaultValue}${unit ? ' ' + unit : ''}`}
              data-tooltip-pos="top"
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
