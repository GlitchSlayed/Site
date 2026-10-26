import React from 'react';

export interface MetricGridProps {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export const MetricGrid: React.FC<MetricGridProps> = ({
  columns = 3,
  children,
  className = '',
}) => {
  return (
    <div
      className={`eng-metric-grid cols-${columns} ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 2 ? '240px' : '180px'}, 1fr))`,
        gap: '0.875rem',
        margin: '1.25rem 0',
      }}
    >
      {children}
    </div>
  );
};

export default MetricGrid;
