import type { Object3D, Material, Texture, BufferGeometry } from 'three';

export interface CadPartInfo {
  id: string;
  name: string;
  vertexCount: number;
  triangleCount: number;
  mesh: import('three').Mesh;
  edges?: import('three').LineSegments;
  color?: number[];
}

export interface FeaSurfaceDataset {
  id: string;
  radiusMm?: number;
  massGrams?: number;
  numNodes: number;
  numTriangles: number;
  boundingBox: { min: number[]; max: number[]; size: number[] };
  positions: number[];
  triangles: number[];
  featureEdges?: number[];
  roiFaces?: number[];
  loads: Record<
    string,
    {
      label: string;
      peakStressMpa: number;
      p99StressMpa: number;
      maxDisplacementMm: number;
      displacements: number[];
      nodalStress: number[];
    }
  >;
}

export interface LoadedCadModel {
  root: import('three').Group;
  geometry: import('three').BufferGeometry;
  parts: CadPartInfo[];
  bounds: {
    min: import('three').Vector3;
    max: import('three').Vector3;
    size: import('three').Vector3;
    center: import('three').Vector3;
    radius: number;
  };
  format: string;
  feaData?: FeaSurfaceDataset;
  dispose: () => void;
}

export interface CadLoaderOptions {
  format?: string;
  fileName?: string;
  color?: number;
  metalness?: number;
  roughness?: number;
  edgeColor?: number;
  creaseAngleDeg?: number;
  upAxis?: 'y' | 'z';
  onProgress?: (percent: number) => void;
}

/** Dispose owned model resources once, including shared materials and textures. */
export function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => {
        materials.add(m);
        Object.values(m).forEach(val => {
          if (val && typeof val === 'object' && 'isTexture' in val) textures.add(val as Texture);
        });
      });
    }
  });
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
  geometries.forEach(g => g.dispose());
}

/** Create sharp feature lines along high-curvature surface boundaries */
export async function createFeatureEdges(
  geometry: import('three').BufferGeometry,
  thresholdAngleDeg = 28,
  color = 0x222a35
): Promise<import('three').LineSegments> {
  const [three] = await Promise.all([import('three')]);
  const edgesGeom = new three.EdgesGeometry(geometry, thresholdAngleDeg);
  const edgesMat = new three.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const lines = new three.LineSegments(edgesGeom, edgesMat);
  lines.renderOrder = 2;
  return lines;
}

let occtPromise: Promise<any> | null = null;
export async function getOcctInstance() {
  if (!occtPromise) {
    const occtModule = await import('occt-import-js');
    const initFn = (occtModule as any).default || occtModule;
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    const wasmLocator = (file: string) => {
      if (!file.endsWith('.wasm')) return file;
      if (isBrowser) {
        const wasmBase = window.location.pathname.startsWith('/Site') ? '/Site/wasm/' : '/wasm/';
        return `${wasmBase}${file}`;
      }
      try {
        const nodePath = require('node:path');
        return nodePath.join(process.cwd(), 'public/wasm', file);
      } catch {
        return `/wasm/${file}`;
      }
    };

    if (typeof initFn === 'function') {
      occtPromise = initFn({
        locateFile: wasmLocator,
      });
    } else {
      occtPromise = Promise.resolve(initFn);
    }
  }
  return occtPromise;
}

