// Render tests for EngineeringPlot with a mocked uPlot. jsdom provides the
// DOM; uPlot is replaced with a recording fake so we can assert lifecycle,
// settings, click-to-inspect, autoscale and export behavior without a browser.
// jsdom is untyped in this project; import it as `any` to avoid the
// implicit-any error without adding a dev dependency.
// @ts-ignore - jsdom ships no type declarations in this project.
import { JSDOM } from 'jsdom';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import type { EngineeringPlotConfig } from '../src/lib/engineering/types';
import { getModel } from '../src/lib/engineering/registry';
import { getPlotDefinition, generateSeries } from '../src/lib/engineering/plots/registry';
import { aircraftPerformanceModel } from '../src/lib/engineering/models/aircraft-performance/bwb';
import { dragPolarModel } from '../src/lib/engineering/models/aerodynamics/dragPolar';

// ---------------------------------------------------------------------------
// Mock uPlot (self-contained factory so vitest registers it eagerly and every
// dynamic `import('uplot')` in the components under test is mocked). Real
// uPlot cannot run in jsdom: it evaluates bare `devicePixelRatio` at module
// scope.
// ---------------------------------------------------------------------------
const createdInstances: Array<any> = [];

vi.mock('uplot', () => {
  type MockSeries = { width: number; points: { show: boolean }; label: string; show: boolean };
  type MockAxis = { grid: { stroke: string } };

  class MockUPlot {
    opts: any;
    data: number[][];
    destroyed = false;
    series: MockSeries[] = [];
    axes: MockAxis[] = [];
    scales: { x: { min: number; max: number }; y: { min: number; max: number } } = { x: { min: 0, max: 0 }, y: { min: 0, max: 0 } };
    bbox = { left: 0, top: 0, width: 300, height: 300 };
    cursor = { idx: null, left: 0, top: 0 };

    constructor(opts: any, data: number[][], container: HTMLElement) {
      this.opts = opts;
      this.data = data;
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      this.series = (opts.series?.slice(1) ?? []).map((s: any) => ({
        width: s.width,
        points: { show: s.points?.show },
        label: s.label,
        show: s.show,
      }));
      this.axes = (opts.axes ?? []).map((a: any) => ({ grid: { stroke: a.grid?.stroke ?? '' } }));
      this.scales = {
        x: { min: opts.scales?.x?.min ?? 0, max: opts.scales?.x?.max ?? 0 },
        y: { min: opts.scales?.y?.min ?? 0, max: opts.scales?.y?.max ?? 0 },
      };
      createdInstances.push(this);
    }
    setData() {}
    setScale() {}
    setSeries() {}
    setSize() {}
    redraw() {}
    posToVal = () => 0;
    destroy() {
      this.destroyed = true;
    }
  }
  return { __esModule: true, default: MockUPlot };
});

// ---------------------------------------------------------------------------
// jsdom environment setup
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
});

const window = dom.window as unknown as Window & typeof globalThis;
const document = window.document;

const installGlobals = () => {
  // React 19's act() requires this flag to flush updates synchronously.
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof window !== 'undefined') {
    (window as any).IS_REACT_ACT_ENVIRONMENT = true;
  }
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'getComputedStyle', {
    value: window.getComputedStyle.bind(window),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'HTMLCanvasElement', {
    value: window.HTMLCanvasElement,
    configurable: true,
  });
  // jsdom does not lay out elements; report a realistic width so uPlot
  // initializes (it reads the container's clientWidth).
  Object.defineProperty(window.HTMLDivElement.prototype, 'clientWidth', {
    value: 720,
    configurable: true,
  });
  (globalThis as any).URL.createObjectURL = () => 'blob:mock-url';
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,mock';
};

const removeGlobals = async () => {
  // Settle any pending React work before clearing the DOM so the scheduler
  // does not crash after teardown. Globals stay installed for the file.
  await act(async () => {});
  document.body.innerHTML = '';
};

