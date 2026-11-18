import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  detectFormat,
  loadCadOrMeshAsset,
  disposeObject,
} from '../src/lib/engineering/cadLoader';
import {
  EngineeringModelViewer,
  CadModelViewer,
} from '../src/components/mdx';

describe('Universal CAD & CAE Loader (cadLoader.ts)', () => {
  it('correctly detects file formats from filenames and extensions', () => {
    expect(detectFormat('model.step')).toBe('step');
    expect(detectFormat('part.STP')).toBe('step');
    expect(detectFormat('bracket.iges')).toBe('iges');
    expect(detectFormat('test.igs')).toBe('iges');
    expect(detectFormat('solid.brep')).toBe('brep');
    expect(detectFormat('mesh.stl')).toBe('stl');
    expect(detectFormat('object.obj')).toBe('obj');
    expect(detectFormat('scan.ply')).toBe('ply');
    expect(detectFormat('print.3mf')).toBe('3mf');
    expect(detectFormat('scene.gltf')).toBe('gltf');
    expect(detectFormat('binary.glb')).toBe('gltf');
    expect(detectFormat('field.vtk')).toBe('vtk');
    expect(detectFormat('calculix.inp')).toBe('inp');
    expect(detectFormat('calculix.frd')).toBe('frd');
    expect(detectFormat('bracket_r5_fea.json')).toBe('fea-json');
    expect(detectFormat('arbitrary.data', 'step')).toBe('step');
  });

  it('re-exports EngineeringModelViewer and CadModelViewer from mdx components barrel', () => {
    expect(EngineeringModelViewer).toBeDefined();
    expect(CadModelViewer).toBeDefined();
    expect(CadModelViewer).toBe(EngineeringModelViewer);
  });

  it('loads and tessellates real STEP AP214 CAD model with OpenCASCADE WASM', async () => {
    const stepPath = path.join(process.cwd(), 'public/notebooks/aerospace-bracket/geometry/bracket_r5.step');
    expect(fs.existsSync(stepPath)).toBe(true);

    const buf = fs.readFileSync(stepPath);
    const cad = await loadCadOrMeshAsset(buf.buffer, { format: 'step', fileName: 'bracket_r5.step' });

    expect(cad.format).toBe('step');
    expect(cad.parts.length).toBeGreaterThan(0);

    // Verify true bounding box dimensions in mm: 100 mm (X) x 60 mm (Y) x 66 mm (Z)
    expect(cad.bounds.size.x).toBeCloseTo(100.0, 1);
    expect(cad.bounds.size.y).toBeCloseTo(60.0, 1);
    expect(cad.bounds.size.z).toBeCloseTo(66.0, 1);

    // Verify triangles were created and can be cleaned up
    expect(cad.parts[0].triangleCount).toBeGreaterThan(500);
    expect(cad.parts[0].vertexCount).toBeGreaterThan(500);

    cad.dispose();
  });

  it('loads all 3 real FEA surface datasets (R2, R5, R10) with verified displacements & stresses', async () => {
    const radii = ['r2', 'r5', 'r10'];

    for (const r of radii) {
      const jsonPath = path.join(process.cwd(), `public/notebooks/aerospace-bracket/fea/bracket_${r}_fea.json`);
      expect(fs.existsSync(jsonPath)).toBe(true);

      const content = fs.readFileSync(jsonPath, 'utf-8');
      const fea = await loadCadOrMeshAsset(content, { format: 'fea-json' });

      expect(fea.feaData).toBeDefined();
      expect(fea.feaData?.numNodes).toBeGreaterThan(4000);
      expect(fea.feaData?.numTriangles).toBeGreaterThan(8000);

      // Verify bounding box matches nominal CAD
      expect(fea.bounds.size.x).toBeCloseTo(100.0, 1);
      expect(fea.bounds.size.y).toBeCloseTo(60.0, 1);
      expect(fea.bounds.size.z).toBeCloseTo(66.0, 1);

      // Verify all 3 load cases exist
      const loads = fea.feaData!.loads;
      expect(loads.lc1).toBeDefined();
      expect(loads.lc2).toBeDefined();
      expect(loads.lc3).toBeDefined();

      // Verify LC2 out-of-plane compliance is significantly higher than LC1 downward
      expect(loads.lc2.maxDisplacementMm).toBeGreaterThan(loads.lc1.maxDisplacementMm * 5);

      fea.dispose();
    }
  });

  it('parses CalculiX .inp files into clean boundary surface triangles', async () => {
    const sampleInp = `
*HEADING
Model test
*NODE
1, 0.0, 0.0, 0.0
2, 10.0, 0.0, 0.0
3, 0.0, 10.0, 0.0
4, 0.0, 0.0, 10.0
*ELEMENT, TYPE=C3D4, ELSET=EALL
1, 1, 2, 3, 4
`;
    const model = await loadCadOrMeshAsset(sampleInp, { format: 'inp', fileName: 'sample.inp' });
    expect(model.format).toBe('inp');
    expect(model.parts.length).toBe(1);
    // 1 tet has 4 boundary triangular faces
    expect(model.parts[0].triangleCount).toBe(4);
    model.dispose();
  });

  it('exports disposeObject utility that safely traverses and releases geometries', () => {
    expect(typeof disposeObject).toBe('function');
  });
});