export function detectFormat(source: string | File | ArrayBuffer, explicitFormat?: string): string {
  if (explicitFormat) return explicitFormat.toLowerCase().replace(/^\./, '');
  if (typeof source === 'string') {
    const clean = source.split('?')[0].toLowerCase();
    if (clean.endsWith('.step') || clean.endsWith('.stp')) return 'step';
    if (clean.endsWith('.iges') || clean.endsWith('.igs')) return 'iges';
    if (clean.endsWith('.brep')) return 'brep';
    if (clean.endsWith('.stl')) return 'stl';
    if (clean.endsWith('.obj')) return 'obj';
    if (clean.endsWith('.ply')) return 'ply';
    if (clean.endsWith('.3mf')) return '3mf';
    if (clean.endsWith('.dae')) return 'dae';
    if (clean.endsWith('.fbx')) return 'fbx';
    if (clean.endsWith('.gltf') || clean.endsWith('.glb')) return 'gltf';
    if (clean.endsWith('.vtk')) return 'vtk';
    if (clean.endsWith('.inp')) return 'inp';
    if (clean.endsWith('.frd')) return 'frd';
    if (clean.endsWith('.fea.json') || clean.endsWith('_fea.json')) return 'fea-json';
    if (clean.endsWith('.json')) return 'json';
  } else if (typeof File !== 'undefined' && source instanceof File) {
    return detectFormat(source.name);
  }
  return 'unknown';
}

/**
 * Universal CAD, 3D Mesh, and CAE Field asset loader.
 * Automatically selects the appropriate WASM/Three parser and returns a normalized model.
 */
