import React, { useState } from 'react';
import { ParamSlider } from './ParamSlider';
import { setParameter } from '../../lib/engineering/scopedState';
import { renderMathText } from '../../lib/engineering/formatMath';

export interface ParamDefinition {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  unit?: string;
  symbol?: string;
  animate?: boolean;
}

export interface ParamPlaygroundProps {
  scopeId: string;
  parameters: ParamDefinition[];
  presets?: Record<string, Record<string, number>>;
  title?: string;
  description?: string;
  animate?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const ParamPlayground: React.FC<ParamPlaygroundProps> = ({
  scopeId,
  parameters,
  presets,
  title = 'Interactive Parameters',
  description,
  animate = false,
  children,
  className = '',
}) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (presetName: string, values: Record<string, number>) => {
    setActivePreset(presetName);
    Object.entries(values).forEach(([paramId, val]) => {
      setParameter(scopeId, paramId, val);
    });
  };

  const handleResetAll = () => {
    setActivePreset(null);
    parameters.forEach((param) => {
      setParameter(scopeId, param.id, param.defaultValue);
    });
  };

  return (
    <div className={`eng-param-playground ${className}`}>
      <div className="eng-playground-header">
        <div>
          <h4 className="eng-playground-title">{renderMathText(title)}</h4>
          {description && <p className="eng-playground-desc">{description}</p>}
        </div>
        <button
          type="button"
          onClick={handleResetAll}
          className="eng-playground-reset-all"
          title="Reset all parameters to defaults"
        >
          Reset All
        </button>
      </div>

      {presets && Object.keys(presets).length > 0 && (
        <div className="eng-playground-presets">
          <span className="eng-preset-label">Presets:</span>
          <div className="eng-preset-buttons">
            {Object.entries(presets).map(([name, values]) => (
              <button
                key={name}
                type="button"
                className={`eng-preset-chip ${activePreset === name ? 'active' : ''}`}
                onClick={() => applyPreset(name, values)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="eng-playground-grid">
        {parameters.map((param) => (
          <ParamSlider
            key={param.id}
            id={param.id}
            label={param.label}
            min={param.min}
            max={param.max}
            step={param.step}
            defaultValue={param.defaultValue}
            unit={param.unit}
            symbol={param.symbol}
            animate={param.animate ?? animate}
            scopeId={scopeId}
          />
        ))}
      </div>

      {children && <div className="eng-playground-children">{children}</div>}
    </div>
  );
};

export default ParamPlayground;
