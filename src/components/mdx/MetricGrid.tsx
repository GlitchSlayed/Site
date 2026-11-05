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

    >
      {children}
    </div>
  );
};

export default MetricGrid;