export async function loadCadOrMeshAsset(
  source: string | File | ArrayBuffer | Uint8Array,
  options: CadLoaderOptions = {}
): Promise<LoadedCadModel> {
  const three = await import('three');
  const format = detectFormat(typeof source === 'string' || (typeof File !== 'undefined' && source instanceof File) ? source : (options.fileName || ''), options.format);

  let rawBuffer: ArrayBuffer | null = null;
  let textContent: string | null = null;

  if (typeof source === 'string') {
    const trimmed = source.trim();
    const isRawContent = trimmed.startsWith('{') || trimmed.startsWith('*') || source.includes('\n');
    if (isRawContent) {
      textContent = source;
    } else {
      const res = await fetch(source);
      if (!res.ok) throw new Error(`Failed to fetch model from ${source} (HTTP ${res.status})`);
      if (format === 'json' || format === 'fea-json' || format === 'inp' || format === 'frd' || format === 'obj') {
        textContent = await res.text();
      } else {
        rawBuffer = await res.arrayBuffer();
      }
    }
  } else if (typeof File !== 'undefined' && source instanceof File) {
    if (format === 'json' || format === 'fea-json' || format === 'inp' || format === 'frd' || format === 'obj') {
      textContent = await source.text();
    } else {
      rawBuffer = await source.arrayBuffer();
    }
  } else if (source instanceof ArrayBuffer) {
    rawBuffer = source;
  } else if (source instanceof Uint8Array) {
    rawBuffer = source.buffer as ArrayBuffer;
  }

  const root = new three.Group();
  const parts: CadPartInfo[] = [];
  let primaryGeometry: import('three').BufferGeometry | null = null;
  let feaData: FeaSurfaceDataset | undefined;

  const defaultMat = new three.MeshStandardMaterial({
    color: options.color ?? 0xa8b4c0,
    metalness: options.metalness ?? 0.65,
    roughness: options.roughness ?? 0.35,
  });

  // 1. STEP, IGES, BREP via OpenCASCADE WASM
  if (format === 'step' || format === 'iges' || format === 'brep') {
    if (!rawBuffer) throw new Error('Binary buffer required for CAD STEP/IGES/BREP parsing');
    const occt = await getOcctInstance();
    const uint8 = new Uint8Array(rawBuffer);

    let occtResult: any;
    if (format === 'step') {
      occtResult = occt.ReadStepFile(uint8, null);
    } else if (format === 'iges') {
      occtResult = occt.ReadIgesFile(uint8, null);
    } else {
      occtResult = occt.ReadBrepFile(uint8, null);
    }

    if (!occtResult || !occtResult.success) {
      throw new Error(`OpenCASCADE failed to tessellate ${format.toUpperCase()} model.`);
    }

    for (let i = 0; i < (occtResult.meshes || []).length; i++) {
      const occtMesh = occtResult.meshes[i];
      const geom = new three.BufferGeometry();
      geom.setAttribute('position', new three.Float32BufferAttribute(occtMesh.attributes.position.array, 3));
      if (occtMesh.attributes.normal?.array) {
        geom.setAttribute('normal', new three.Float32BufferAttribute(occtMesh.attributes.normal.array, 3));
      } else {
        geom.computeVertexNormals();
      }
      if (occtMesh.index?.array) {
        geom.setIndex(Array.from(occtMesh.index.array));
      }

      if (!primaryGeometry) primaryGeometry = geom;

      let partMat = defaultMat;
      if (occtMesh.color && occtMesh.color.length >= 3) {
        partMat = new three.MeshStandardMaterial({
          color: new three.Color(occtMesh.color[0], occtMesh.color[1], occtMesh.color[2]),
          metalness: options.metalness ?? 0.65,
          roughness: options.roughness ?? 0.35,
        });
      }

      const mesh = new three.Mesh(geom, partMat);
      root.add(mesh);

      const edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 26, options.edgeColor ?? 0x1d2d38);
      root.add(edges);

      const triCount = geom.index ? geom.index.count / 3 : geom.getAttribute('position').count / 3;
      parts.push({
        id: `part-${i}`,
        name: occtMesh.name || `Solid ${i + 1}`,
        vertexCount: geom.getAttribute('position').count,
        triangleCount: Math.round(triCount),
        mesh,
        edges,
        color: occtMesh.color,
      });
    }
  }

  // 2. FEA Surface JSON dataset
  else if (format === 'fea-json' || (format === 'json' && textContent && textContent.includes('numTriangles'))) {
    if (!textContent && rawBuffer) textContent = new TextDecoder().decode(rawBuffer);
    if (!textContent) throw new Error('Failed to read FEA JSON contents');
    const parsed = JSON.parse(textContent) as FeaSurfaceDataset;
    feaData = parsed;

    const geom = new three.BufferGeometry();
    geom.setAttribute('position', new three.Float32BufferAttribute(parsed.positions, 3));
    geom.setIndex(parsed.triangles);
    geom.computeVertexNormals();
    primaryGeometry = geom;

    const mesh = new three.Mesh(geom, defaultMat);
    root.add(mesh);

    let edges: import('three').LineSegments | undefined;
    if (parsed.featureEdges && parsed.featureEdges.length > 0) {
      const edgeGeom = new three.BufferGeometry();
      edgeGeom.setAttribute('position', geom.getAttribute('position'));
      edgeGeom.setIndex(parsed.featureEdges);
      const edgeMat = new three.LineBasicMaterial({
        color: options.edgeColor ?? 0x1d2d38,
        transparent: true,
        opacity: 0.85,
      });
      edges = new three.LineSegments(edgeGeom, edgeMat);
      edges.renderOrder = 2;
      root.add(edges);
    } else {
      edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 28, options.edgeColor ?? 0x1d2d38);
      root.add(edges);
    }

    parts.push({
      id: parsed.id || 'fea-solid',
      name: parsed.id ? `FEA Model ${parsed.id.toUpperCase()}` : 'Finite Element Surface',
      vertexCount: parsed.numNodes,
      triangleCount: parsed.numTriangles,
      mesh,
      edges,
    });
  }

  // 3. STL Mesh
  else if (format === 'stl') {
    if (!rawBuffer) throw new Error('Binary buffer required for STL');
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geom = new STLLoader().parse(rawBuffer);
    geom.computeVertexNormals();
    primaryGeometry = geom;

    const mesh = new three.Mesh(geom, defaultMat);
    root.add(mesh);

    const edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 28, options.edgeColor ?? 0x1d2d38);
    root.add(edges);

    const triCount = geom.index ? geom.index.count / 3 : geom.getAttribute('position').count / 3;
    parts.push({
      id: 'stl-mesh',
      name: options.fileName || 'STL Solid',
      vertexCount: geom.getAttribute('position').count,
      triangleCount: Math.round(triCount),
      mesh,
      edges,
    });
  }

  // 4. OBJ Mesh
  else if (format === 'obj') {
    if (!textContent && rawBuffer) textContent = new TextDecoder().decode(rawBuffer);
    if (!textContent) throw new Error('Failed to read OBJ contents');
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const loadedGroup = new OBJLoader().parse(textContent);

    loadedGroup.traverse(child => {
      if ((child as any).isMesh) {
        const m = child as import('three').Mesh;
        if (!primaryGeometry && m.geometry) primaryGeometry = m.geometry;
        m.material = defaultMat;
        parts.push({
          id: m.name || `obj-part-${parts.length}`,
          name: m.name || `Mesh ${parts.length + 1}`,
          vertexCount: m.geometry.getAttribute('position')?.count || 0,
          triangleCount: Math.round((m.geometry.index?.count || m.geometry.getAttribute('position')?.count || 0) / 3),
          mesh: m,
        });
      }
    });
    root.add(loadedGroup);
  }

  // 5. PLY Mesh
  else if (format === 'ply') {
    if (!rawBuffer) throw new Error('Binary buffer required for PLY');
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    const geom = new PLYLoader().parse(rawBuffer);
    geom.computeVertexNormals();
    primaryGeometry = geom;

    const mesh = new three.Mesh(geom, defaultMat);
    root.add(mesh);
    const edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 28, options.edgeColor ?? 0x1d2d38);
    root.add(edges);

    parts.push({
      id: 'ply-mesh',
      name: options.fileName || 'PLY Surface',
      vertexCount: geom.getAttribute('position').count,
      triangleCount: Math.round((geom.index?.count || geom.getAttribute('position').count) / 3),
      mesh,
      edges,
    });
  }

  // 6. 3MF Multi-part Mesh
  else if (format === '3mf') {
    if (!rawBuffer) throw new Error('Binary buffer required for 3MF');
    const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
    const loadedGroup = new ThreeMFLoader().parse(rawBuffer);
    loadedGroup.traverse(child => {
      if ((child as any).isMesh) {
        const m = child as import('three').Mesh;
        if (!primaryGeometry && m.geometry) primaryGeometry = m.geometry;
        m.material = defaultMat;
        parts.push({
          id: m.name || `3mf-part-${parts.length}`,
          name: m.name || `Part ${parts.length + 1}`,
          vertexCount: m.geometry.getAttribute('position')?.count || 0,
          triangleCount: Math.round((m.geometry.index?.count || m.geometry.getAttribute('position')?.count || 0) / 3),
          mesh: m,
        });
      }
    });
    root.add(loadedGroup);
  }

  // 7. GLTF / GLB Scene
  else if (format === 'gltf' || format === 'glb') {
    if (!rawBuffer) throw new Error('Binary buffer required for GLTF/GLB');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new Promise<any>((resolve, reject) => {
      new GLTFLoader().parse(rawBuffer!, '', resolve, reject);
    });
    gltf.scene.traverse((child: any) => {
      if (child.isMesh) {
        if (!primaryGeometry && child.geometry) primaryGeometry = child.geometry;
        parts.push({
          id: child.name || `gltf-mesh-${parts.length}`,
          name: child.name || `Mesh ${parts.length + 1}`,
          vertexCount: child.geometry.getAttribute('position')?.count || 0,
          triangleCount: Math.round((child.geometry.index?.count || child.geometry.getAttribute('position')?.count || 0) / 3),
          mesh: child,
        });
      }
    });
    root.add(gltf.scene);
  }

  // 8. VTK Unstructured Grid / PolyData
  else if (format === 'vtk') {
    if (!rawBuffer) throw new Error('Binary buffer required for VTK');
    const { VTKLoader } = await import('three/examples/jsm/loaders/VTKLoader.js');
    const geom = new VTKLoader().parse(rawBuffer, '');
    geom.computeVertexNormals();
    primaryGeometry = geom;
    const mesh = new three.Mesh(geom, defaultMat);
    root.add(mesh);
    const edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 28, options.edgeColor ?? 0x1d2d38);
    root.add(edges);
    parts.push({
      id: 'vtk-mesh',
      name: options.fileName || 'VTK Dataset',
      vertexCount: geom.getAttribute('position').count,
      triangleCount: Math.round((geom.index?.count || geom.getAttribute('position').count) / 3),
      mesh,
      edges,
    });
  }

  // 9. CalculiX / Abaqus .inp tetrahedral mesh parser
  else if (format === 'inp') {
    if (!textContent && rawBuffer) textContent = new TextDecoder().decode(rawBuffer);
    if (!textContent) throw new Error('Failed to read INP contents');

    const lines = textContent.split(/\r?\n/);
    const coords: Record<number, [number, number, number]> = {};
    const tets: number[][] = [];
    let inNode = false;
    let inElem = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('**')) continue;
      if (trimmed.startsWith('*')) {
        const upper = trimmed.toUpperCase();
        inNode = upper.startsWith('*NODE');
        inElem = upper.startsWith('*ELEMENT') && (upper.includes('C3D10') || upper.includes('C3D4') || upper.includes('TET'));
        continue;
      }
      if (inNode) {
        const parts = trimmed.split(',');
        if (parts.length >= 4) {
          coords[parseInt(parts[0])] = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
        }
      } else if (inElem) {
        const parts = trimmed.split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 5) {
          tets.push(parts.slice(1, 5)); // 4 corner vertices define tet volume faces
        }
      }
    }

    // Extract boundary faces (faces that appear exactly once)
    const faceCount: Record<string, { count: number; nodes: [number, number, number] }> = {};
    for (const tet of tets) {
      const fList: [number, number, number][] = [
        [tet[0], tet[1], tet[2]],
        [tet[0], tet[3], tet[1]],
        [tet[1], tet[3], tet[2]],
        [tet[2], tet[3], tet[0]],
      ];
      for (const f of fList) {
        const key = [...f].sort((a, b) => a - b).join('-');
        if (!faceCount[key]) faceCount[key] = { count: 1, nodes: f };
        else faceCount[key].count++;
      }
    }

    const boundaryTriangles = Object.values(faceCount).filter(f => f.count === 1).map(f => f.nodes);
    const uniqueNids = Array.from(new Set(boundaryTriangles.flat()));
    const nidToLocal = new Map<number, number>();
    const positions: number[] = [];
    uniqueNids.forEach((nid, idx) => {
      nidToLocal.set(nid, idx);
      const c = coords[nid] || [0, 0, 0];
      positions.push(c[0], c[1], c[2]);
    });

    const indices: number[] = [];
    for (const tri of boundaryTriangles) {
      indices.push(nidToLocal.get(tri[0])!, nidToLocal.get(tri[1])!, nidToLocal.get(tri[2])!);
    }

    const geom = new three.BufferGeometry();
    geom.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    primaryGeometry = geom;

    const mesh = new three.Mesh(geom, defaultMat);
    root.add(mesh);
    const edges = await createFeatureEdges(geom, options.creaseAngleDeg ?? 28, options.edgeColor ?? 0x1d2d38);
    root.add(edges);

    parts.push({
      id: 'inp-mesh',
      name: options.fileName || 'CalculiX Solid Mesh',
      vertexCount: uniqueNids.length,
      triangleCount: boundaryTriangles.length,
      mesh,
      edges,
    });
  } else {
    throw new Error(`Unsupported 3D file format: .${format}`);
  }

  if (!primaryGeometry) {
    primaryGeometry = new three.BufferGeometry();
  }

  // Calculate overall bounding box & center
  const box = new three.Box3().setFromObject(root);
  const size = box.getSize(new three.Vector3());
  const center = box.getCenter(new three.Vector3());
  const radius = Math.max(size.length() / 2, 0.001);

  return {
    root,
    geometry: primaryGeometry,
    parts,
    bounds: {
      min: box.min,
      max: box.max,
      size,
      center,
      radius,
    },
    format,
    feaData,
    dispose: () => disposeObject(root),
  };
}