const waitForChart = async (count = 1) => {
  const deadline = Date.now() + 5000;
  while (createdInstances.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (createdInstances.length < count) {
    throw new Error(`Expected ${count} uPlot charts, got ${createdInstances.length}`);
  }
};
import { EngineeringPlot } from '../src/components/engineering/plots/EngineeringPlot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseConfig: EngineeringPlotConfig = {
  title: 'Test plot',
  description: 'A test plot.',
  xAxis: { title: 'Airspeed', unit: 'm/s', type: 'linear', range: [40, 200] },
  yAxis: { title: 'L/D', unit: '-', type: 'linear' },
  series: [
    { id: 'ld', label: 'Lift-to-drag ratio L/D', x: [40, 80, 120, 160, 200], y: [10, 15, 17, 14, 10], mode: 'lines' },
  ],
};

const renderPlot = (config: EngineeringPlotConfig = baseConfig) => {
  const container = document.createElement('div');
  // jsdom does not lay out elements, so clientWidth is 0. uPlot needs a
  // nonzero width to initialize; emulate a real browser here.
  Object.defineProperty(container, 'clientWidth', { value: 720, configurable: true });
  document.body.appendChild(container);
  const onPointSelect = vi.fn();
  let root!: ReturnType<typeof ReactDOM.createRoot>;
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(<EngineeringPlot config={config} height={300} inspectable onPointSelect={onPointSelect} />);
  });
  return { container, root, onPointSelect };
};

const flush = () => act(() => {});

const clickAt = (node: Element, x: number, y: number) => {
  node.dispatchEvent(new window.MouseEvent('click', { clientX: x, clientY: y, bubbles: true, cancelable: true }));
};

// The click listener is attached to the plot container div inside the viewport.
const plotContainer = (container: HTMLElement) =>
  container.querySelector('.eng-plot-viewport > div') as HTMLElement;

const setChecked = (node: Element, checked: boolean) => {
  const input = node as HTMLInputElement;
  // React 19 fires checkbox onChange on click, not on programmatic change events.
  if (input.checked !== checked) {
    input.click();
  } else {
    input.checked = checked;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
};

describe('EngineeringPlot lifecycle', () => {
  beforeEach(() => {
    installGlobals();
    createdInstances.length = 0;
  });

  afterEach(() => {
    removeGlobals();
    document.body.innerHTML = '';
  });

  it('renders loading state before uPlot resolves', () => {
    const { container } = renderPlot();
    expect(container.textContent).toContain('Loading plot…');
  });

  it('mounts the chart once uPlot resolves and unmounts cleanly', async () => {
    const { container, root } = renderPlot();
    await flush();
    await waitForChart();

    expect(createdInstances.length).toBeGreaterThan(0);
    const instance = createdInstances[createdInstances.length - 1];
    expect(instance.destroyed).toBe(false);
    expect(container.querySelector('.eng-plot-viewport')).not.toBeNull();
    expect(container.querySelector('canvas')).not.toBeNull();

    act(() => root.unmount());
    expect(instance.destroyed).toBe(true);
  });

  it('can unmount and remount without leaking instances', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: ReturnType<typeof ReactDOM.createRoot>;
    act(() => { root = ReactDOM.createRoot(container); root.render(<EngineeringPlot config={baseConfig} height={300} inspectable />); });
    await flush();
    await waitForChart(1);
    expect(createdInstances.length).toBeGreaterThan(0);
    const first = createdInstances[createdInstances.length - 1];
    expect(first.destroyed).toBe(false);

    act(() => root.unmount());
    expect(first.destroyed).toBe(true);

    // React 19 does not allow render() on an unmounted root; create a new one.
    root = ReactDOM.createRoot(container);
    act(() => {
      root.render(<EngineeringPlot config={baseConfig} height={300} inspectable />);
    });
    await flush();
    await waitForChart(2);
    expect(createdInstances.length).toBeGreaterThanOrEqual(2);
    expect(createdInstances[createdInstances.length - 1].destroyed).toBe(false);
    createdInstances.slice(0, -1).forEach((inst) => expect(inst.destroyed).toBe(true));

    act(() => root.unmount());
  });

  it('renders multiple independent charts on one page', async () => {
    const { container: a } = renderPlot();
    await flush();
    await waitForChart(1);
    const { container: b } = renderPlot({ ...baseConfig, title: 'Second plot' });
    await flush();
    await waitForChart(2);
    expect(createdInstances.length).toBe(2);
    expect(a.querySelector('.eng-plot-title')?.textContent).toBe('Test plot');
    expect(b.querySelector('.eng-plot-title')?.textContent).toBe('Second plot');

    act(() => createdInstances.forEach((inst) => inst.destroy()));
  });

  it('shows an error surface instead of disappearing when uPlot fails', async () => {
    // Force a structural error: no series.
    const { container } = renderPlot({ ...baseConfig, series: [] });
    await flush();
    expect(container.querySelector('.eng-plot-error')).not.toBeNull();
    expect(container.textContent).toContain('No data series configured.');
  });
});

