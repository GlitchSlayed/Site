import React, { useEffect, useState, useRef, useId } from 'react';
import { registerParameter, setParameter } from '../../lib/engineering/scopedState';
import { useScopeSnapshot } from '../engineering/shared/useScopedParameter';
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
  const validBounds = Number.isFinite(min) && Number.isFinite(max) && min < max && Number.isFinite(defaultValue) && (step === undefined || (Number.isFinite(step) && step > 0));
  const calculatedStep = step ?? (max - min <= 1 ? 0.01 : max - min <= 10 ? 0.1 : 1);

  const snapshot = useScopeSnapshot(scopeId);
  const [localValue, setLocalValue] = useState(defaultValue);
  const val = scopeId ? snapshot[id] ?? defaultValue : localValue;
  const valueRef = useRef(val);
  const onChangeRef = useRef(onChange);
  valueRef.current = val;
  onChangeRef.current = onChange;
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);
  useEffect(() => {
    if (!validBounds) return;
    if (scopeId) registerParameter(scopeId, id, Math.min(max, Math.max(min, defaultValue)));
    else setLocalValue(defaultValue);
  }, [scopeId, id, defaultValue, validBounds, min, max]);
  const publish = (next: number) => {
    if (!validBounds || !Number.isFinite(next)) return;
    next = Math.min(max, Math.max(min, next));
    valueRef.current = next;
    if (scopeId) setParameter(scopeId, id, next);
    else setLocalValue(next);
    onChangeRef.current?.(next);
  };

  useEffect(() => {
    if (typeof matchMedia === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const pause = () => { if (document.hidden || motion.matches) setIsPlaying(false); };
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) setIsPlaying(false); });
    const control = document.getElementById(inputId);
    if (control) observer.observe(control);
    document.addEventListener('visibilitychange', pause);
    motion.addEventListener('change', pause);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', pause); motion.removeEventListener('change', pause); };
  }, [inputId]);

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

      let next = valueRef.current + directionRef.current * speed * dt;
      if (next >= max) { next = max; directionRef.current = -1; }
      else if (next <= min) { next = min; directionRef.current = 1; }
      publish(Math.round(next * 1000) / 1000);

      animRef.current = requestAnimationFrame(stepAnim);
    };

    animRef.current = requestAnimationFrame(stepAnim);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, min, max, scopeId, id]);

  const handleChange = (newVal: number) => {
    if (isPlaying) setIsPlaying(false);
    publish(newVal);
  };

  const handleReset = () => {
    if (isPlaying) setIsPlaying(false);
    handleChange(defaultValue);
  };

  const isModified = Math.abs(val - defaultValue) > 1e-9;

  if (!validBounds) return <p role="alert">{label}: slider bounds and step must be finite, with max greater than min and step positive.</p>;
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
