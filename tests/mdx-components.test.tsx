// @ts-ignore - jsdom ships no type declarations in this project.
import { JSDOM } from 'jsdom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { linspace, compileExpression, sweepFunction } from '../src/lib/engineering/evaluator';
import { interpolateColormap, getSeriesColor, COLORMAPS } from '../src/lib/engineering/colormaps';
import { setParameter, getParameter, subscribeParameter, clearScope } from '../src/lib/engineering/scopedState';
import { MetricCard } from '../src/components/mdx/MetricCard';
import { DataTable } from '../src/components/mdx/DataTable';
import { ParamSlider } from '../src/components/mdx/ParamSlider';
import { ParamPlayground } from '../src/components/mdx/ParamPlayground';
import { HeatmapPlot } from '../src/components/mdx/HeatmapPlot';
import { NotebookCell } from '../src/components/mdx/NotebookCell';

// ---------------------------------------------------------------------------
// jsdom environment setup for MDX component tests
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
});

const win = dom.window as unknown as Window & typeof globalThis;
const doc = win.document;

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof win !== 'undefined') {
  (win as any).IS_REACT_ACT_ENVIRONMENT = true;
}
globalThis.window = win;
globalThis.document = doc;
globalThis.Event = win.Event;
globalThis.MouseEvent = win.MouseEvent;
globalThis.KeyboardEvent = win.KeyboardEvent;
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true });
(globalThis as any).URL.createObjectURL = () => 'blob:mock-url';
(globalThis as any).URL.revokeObjectURL = () => {};