describe('EngineeringPlot controls', () => {
  beforeEach(() => {
    installGlobals();
    createdInstances.length = 0;
  });

  afterEach(() => {
    removeGlobals();
    document.body.innerHTML = '';
  });

  it('applies series visibility live via the settings panel', async () => {
    const { container, root, onPointSelect } = renderPlot();
    await flush();
    await waitForChart();
    const instance = createdInstances[0];
    const setSeriesSpy = vi.spyOn(instance, 'setSeries');

    act(() => {
      const button = container.querySelector('.eng-plot-settings-btn') as HTMLElement;
      button.click();
    });
    await flush();

    const checkboxes = container.querySelectorAll('.eng-plot-settings-series-label input[type="checkbox"]');
    expect(checkboxes).toHaveLength(1);

    act(() => setChecked(checkboxes[0], false));
    await flush();

    expect(setSeriesSpy).toHaveBeenCalled();
    act(() => root.unmount());
    setSeriesSpy.mockRestore();
  });

  it('click-to-inspect selects the nearest operating point', async () => {
    const { container, onPointSelect } = renderPlot();
    await flush();
    await waitForChart();

    const instance = createdInstances[0];
    // Mock posToVal: x-axis -> 80 m/s (second sample), y-axis -> 15 (on the curve).
    vi.spyOn(instance, 'posToVal').mockImplementation(
      ((_v: number, axis?: string) => (axis === 'x' ? 80 : 15)) as any,
    );
    instance.cursor = { idx: null, left: 0, top: 0 };
    instance.bbox = { left: 0, top: 0, width: 300, height: 300 };

    clickAt(plotContainer(container), 50, 50);
    await flush();

    expect(onPointSelect).toHaveBeenCalledTimes(1);
    const call = onPointSelect.mock.calls[0];
    expect(call[0]).toBe(80); // x
    expect(call[1]).toBe(15); // y
    expect(call[2]).toBe(0); // series index
    expect(call[3]).toBe('primary'); // kind
  });

  it('shift+click selects a comparison point instead of the primary', async () => {
    const { container, onPointSelect } = renderPlot();
    await flush();
    await waitForChart();

    const instance = createdInstances[0];
    vi.spyOn(instance, 'posToVal').mockImplementation(
      ((_v: number, axis?: string) => (axis === 'x' ? 120 : 15)) as any,
    );

    const event = new window.MouseEvent('click', {
      clientX: 50, clientY: 50, shiftKey: true, bubbles: true, cancelable: true,
    });
    plotContainer(container).dispatchEvent(event);
    await flush();

    expect(onPointSelect).toHaveBeenCalledTimes(1);
    expect(onPointSelect.mock.calls[0][0]).toBe(120);
    expect(onPointSelect.mock.calls[0][3]).toBe('comparison');
  });

  it('reset view clears manual limits and autoscales to data', async () => {
    const { container } = renderPlot();
    await flush();
    await waitForChart();
    const instance = createdInstances[0];
    const setScaleSpy = vi.spyOn(instance, 'setScale');

    act(() => {
      const button = Array.from(container.querySelectorAll('.eng-plot-mode-group button')).find(
        (b) => b.textContent === 'Reset View',
      );
      button?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const keys = setScaleSpy.mock.calls.map((c) => c[0]);
    expect(keys).toContain('x');
    expect(keys).toContain('y');
    setScaleSpy.mockRestore();
  });

  it('autoscale fits axes to data and clears manual limits', async () => {
    const { container } = renderPlot();
    await flush();
    await waitForChart();
    const instance = createdInstances[0];
    const setScaleSpy = vi.spyOn(instance, 'setScale');

    act(() => {
      const buttons = container.querySelectorAll('.eng-plot-mode-group button');
      const autoscale = Array.from(buttons).find((b) => b.textContent === 'Autoscale');
      autoscale?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const keys = setScaleSpy.mock.calls.map((c) => c[0]);
    expect(keys).toContain('x');
    expect(keys).toContain('y');
    setScaleSpy.mockRestore();
  });

  it('cursor readout updates through the uPlot setCursor hook', async () => {
    const { container } = renderPlot();
    await flush();
    await waitForChart();

    const instance = createdInstances[0];
    const data = [[40, 80, 120], [10, 15, 17]];
    instance.opts.hooks.setCursor[0]({ cursor: { idx: 1 }, data } as any);
    await flush();

    const readout = container.querySelector('.eng-plot-readout');
    expect(readout).not.toBeNull();
    expect(readout?.textContent).toContain('80');
    expect(readout?.textContent).toContain('Lift-to-drag ratio L/D');
  });

  it('export CSV downloads a file with header and rows', async () => {
    const { container } = renderPlot();
    await flush();
    await waitForChart();

    let captured: { href: string; download: string } | null = null;
    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = ((node: any) => {
      if (node?.href && node?.download) captured = { href: node.href, download: node.download };
      return origAppend(node);
    }) as any;

    act(() => {
      const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Export CSV');
      button?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(captured).not.toBeNull();
    expect(captured!.download).toContain('.csv');
    expect(captured!.href).toBe('blob:mock-url');
    document.body.appendChild = origAppend;
  });
});

describe('plot series generation', () => {
  it('generates series for all four BWB plot presets with finite data', () => {
    expect(getModel(aircraftPerformanceModel.id)).toBeDefined();
    expect(getModel(dragPolarModel.id)).toBeDefined();
    const inputs = { mass: 70000, structuralPenalty: 0, area: 300, ar: 6.75, e: 0.8, cd0: 0.02, inducedCorrection: 1, rho: 1.225, velocity: 80 };
    const defs = ['aircraft.dragPolar', 'aircraft.ldVsSpeed', 'aircraft.thrustVsSpeed', 'aircraft.ldVsMassPenalty'];

    for (const id of defs) {
      const def = getPlotDefinition(id);
      expect(def).toBeDefined();
      const series = generateSeries(def!, inputs);
      expect(series.length).toBeGreaterThan(0);
      for (const s of series) {
        expect(s.x.length).toBe(200);
        expect(s.x.length).toBe(s.y.length);
        const valid = s.y.filter((v) => typeof v === 'number' && Number.isFinite(v));
        expect(valid.length).toBeGreaterThan(0);
      }
    }
  });

  it('drag polar sweeps C_L from 0.1 to 2.0 using dragPolarModel', () => {
    const def = getPlotDefinition('aircraft.dragPolar');
    expect(def?.modelId).toBe(dragPolarModel.id);
    expect(def?.sweepParam).toBe('cl');
    expect(def?.xRange).toEqual([0.1, 2.0]);

    const series = generateSeries(def!, { cd0: 0.02, e: 0.8, ar: 10, cl: 0.5 });
    expect(series[0].x[0]).toBeCloseTo(0.1, 6);
    expect(series[0].x[199]).toBeCloseTo(2.0, 6);
    // C_D = C_D,0 at C_L = 0 isn't in range; at C_L = 0.1 C_D should be just above cd0.
    expect(series[0].y[0]).toBeGreaterThan(0.02);
  });
});
