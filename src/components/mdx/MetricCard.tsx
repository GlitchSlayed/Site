import React, { useEffect, useState } from 'react';
import { formatNumber } from '../../lib/engineering/format';
import { getParameter, subscribeParameter } from '../../lib/engineering/scopedState';
import { renderMathText } from '../../lib/engineering/formatMath';

export interface MetricCardProps {
  label: string;
  value?: number | string;
  unit?: string;
  symbol?: string;
  baseline?: number;
  better?: 'higher' | 'lower' | 'neutral';
  significantFigures?: number;
  engineering?: boolean;
  description?: string;
  scopeId?: string;
  paramId?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value: staticValue,
  unit = '',
  symbol,
  baseline,
  better = 'neutral',
  significantFigures = 4,
  engineering = false,
  description,
  scopeId,
  paramId,
  className = '',
}) => {
  const [dynamicValue, setDynamicValue] = useState<number | undefined>(() => {
    if (scopeId && paramId) {
      const v = getParameter(scopeId, paramId);
      if (typeof v === 'number') return v;
    }
    return undefined;
  });

  useEffect(() => {
    if (!scopeId || !paramId) return;

    const unsubscribe = subscribeParameter(scopeId, (id, val) => {
      if (id === paramId) {
        setDynamicValue(val);
      }
    });

    return unsubscribe;
  }, [scopeId, paramId]);

  const rawValue = dynamicValue !== undefined ? dynamicValue : staticValue;

  // Format value display
  let formattedValue = '—';
  let numericValue: number | null = null;

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    numericValue = rawValue;
    formattedValue = formatNumber(rawValue, {
      sigFigs: significantFigures,
      engineering,
      thousands: true,
    });
  } else if (typeof rawValue === 'string') {
    formattedValue = rawValue;
  }

  // Calculate delta percentage if baseline is provided
  let deltaPercent: number | null = null;
  let deltaDirection: 'positive' | 'negative' | 'zero' = 'zero';

  if (numericValue !== null && baseline !== undefined && baseline !== 0 && Number.isFinite(baseline)) {
    deltaPercent = ((numericValue - baseline) / Math.abs(baseline)) * 100;
    if (Math.abs(deltaPercent) < 0.05) {
      deltaDirection = 'zero';
    } else {
      deltaDirection = deltaPercent > 0 ? 'positive' : 'negative';
    }
  }

  // Determine delta color status
  let deltaStatus = 'neutral';
  if (deltaDirection !== 'zero') {
    if (better === 'higher') {
      deltaStatus = deltaDirection === 'positive' ? 'good' : 'bad';
    } else if (better === 'lower') {
      deltaStatus = deltaDirection === 'positive' ? 'bad' : 'good';
    }
  }

  return (
    <div className={`eng-metric-card ${className}`}>
      <div className="eng-metric-header">
        {symbol && <span className="eng-metric-symbol">{renderMathText(symbol)}</span>}
        <span className="eng-metric-label">{renderMathText(label)}</span>
      </div>

      <div className="eng-metric-body">
        <span className="eng-metric-val">{formattedValue}</span>
        {unit && unit !== '-' && <span className="eng-metric-unit">{renderMathText(unit)}</span>}
      </div>

      <div className="eng-metric-footer">
        {deltaPercent !== null && (
          <span className={`eng-metric-delta status-${deltaStatus}`}>
            {deltaPercent > 0 ? '+' : ''}
            {deltaPercent.toFixed(1)}%
            <span className="eng-metric-delta-ref"> vs baseline</span>
          </span>
        )}
        {description && <span className="eng-metric-desc">{description}</span>}
      </div>
    </div>
  );
};

export default MetricCard;