describe('Evaluator & Math Engine', () => {
  it('linspace generates correct range and spacing', () => {
    const pts = linspace(0, 10, 5);
    expect(pts).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('compileExpression evaluates standard mathematical operations', () => {
    const fn1 = compileExpression('2 * x + 5');
    expect(fn1(3)).toBe(11);

    const fn2 = compileExpression('sin(x)^2 + cos(x)^2');
    expect(fn2(1.23)).toBeCloseTo(1.0, 5);

    const fn3 = compileExpression('sqrt(x) + abs(y)', ['x', 'y']);
    expect(fn3(16, { y: -9 })).toBe(13);
  });

  it('compileExpression safely blocks dangerous global identifiers', () => {
    expect(() => compileExpression('window.location')).toThrow();
    expect(() => compileExpression('process.exit()')).toThrow();
    expect(() => compileExpression('document.cookie')).toThrow();
    expect(() => compileExpression('fetch("http://evil.com")')).toThrow();
  });

  it('sweepFunction sweeps a mathematical formula over a domain', () => {
    const { x, y } = sweepFunction('x^2 - 4', [-2, 2], 5);
    expect(x).toEqual([-2, -1, 0, 1, 2]);
    expect(y[0]).toBe(0); // (-2)^2 - 4
    expect(y[2]).toBe(-4); // (0)^2 - 4
    expect(y[4]).toBe(0); // (2)^2 - 4
  });

  it('sweepFunction handles callable functions with parameters', () => {
    const customFn = (x: number, p?: Record<string, number>) => (p?.slope ?? 1) * x + (p?.intercept ?? 0);
    const { x, y } = sweepFunction(customFn, [0, 4], 3, { slope: 3, intercept: 2 });
    expect(x).toEqual([0, 2, 4]);
    expect(y).toEqual([2, 8, 14]);
  });
});

describe('Colormaps & Multi-Series Palettes', () => {
  it('contains required scientific colormaps with valid stops', () => {
    const maps = ['viridis', 'turbo', 'inferno', 'coolwarm', 'grayscale'] as const;
    maps.forEach((m) => {
      expect(COLORMAPS[m]).toBeDefined();
      expect(COLORMAPS[m].length).toBeGreaterThanOrEqual(4);
    });
  });

  it('interpolateColormap clamps at [0, 1] and returns RGB triplet', () => {
    const [r0, g0, b0] = interpolateColormap(-0.5, 'viridis');
    const [r1, g1, b1] = interpolateColormap(1.5, 'viridis');
    expect(r0).toBeGreaterThanOrEqual(0);
    expect(r0).toBeLessThanOrEqual(255);
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThanOrEqual(255);
  });

  it('getSeriesColor cycles gracefully through palette', () => {
    const c0 = getSeriesColor(0);
    const c1 = getSeriesColor(1);
    expect(c0).not.toBe(c1);
    expect(getSeriesColor(0)).toBe(c0);
  });
});

describe('Scoped Reactive State', () => {
  const scope = 'test-scope';

  beforeEach(() => {
    clearScope(scope);
  });

  it('sets and gets parameter values', () => {
    setParameter(scope, 'mach', 0.82);
    expect(getParameter(scope, 'mach')).toBe(0.82);
  });

  it('notifies subscribers of changes', () => {
    const listener = vi.fn();
    const unsub = subscribeParameter(scope, listener);

    setParameter(scope, 'altitude', 35000);
    expect(listener).toHaveBeenCalledWith('altitude', 35000);

    unsub();
    setParameter(scope, 'altitude', 40000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('React MDX Components', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    container = doc.createElement('div');
    doc.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('MetricCard computes baseline deltas and status classes correctly', async () => {
    await act(async () => {
      root.render(
        <MetricCard
          label="Lift-to-Drag"
          value={21.5}
          unit="L/D"
          baseline={20.0}
          better="higher"
        />
      );
    });

    expect(container.textContent).toContain('Lift-to-Drag');
    expect(container.textContent).toContain('21.5');
    expect(container.textContent).toContain('+7.5%');

    const deltaElem = container.querySelector('.eng-metric-delta');
    expect(deltaElem).toBeTruthy();
    expect(deltaElem?.className).toContain('status-good');
  });

  it('DataTable sorts rows ascending and descending on header click', async () => {
    const columns = [
      { key: 'name', label: 'Aircraft' },
      { key: 'range', label: 'Range', unit: 'nmi' },
    ];
    const data = [
      { name: 'Boeing 777-300ER', range: 7370 },
      { name: 'BWB-450 Concept', range: 8200 },
      { name: 'Airbus A350-900', range: 8100 },
    ];

    await act(async () => {
      root.render(<DataTable columns={columns} data={data} title="Fleet Comparison" />);
    });

    expect(container.textContent).toContain('Fleet Comparison');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);

    // Click to sort by range
    const rangeHeader = container.querySelectorAll('thead th')[1] as HTMLTableCellElement;
    await act(async () => {
      rangeHeader.click();
    });

    // Ascending: Boeing (7370) should be first
    let firstRowCells = container.querySelectorAll('tbody tr')[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toBe('Boeing 777-300ER');

    // Click again: Descending: BWB (8200) should be first
    await act(async () => {
      rangeHeader.click();
    });
    firstRowCells = container.querySelectorAll('tbody tr')[0].querySelectorAll('td');
    expect(firstRowCells[0].textContent).toBe('BWB-450 Concept');
  });

  it('DataTable filters rows with search query', async () => {
    const columns = [
      { key: 'name', label: 'Aircraft' },
      { key: 'engine', label: 'Engine' },
    ];
    const data = [
      { name: 'Aircraft Alpha', engine: 'Turbofan GE90' },
      { name: 'Aircraft Beta', engine: 'Open Rotor' },
      { name: 'Aircraft Gamma', engine: 'Hydrogen Fuel Cell' },
    ];

    await act(async () => {
      root.render(<DataTable columns={columns} data={data} searchable={true} />);
    });

    const searchInput = container.querySelector('.eng-table-search-input') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const proto = Object.getPrototypeOf(searchInput);
      const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set;
      set?.call(searchInput, 'Hydrogen');

      const tracker = (searchInput as any)._valueTracker;
      if (tracker) {
        tracker.setValue('');
      }

      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Aircraft Gamma');
    expect(container.textContent).not.toContain('Aircraft Alpha');
  });

  it('NotebookCell renders code header, copy button, and interactive output', async () => {
    await act(async () => {
      root.render(
        <NotebookCell inputNumber={3} code={'import numpy as np\nprint("aerodynamics")'}>
          <div className="output-test-content">Plot Output</div>
        </NotebookCell>
      );
    });

    expect(container.textContent).toContain('In [3]:');
    expect(container.textContent).toContain('Out [3]:');
    expect(container.textContent).toContain('import numpy as np');
    expect(container.textContent).toContain('Plot Output');
  });

  it('ParamPlayground renders parameter sliders and reset controls', async () => {
    const params = [
      { id: 'aspectRatio', label: 'Aspect Ratio', min: 4, max: 14, defaultValue: 9.5, unit: 'AR' },
      { id: 'sweep', label: 'Sweep Angle', min: 15, max: 45, defaultValue: 30, unit: 'deg' },
    ];

    await act(async () => {
      root.render(
        <ParamPlayground
          scopeId="demo-scope"
          title="Wing Parameters"
          parameters={params}
          presets={{ 'High Speed': { aspectRatio: 7.5, sweep: 38 } }}
        />
      );
    });

    expect(container.textContent).toContain('Wing Parameters');
    expect(container.textContent).toContain('Aspect Ratio');
    expect(container.textContent).toContain('Sweep Angle');
    expect(container.textContent).toContain('High Speed');
    expect(container.textContent).toContain('Reset All');
  });

  it('HeatmapPlot renders canvas with custom dimensions and axis labels', async () => {
    const matrix = [
      [1.0, 2.0, 3.0],
      [4.0, 5.0, 6.0],
      [7.0, 8.0, 9.0],
    ];

    await act(async () => {
      root.render(
        <HeatmapPlot
          data={matrix}
          title="Pressure Distribution"
          xLabel="Chord"
          yLabel="Span"
          zLabel="Cp"
          colormap="coolwarm"
        />
      );
    });

    expect(container.textContent).toContain('Pressure Distribution');
    expect(container.textContent).toContain('Chord');
    expect(container.textContent).toContain('Span');
    expect(container.textContent).toContain('Cp');
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
