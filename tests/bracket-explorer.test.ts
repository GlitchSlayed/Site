import { describe, it, expect } from 'vitest';
import {
  FEA_BENCHMARKS,
  getTelemetry,
  BracketStressExplorer,
  type LoadCaseId,
  type FilletRadiusId,
} from '../src/components/engineering/viewers/BracketStressExplorer';
import * as mdxComponents from '../src/components/mdx';

describe('BracketStressExplorer Engineering Benchmarks', () => {
  it('re-exports BracketStressExplorer from mdx components barrel', () => {
    expect(mdxComponents.BracketStressExplorer).toBeDefined();
    expect(mdxComponents.BracketStressExplorer).toBe(BracketStressExplorer);
  });

  it('contains consistent benchmark data for all 3 load cases and 3 fillet radii', () => {
    const loadCases: LoadCaseId[] = ['lc1', 'lc2', 'lc3'];
    const radii: FilletRadiusId[] = ['r2', 'r5', 'r10'];

    for (const lc of loadCases) {
      expect(FEA_BENCHMARKS[lc]).toBeDefined();
      expect(FEA_BENCHMARKS[lc].label).toBeTruthy();
      for (const r of radii) {
        const item = FEA_BENCHMARKS[lc].filletData[r];
        expect(item).toBeDefined();
        expect(item.radiusMm).toBeGreaterThan(0);
        expect(item.massGrams).toBeGreaterThan(140);
        expect(item.peakStressMpa).toBeGreaterThan(0);
        expect(item.maxDisplacementMm).toBeGreaterThan(0);
      }
    }
  });

  it('reflects correct CAD solid masses across fillet variants', () => {
    // R2: 150.5 g, R5: 151.5 g, R10: 155.1 g
    const r2Data = getTelemetry('lc1', 'r2');
    const r5Data = getTelemetry('lc1', 'r5');
    const r10Data = getTelemetry('lc1', 'r10');

    expect(r2Data.massGrams).toBe(150.5);
    expect(r5Data.massGrams).toBe(151.5);
    expect(r10Data.massGrams).toBe(155.1);
    expect(r10Data.massGrams).toBeGreaterThan(r5Data.massGrams);
    expect(r5Data.massGrams).toBeGreaterThan(r2Data.massGrams);
  });

  it('demonstrates stress concentration relief with increasing fillet radius', () => {
    // LC1: R2 (81.53 MPa) -> R5 (49.98 MPa) -> R10 (30.47 MPa)
    const lc1_r2 = getTelemetry('lc1', 'r2');
    const lc1_r5 = getTelemetry('lc1', 'r5');
    const lc1_r10 = getTelemetry('lc1', 'r10');

    expect(lc1_r2.peakStressMpa).toBe(81.53);
    expect(lc1_r5.peakStressMpa).toBe(49.98);
    expect(lc1_r10.peakStressMpa).toBe(30.47);

    // Reduction is over 60% from R2 to R10
    const reductionPct = ((lc1_r2.peakStressMpa - lc1_r10.peakStressMpa) / lc1_r2.peakStressMpa) * 100;
    expect(reductionPct).toBeGreaterThan(60);
  });

  it('corroborates lateral weak-axis bending vulnerability (LC2 vs LC1)', () => {
    const lc1 = getTelemetry('lc1', 'r5');
    const lc2 = getTelemetry('lc2', 'r5');

    // Lateral displacement is significantly higher than in-plane downward displacement
    expect(lc2.maxDisplacementMm).toBeCloseTo(0.3958, 3);
    expect(lc1.maxDisplacementMm).toBeCloseTo(0.0346, 3);
    expect(lc2.maxDisplacementMm / lc1.maxDisplacementMm).toBeGreaterThan(10);

    // Lateral root bending stress is higher despite lower load magnitude (500 N vs 2000 N)
    expect(lc2.peakStressMpa).toBeGreaterThan(lc1.peakStressMpa);
  });

  it('computes correct safety factors against 7075-T651 yield allowable (503 MPa)', () => {
    const lc1 = getTelemetry('lc1', 'r5');
    // 503 / 49.98 = ~10.06 -> 10.1
    expect(lc1.yieldSafetyFactor).toBe(10.1);

    const lc2 = getTelemetry('lc2', 'r5');
    // 503 / 91.25 = ~5.51 -> 5.5
    expect(lc2.yieldSafetyFactor).toBe(5.5);

    const lc3 = getTelemetry('lc3', 'r5');
    // 503 / 74.97 = ~6.71 -> 6.7
    expect(lc3.yieldSafetyFactor).toBe(6.7);
  });

  it('scales LC3 factored ultimate load linearly by 1.5x from LC1', () => {
    const lc1 = getTelemetry('lc1', 'r5');
    const lc3 = getTelemetry('lc3', 'r5');

    expect(lc3.peakStressMpa / lc1.peakStressMpa).toBeCloseTo(1.5, 2);
    expect(lc3.maxDisplacementMm / lc1.maxDisplacementMm).toBeCloseTo(1.5, 2);
  });
});
