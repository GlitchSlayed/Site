import React, { useEffect, useRef, useState, useMemo } from 'react';
import { interpolateColormap, type ColormapName } from '../../lib/engineering/colormaps';
import { formatNumber } from '../../lib/engineering/format';

export interface HeatmapPlotProps {
  /** 2D grid of numbers where data[rowIndex][colIndex] is the scalar value (Y, X) */
  data: number[][];
  xDomain?: [number, number];
  yDomain?: [number, number];
  zRange?: [number, number];
  colormap?: ColormapName;
  title?: string;
  description?: string;
  xLabel?: string;
  xUnit?: string;
  yLabel?: string;
  yUnit?: string;
  zLabel?: string;
  zUnit?: string;
  height?: number;
  interpolate?: boolean;
  className?: string;
}

export const HeatmapPlot: React.FC<HeatmapPlotProps> = ({
  data,
  xDomain = [0, 1],
  yDomain = [0, 1],
  zRange,
  colormap = 'viridis',
  title,
  description,
  xLabel = 'X',
  xUnit = '',
  yLabel = 'Y',
  yUnit = '',
  zLabel = 'Z',
  zUnit = '',
  height = 340,
  interpolate = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorbarCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    xVal: number;
    yVal: number;
    zVal: number;
    pixelX: number;
    pixelY: number;
  } | null>(null);

  // Compute rows, cols, and min/max z value
  const numRows = data.length;
  const numCols = data[0]?.length || 0;

  const [minZ, maxZ] = useMemo(() => {
    if (zRange) return zRange;
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < numRows; r++) {
      const row = data[r];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max) || max === min) max = min + 1;
    return [min, max];
  }, [data, zRange, numRows, numCols]);

  // Render heatmap canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || numRows === 0 || numCols === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create an offscreen buffer at exact grid resolution
    const offscreen = document.createElement('canvas');
    offscreen.width = numCols;
    offscreen.height = numRows;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(numCols, numRows);
    const zSpan = maxZ - minZ || 1;

    for (let r = 0; r < numRows; r++) {
      // row 0 is top or bottom? In standard mathematical plots, yDomain[0] is bottom
      // Let's render r=0 at the bottom (math Cartesian standard)
      const dataRow = numRows - 1 - r;
      for (let c = 0; c < numCols; c++) {
        const val = data[dataRow][c];
        const norm = Math.max(0, Math.min(1, (val - minZ) / zSpan));
        const [R, G, B] = interpolateColormap(norm, colormap);

        const pixelIndex = (r * numCols + c) * 4;
        imgData.data[pixelIndex] = R;
        imgData.data[pixelIndex + 1] = G;
        imgData.data[pixelIndex + 2] = B;
        imgData.data[pixelIndex + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Draw scaled onto main canvas
    ctx.imageSmoothingEnabled = interpolate;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }, [data, numRows, numCols, minZ, maxZ, colormap, interpolate]);

  // Render colorbar
  useEffect(() => {
    const cbCanvas = colorbarCanvasRef.current;
    if (!cbCanvas) return;
    const ctx = cbCanvas.getContext('2d');
    if (!ctx) return;

    const h = cbCanvas.height;
    const w = cbCanvas.width;
    const imgData = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      // top of colorbar is 1.0 (max), bottom is 0.0 (min)
      const norm = 1 - y / (h - 1);
      const [R, G, B] = interpolateColormap(norm, colormap);
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        imgData.data[idx] = R;
        imgData.data[idx + 1] = G;
        imgData.data[idx + 2] = B;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [colormap]);

  // Mouse move handler for hover tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || numRows === 0 || numCols === 0) return;

    const rect = canvas.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      setHoverInfo(null);
      return;
    }

    const colIndex = Math.min(numCols - 1, Math.max(0, Math.floor(xRatio * numCols)));
    // Invert Y so bottom is 0
    const rowIndex = Math.min(numRows - 1, Math.max(0, Math.floor((1 - yRatio) * numRows)));

    const zVal = data[rowIndex]?.[colIndex] ?? 0;
    const xVal = xDomain[0] + xRatio * (xDomain[1] - xDomain[0]);
    const yVal = yDomain[0] + (1 - yRatio) * (yDomain[1] - yDomain[0]);

    setHoverInfo({
      xVal,
      yVal,
      zVal,
      pixelX: e.clientX - rect.left,
      pixelY: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  return (
    <div className={`eng-heatmap-container ${className}`}>
      {(title || description) && (
        <div className="eng-heatmap-header">
          {title && <h4 className="eng-heatmap-title">{title}</h4>}
          {description && <p className="eng-heatmap-desc">{description}</p>}
        </div>
      )}

      <div className="eng-heatmap-main" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Y Axis Label */}
        <div className="eng-heatmap-y-axis">
          <span className="axis-title-vertical">
            {yLabel} {yUnit ? `[${yUnit}]` : ''}
          </span>
          <div className="y-ticks">
            <span>{formatNumber(yDomain[1], { sigFigs: 3 })}</span>
            <span>{formatNumber(yDomain[0], { sigFigs: 3 })}</span>
          </div>
        </div>

        {/* Heatmap Area */}
        <div className="eng-heatmap-canvas-wrapper" ref={containerRef} style={{ position: 'relative', flex: 1 }}>
          <canvas
            ref={canvasRef}
            width={600}
            height={height}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="eng-heatmap-canvas"
            style={{ width: '100%', height: `${height}px`, display: 'block', borderRadius: '4px' }}
          />

          {/* Hover Crosshair & Tooltip */}
          {hoverInfo && (
            <div
              className="eng-heatmap-tooltip"
              style={{
                position: 'absolute',
                left: `${Math.min(hoverInfo.pixelX + 12, 450)}px`,
                top: `${Math.max(hoverInfo.pixelY - 36, 10)}px`,
                pointerEvents: 'none',
              }}
            >
              <div>
                <strong>{zLabel}:</strong> {formatNumber(hoverInfo.zVal, { sigFigs: 4 })} {zUnit}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                ({xLabel}: {formatNumber(hoverInfo.xVal, { sigFigs: 3 })}, {yLabel}:{' '}
                {formatNumber(hoverInfo.yVal, { sigFigs: 3 })})
              </div>
            </div>
          )}

          {/* X Axis Label */}
          <div className="eng-heatmap-x-axis">
            <div className="x-ticks">
              <span>{formatNumber(xDomain[0], { sigFigs: 3 })}</span>
              <span>{formatNumber(xDomain[1], { sigFigs: 3 })}</span>
            </div>
            <div className="axis-title-horizontal">
              {xLabel} {xUnit ? `[${xUnit}]` : ''}
            </div>
          </div>
        </div>

        {/* Colorbar */}
        <div className="eng-heatmap-colorbar">
          <div className="cb-ticks">
            <span>{formatNumber(maxZ, { sigFigs: 3 })}</span>
            <span>{formatNumber((minZ + maxZ) / 2, { sigFigs: 3 })}</span>
            <span>{formatNumber(minZ, { sigFigs: 3 })}</span>
          </div>
          <canvas
            ref={colorbarCanvasRef}
            width={16}
            height={height}
            style={{ width: '16px', height: `${height}px`, borderRadius: '3px' }}
          />
          <div className="cb-label">
            {zLabel} {zUnit ? `[${zUnit}]` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapPlot;
