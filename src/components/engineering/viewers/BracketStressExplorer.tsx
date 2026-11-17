import { useEffect, useRef, useState, useId } from 'react';
import type { Object3D, Material, Texture, BufferGeometry } from 'three';
import { getColormapRGB, type ColormapName } from '../../../lib/engineering/colormaps';

export type LoadCaseId = 'lc1' | 'lc2' | 'lc3';
export type FilletRadiusId = 'r2' | 'r5' | 'r10';
export type ViewMode = 'stress' | 'displacement' | 'cad';

export interface BracketStressExplorerProps {
  /** Initial load case ('lc1' | 'lc2' | 'lc3'). Defaults to 'lc1'. */
  initialLoadCase?: LoadCaseId;
  /** Initial fillet radius ('r2' | 'r5' | 'r10'). Defaults to 'r5'. */
  initialFilletRadius?: FilletRadiusId;
  /** Initial display mode ('stress' | 'displacement' | 'cad'). Defaults to 'stress'. */
  initialMode?: ViewMode;
  /** Initial deformation amplification factor (0 to 200). Defaults to 50. */
  initialDeformationScale?: number;
  /** Colormap choice ('turbo' | 'viridis'). Defaults to 'turbo'. */
  initialColormap?: ColormapName;
  /** Canvas height in px. Defaults to 520. */
  height?: number;
  /** Optional container CSS class name. */
  className?: string;
  /** Whether to show the engineering telemetry HUD. Defaults to true. */
  showTelemetry?: boolean;
  /** Whether to show the direct CAD STEP file download links. Defaults to true. */
  showCadDownload?: boolean;
}

export interface TelemetryData {
  loadCaseLabel: string;
  loadDescription: string;
  radiusLabel: string;
  radiusMm: number;
  massGrams: number;
  peakStressMpa: number;
  maxDisplacementMm: number;
  yieldSafetyFactor: number;
  maxStressScale: number;
  maxDispScale: number;
}

// 7075-T651 Aluminum material constants
const YIELD_STRENGTH_MPA = 503.0; // Typical 7075-T651 yield allowable

// Benchmark FEA results from multi-mesh convergence and CalculiX validation studies
export const FEA_BENCHMARKS: Record<
  LoadCaseId,
  {
    label: string;
    description: string;
    filletData: Record<
      FilletRadiusId,
      {
        radiusMm: number;
        massGrams: number;
        peakStressMpa: number;
        maxDisplacementMm: number;
      }
    >;
  }
> = {
  lc1: {
    label: 'LC1: 2,000 N Downward',
    description: 'In-plane downward bearing load on web pin bore. Fillet notch is primary stress riser.',
    filletData: {
      r2: { radiusMm: 2, massGrams: 150.5, peakStressMpa: 81.53, maxDisplacementMm: 0.0348 },
      r5: { radiusMm: 5, massGrams: 151.5, peakStressMpa: 49.98, maxDisplacementMm: 0.0346 },
      r10: { radiusMm: 10, massGrams: 155.1, peakStressMpa: 30.47, maxDisplacementMm: 0.0341 },
    },
  },
  lc2: {
    label: 'LC2: 500 N Sideways',
    description: 'Lateral out-of-plane web bending. High compliance and peak stress at web outer root corners.',
    filletData: {
      r2: { radiusMm: 2, massGrams: 150.5, peakStressMpa: 145.0, maxDisplacementMm: 0.3958 },
      r5: { radiusMm: 5, massGrams: 151.5, peakStressMpa: 91.25, maxDisplacementMm: 0.3958 },
      r10: { radiusMm: 10, massGrams: 155.1, peakStressMpa: 58.0, maxDisplacementMm: 0.3902 },
    },
  },
  lc3: {
    label: 'LC3: 3,000 N Factored',
    description: '1.5x factored ultimate downward load case for yield margin screening.',
    filletData: {
      r2: { radiusMm: 2, massGrams: 150.5, peakStressMpa: 122.3, maxDisplacementMm: 0.0522 },
      r5: { radiusMm: 5, massGrams: 151.5, peakStressMpa: 74.97, maxDisplacementMm: 0.0519 },
      r10: { radiusMm: 10, massGrams: 155.1, peakStressMpa: 45.71, maxDisplacementMm: 0.0512 },
    },
  },
};

export function getTelemetry(lc: LoadCaseId, radius: FilletRadiusId): TelemetryData {
  const caseInfo = FEA_BENCHMARKS[lc];
  const radiusInfo = caseInfo.filletData[radius];
  const peakStress = radiusInfo.peakStressMpa;
  const safetyFactor = Math.round((YIELD_STRENGTH_MPA / peakStress) * 10) / 10;
  const maxStressScale = lc === 'lc2' ? 150.0 : lc === 'lc3' ? 130.0 : 85.0;
  const maxDispScale = lc === 'lc2' ? 0.40 : 0.055;

  return {
    loadCaseLabel: caseInfo.label,
    loadDescription: caseInfo.description,
    radiusLabel: `R${radiusInfo.radiusMm} (${radiusInfo.radiusMm} mm)`,
    radiusMm: radiusInfo.radiusMm,
    massGrams: radiusInfo.massGrams,
    peakStressMpa: peakStress,
    maxDisplacementMm: radiusInfo.maxDisplacementMm,
    yieldSafetyFactor: safetyFactor,
    maxStressScale,
    maxDispScale,
  };
}

/** Dispose Three.js hierarchy cleanly */
function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m));
  });
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
  geometries.forEach(g => g.dispose());
}

export function BracketStressExplorer({
  initialLoadCase = 'lc1',
  initialFilletRadius = 'r5',
  initialMode = 'stress',
  initialDeformationScale = 50,
  initialColormap = 'turbo',
  height = 540,
  className = '',
  showTelemetry = true,
  showCadDownload = true,
}: BracketStressExplorerProps) {
  const compId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);

  const [loadCase, setLoadCase] = useState<LoadCaseId>(initialLoadCase);
  const [radius, setRadius] = useState<FilletRadiusId>(initialFilletRadius);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [deformationScale, setDeformationScale] = useState<number>(initialDeformationScale);
  const [colormap, setColormap] = useState<ColormapName>(initialColormap);
  const [showWireframe, setShowWireframe] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const telemetry = getTelemetry(loadCase, radius);

  // Engine references to update without tearing down the WebGL context
  const updateSceneRef = useRef<((lc: LoadCaseId, rad: FilletRadiusId, mode: ViewMode, scale: number, cmap: ColormapName, wire: boolean) => void) | null>(null);

  useEffect(() => {
    if (updateSceneRef.current) {
      updateSceneRef.current(loadCase, radius, viewMode, deformationScale, colormap, showWireframe);
    }
  }, [loadCase, radius, viewMode, deformationScale, colormap, showWireframe]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let renderer: import('three').WebGLRenderer | undefined;
    let scene: import('three').Scene | undefined;
    let camera: import('three').PerspectiveCamera | undefined;
    let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls | undefined;
    let bracketGroup: import('three').Group | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;

    setStatus('loading');

    function stop() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    function render() {
      frame = 0;
      if (disposed || document.hidden || !renderer || !scene || !camera || !controls) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }

    async function init() {
      try {
        const [three, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);

        if (disposed || !host) return;

        scene = new three.Scene();
        camera = new three.PerspectiveCamera(45, 1, 1, 2000);
        camera.position.set(130, 110, 150);

        renderer = new three.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        host.replaceChildren(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 0, 30);

        // Lighting
        const ambientLight = new three.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        const keyLight = new three.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(120, 150, 180);
        scene.add(keyLight);

        const fillLight = new three.DirectionalLight(0xd4e4f7, 0.6);
        fillLight.position.set(-100, -80, -60);
        scene.add(fillLight);

        // Coordinate helper and ground reference grid
        const gridHelper = new three.GridHelper(160, 16, 0x5a6872, 0x333e48);
        gridHelper.position.y = -0.1;
        gridHelper.rotation.x = 0; // standard x-z grid
        // Re-orient grid on z=0 plane: bracket rests on z=0..6
        gridHelper.rotation.x = Math.PI / 2;
        scene.add(gridHelper);

        const axesHelper = new three.AxesHelper(25);
        axesHelper.position.set(-65, -45, 0);
        scene.add(axesHelper);

        bracketGroup = new three.Group();
        scene.add(bracketGroup);

        // Theme reactive background
        const updateTheme = () => {
          if (!scene) return;
          const isDark = document.documentElement.dataset.theme !== 'light';
          scene.background = new three.Color(isDark ? 0x14181c : 0xf4f6f8);
        };
        updateTheme();
        themeObserver = new MutationObserver(updateTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Responsive resize
        const updateSize = () => {
          if (!host || !camera || !renderer) return;
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (!width || !height) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        };
        updateSize();
        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(host);

        // Procedural bracket geometry generator
        function buildBracketMesh(
          lc: LoadCaseId,
          rad: FilletRadiusId,
          mode: ViewMode,
          scale: number,
          cmap: ColormapName,
          wire: boolean
        ) {
          if (!bracketGroup) return;
          disposeObject(bracketGroup);
          bracketGroup.clear();

          const rMm = FEA_BENCHMARKS[lc].filletData[rad].radiusMm;
          const tele = getTelemetry(lc, rad);

          // 1. Base Plate Shape: 100 x 60 mm with 4 bolt holes (dia 6.6 mm)
          const baseShape = new three.Shape();
          baseShape.moveTo(-50, -30);
          baseShape.lineTo(50, -30);
          baseShape.lineTo(50, 30);
          baseShape.lineTo(-50, 30);
          baseShape.closePath();

          // Bolt hole cutout centers: (±38, ±20), radius 3.3 mm
          const boltHoles = [
            [-38, -20],
            [38, -20],
            [38, 20],
            [-38, 20],
          ];
          boltHoles.forEach(([hx, hy]) => {
            const holePath = new three.Path();
            holePath.absarc(hx, hy, 3.3, 0, Math.PI * 2, true);
            baseShape.holes.push(holePath);
          });

          // Extrude base plate along Z: depth 6 mm
          const baseGeom = new three.ExtrudeGeometry(baseShape, {
            depth: 6,
            bevelEnabled: false,
            curveSegments: 24,
          });

          // 2. Upright Web Shape in (X, Z) plane:
          // Web is X in [-4, 4], Z in [6, 66] (height 60 mm).
          // Pin bore: dia 12 mm (radius 6 mm) at (0, 42).
          // Extruded along Y from -20 to 20 (depth 40 mm).
          const webShape = new three.Shape();
          // Web profile with rounded top crown (radius 20 mm centered at Z=42)
          webShape.moveTo(-4, 6);
          webShape.lineTo(4, 6);
          webShape.lineTo(4, 66);
          webShape.lineTo(-4, 66);
          webShape.closePath();

          const webGeom = new three.ExtrudeGeometry(webShape, {
            depth: 40,
            bevelEnabled: false,
            curveSegments: 24,
          });
          // Rotate web so its extrusion depth lies along Y:
          // Initially extrudes along Z. We rotate and translate into place:
          webGeom.rotateX(Math.PI / 2);
          webGeom.translate(0, 20, 0);

          // Web pin bore cylinder subtraction / visual geometry:
          // We carve the visual pin bore through web (dia 12 mm, Z=42, Y in -20..20)
          const pinCylGeom = new three.CylinderGeometry(6, 6, 40.2, 32, 1, true);
          pinCylGeom.rotateX(Math.PI / 2);
          pinCylGeom.translate(0, 0, 42);

          // 3. Parametric Fillet transition strips connecting Web (X=±4) to Base (Z=6)
          // Along Y from -20 to 20
          function createFilletGeom(sign: number) {
            const filletShape = new three.Shape();
            const webX = sign * 4;
            const baseX = sign * (4 + rMm);
            const topZ = 6 + rMm;
            const botZ = 6;

            filletShape.moveTo(webX, botZ);
            filletShape.lineTo(baseX, botZ);
            // Arc blending to web face
            const arcCenterX = baseX;
            const arcCenterZ = topZ;
            const startAngle = sign > 0 ? Math.PI : 0;
            const endAngle = sign > 0 ? (3 * Math.PI) / 2 : (3 * Math.PI) / 2;
            filletShape.absarc(arcCenterX, arcCenterZ, rMm, startAngle, endAngle, sign < 0);
            filletShape.closePath();

            const fGeom = new three.ExtrudeGeometry(filletShape, {
              depth: 40,
              bevelEnabled: false,
              curveSegments: 16,
            });
            fGeom.rotateX(Math.PI / 2);
            fGeom.translate(0, 20, 0);
            return fGeom;
          }

          const filletPos = createFilletGeom(1);
          const filletNeg = createFilletGeom(-1);

          // Merge sub-geometries into a unified bracket mesh
          // We can assemble them into an object hierarchy or composite BufferGeometry
          const parts = [
            { geom: baseGeom },
            { geom: webGeom },
            { geom: filletPos },
            { geom: filletNeg },
          ];

          parts.forEach(({ geom }) => {
            const posAttr = geom.getAttribute('position');
            const count = posAttr.count;
            const colors = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
              const x = posAttr.getX(i);
              const y = posAttr.getY(i);
              const z = posAttr.getZ(i);

              // Calculate physics displacement field:
              let ux = 0;
              let uy = 0;
              let uz = 0;
              let stress = 0;

              // Distance to fixed bolt holes
              const minBoltDist = Math.min(
                ...boltHoles.map(([bx, by]) => Math.hypot(x - bx, y - by))
              );
              const isFixed = z <= 6 && minBoltDist <= 6.5;

              if (!isFixed) {
                if (lc === 'lc1' || lc === 'lc3') {
                  // In-plane downward load
                  const factor = lc === 'lc3' ? 1.5 : 1.0;
                  const tipDisp = tele.maxDisplacementMm;
                  if (z > 6) {
                    uz = -tipDisp * ((z - 6) / 60) * factor;
                    // Poisson lateral bulge
                    ux = (x > 0 ? 1 : -1) * 0.002 * ((z - 6) / 60) * factor;
                  }
                  // Notch stress field
                  const notchDist = Math.hypot(Math.abs(x) - 4, z - 6);
                  const boreDist = Math.hypot(x, z - 42);
                  const peak = tele.peakStressMpa;
                  const nom = 6.25 * factor;
                  const bearing = 26.5 * factor;
                  stress = nom + (peak - nom) * Math.exp(-notchDist / (1.6 * rMm)) + bearing * Math.exp(-boreDist / 9);
                } else {
                  // LC2: Lateral weak-axis bending (500 N in +Y)
                  const tipDisp = tele.maxDisplacementMm;
                  if (z > 6) {
                    // Cubic cantilever profile
                    const hRel = (z - 6) / 60;
                    uy = tipDisp * (1.5 * Math.pow(hRel, 2) - 0.5 * Math.pow(hRel, 3));
                  }
                  // Peak stress at outer root edge (|y| -> 20, z -> 6, |x| -> 4)
                  const rootEdgeDist = Math.hypot(Math.abs(y) - 20, Math.abs(x) - 4, z - 6);
                  const peak = tele.peakStressMpa;
                  const nom = 12.0;
                  stress = nom + (peak - nom) * Math.exp(-rootEdgeDist / (1.8 * rMm));
                }
              }

              // Apply deformation magnification
              if (scale > 0 && !isFixed) {
                posAttr.setXYZ(i, x + ux * scale, y + uy * scale, z + uz * scale);
              }

              // Apply color mapping
              if (mode === 'cad') {
                colors[i * 3] = 0.72;
                colors[i * 3 + 1] = 0.76;
                colors[i * 3 + 2] = 0.80;
              } else if (mode === 'displacement') {
                const totalDisp = Math.hypot(ux, uy, uz);
                const t = Math.min(Math.max(totalDisp / tele.maxDispScale, 0), 1);
                const rgb = getColormapRGB(t, cmap);
                colors[i * 3] = rgb.r / 255;
                colors[i * 3 + 1] = rgb.g / 255;
                colors[i * 3 + 2] = rgb.b / 255;
              } else {
                // Stress mode
                const t = Math.min(Math.max(stress / tele.maxStressScale, 0), 1);
                const rgb = getColormapRGB(t, cmap);
                colors[i * 3] = rgb.r / 255;
                colors[i * 3 + 1] = rgb.g / 255;
                colors[i * 3 + 2] = rgb.b / 255;
              }
            }

            posAttr.needsUpdate = true;
            geom.computeVertexNormals();
            geom.setAttribute('color', new three.BufferAttribute(colors, 3));

            const mat = mode === 'cad'
              ? new three.MeshStandardMaterial({
                  color: 0x9fb0bd,
                  metalness: 0.85,
                  roughness: 0.3,
                  wireframe: wire,
                })
              : new three.MeshStandardMaterial({
                  vertexColors: true,
                  metalness: 0.2,
                  roughness: 0.45,
                  wireframe: wire,
                });

            const mesh = new three.Mesh(geom, mat);
            bracketGroup?.add(mesh);
          });

          // Pin bore visual ring / highlight
          const boreRingMat = new three.MeshBasicMaterial({
            color: mode === 'cad' ? 0x233b43 : 0xffffff,
            wireframe: true,
          });
          const boreMesh = new three.Mesh(pinCylGeom, boreRingMat);
          bracketGroup.add(boreMesh);
        }

        updateSceneRef.current = buildBracketMesh;

        // Initial build
        buildBracketMesh(loadCase, radius, viewMode, deformationScale, colormap, showWireframe);

        resetCameraRef.current = () => {
          if (!camera || !controls) return;
          camera.position.set(130, 110, 150);
          controls.target.set(0, 0, 30);
          controls.update();
        };

        setStatus('ready');
        render();
      } catch (err) {
        console.error('Bracket 3D viewer failed to load:', err);
        setStatus('error');
      }
    }

    void init();

    return () => {
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      if (bracketGroup) disposeObject(bracketGroup);
      if (scene) disposeObject(scene);
      controls?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await sectionRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen not supported or permitted
    }
  }

  return (
    <section
      ref={sectionRef}
      className={`bracket-explorer eng-viewer ${className}`}
      aria-label="Aerospace Mounting Bracket 3D CAD & FEA Explorer"
    >
      {/* 3D Canvas Host */}
      <div className="bracket-explorer-canvas-wrap" style={{ height }}>
        <div ref={canvasHostRef} className="eng-viewer-canvas" />

        {/* Viewport Top Toolbar */}
        <div className="eng-viewer-toolbar bracket-explorer-top-bar">
          <button
            type="button"
            onClick={() => resetCameraRef.current?.()}
            title="Reset Camera View"
          >
            Reset View
          </button>
          <button
            type="button"
            onClick={() => setShowWireframe(w => !w)}
            aria-pressed={showWireframe}
            title="Toggle Mesh Wireframe"
          >
            {showWireframe ? 'Solid' : 'Wireframe'}
          </button>
          <button
            type="button"
            onClick={() => setColormap(c => (c === 'turbo' ? 'viridis' : 'turbo'))}
            title="Switch Scientific Colormap"
            disabled={viewMode === 'cad'}
          >
            Colormap: {colormap === 'turbo' ? 'Turbo' : 'Viridis'}
          </button>
          <button type="button" onClick={toggleFullscreen} title="Toggle Fullscreen">
            Fullscreen
          </button>
        </div>

        {/* Dynamic Colorbar Legend */}
        {viewMode !== 'cad' && (
          <div className="bracket-explorer-colorbar-card" aria-label="Colorbar scale">
            <div className="bracket-explorer-colorbar-title">
              {viewMode === 'stress' ? 'von Mises Stress (MPa)' : 'Displacement (mm)'}
            </div>
            <div
              className={`bracket-explorer-colorbar-gradient colormap-${colormap}`}
              style={{
                background:
                  colormap === 'turbo'
                    ? 'linear-gradient(to right, #30123b, #4686fb, #1ae4b6, #a4fc3c, #fbb938, #e35917, #7a0403)'
                    : 'linear-gradient(to right, #440154, #482878, #3e4a89, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
              }}
            />
            <div className="bracket-explorer-colorbar-labels">
              <span>0.0</span>
              <span>
                {viewMode === 'stress'
                  ? `${Math.round(telemetry.maxStressScale / 2)}`
                  : `${(telemetry.maxDispScale / 2).toFixed(3)}`}
              </span>
              <span>
                {viewMode === 'stress'
                  ? `${Math.round(telemetry.maxStressScale)}`
                  : `${telemetry.maxDispScale.toFixed(3)}`}
              </span>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="eng-viewer-status" role="status">
            Loading interactive 3D WebGL engine…
          </div>
        )}
        {status === 'error' && (
          <div className="eng-viewer-status" role="alert">
            WebGL is not supported or encountered an initialization error.
          </div>
        )}
      </div>

      {/* Control Console */}
      <div className="bracket-explorer-panel">
        <div className="bracket-explorer-controls-grid">
          {/* Fillet Radius Selector */}
          <div className="bracket-explorer-group">
            <label className="bracket-explorer-label" id={`${compId}-radius-label`}>
              Fillet Radius Blend:
            </label>
            <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-radius-label`}>
              {(['r2', 'r5', 'r10'] as FilletRadiusId[]).map(rId => (
                <button
                  key={rId}
                  type="button"
                  className={`bracket-explorer-btn ${radius === rId ? 'active' : ''}`}
                  onClick={() => setRadius(rId)}
                  aria-pressed={radius === rId}
                >
                  {rId.toUpperCase()} {rId === 'r5' ? '(Baseline)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Load Case Selector */}
          <div className="bracket-explorer-group">
            <label className="bracket-explorer-label" id={`${compId}-lc-label`}>
              FEA Load Case:
            </label>
            <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-lc-label`}>
              {(['lc1', 'lc2', 'lc3'] as LoadCaseId[]).map(lcId => (
                <button
                  key={lcId}
                  type="button"
                  className={`bracket-explorer-btn ${loadCase === lcId ? 'active' : ''}`}
                  onClick={() => setLoadCase(lcId)}
                  aria-pressed={loadCase === lcId}
                >
                  {lcId === 'lc1'
                    ? 'LC1 (2 kN Down)'
                    : lcId === 'lc2'
                    ? 'LC2 (500 N Side)'
                    : 'LC3 (3 kN Factored)'}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Selector */}
          <div className="bracket-explorer-group">
            <label className="bracket-explorer-label" id={`${compId}-mode-label`}>
              Display Mode:
            </label>
            <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-mode-label`}>
              {(
                [
                  { id: 'stress', label: 'Stress Contour' },
                  { id: 'displacement', label: 'Displacement' },
                  { id: 'cad', label: 'Nominal CAD' },
                ] as { id: ViewMode; label: string }[]
              ).map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`bracket-explorer-btn ${viewMode === m.id ? 'active' : ''}`}
                  onClick={() => setViewMode(m.id)}
                  aria-pressed={viewMode === m.id}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Deformation Magnification Slider */}
          <div className="bracket-explorer-group">
            <div className="bracket-explorer-slider-header">
              <label htmlFor={`${compId}-deform-slider`} className="bracket-explorer-label">
                Deformation Magnification:
              </label>
              <span className="bracket-explorer-slider-value">{deformationScale}×</span>
            </div>
            <input
              id={`${compId}-deform-slider`}
              type="range"
              min={0}
              max={200}
              step={5}
              value={deformationScale}
              onChange={e => setDeformationScale(Number(e.target.value))}
              className="bracket-explorer-slider"
            />
          </div>
        </div>

        {/* Engineering Telemetry HUD */}
        {showTelemetry && (
          <div className="bracket-explorer-hud">
            <div className="bracket-explorer-metric">
              <span className="bracket-metric-label">Peak von Mises Stress</span>
              <span className="bracket-metric-value">{telemetry.peakStressMpa.toFixed(1)} MPa</span>
              <span className="bracket-metric-sub">CalculiX Quadratic Solid</span>
            </div>
            <div className="bracket-explorer-metric">
              <span className="bracket-metric-label">Max Deflection</span>
              <span className="bracket-metric-value">{telemetry.maxDisplacementMm.toFixed(4)} mm</span>
              <span className="bracket-metric-sub">Tip Bore Vector |u|</span>
            </div>
            <div className="bracket-explorer-metric">
              <span className="bracket-metric-label">Part Mass</span>
              <span className="bracket-metric-value">{telemetry.massGrams.toFixed(1)} g</span>
              <span className="bracket-metric-sub">7075-T651 Density</span>
            </div>
            <div className="bracket-explorer-metric">
              <span className="bracket-metric-label">Yield Safety Margin</span>
              <span className="bracket-metric-value bracket-metric-highlight">
                SF {telemetry.yieldSafetyFactor.toFixed(1)}
              </span>
              <span className="bracket-metric-sub">Allowable: 503 MPa</span>
            </div>
          </div>
        )}

        {/* Load Case Context Note */}
        <p className="bracket-explorer-caption">
          <strong>{telemetry.loadCaseLabel}:</strong> {telemetry.loadDescription}
        </p>

        {/* Direct CAD STEP File Downloads */}
        {showCadDownload && (
          <div className="bracket-explorer-downloads">
            <span className="bracket-downloads-title">Exact Parametric CAD Models (STEP):</span>
            <div className="bracket-downloads-links">
              <a
                href="/Site/notebooks/aerospace-bracket/geometry/bracket_r2.step"
                download="bracket_r2.step"
                className="bracket-download-pill"
              >
                Download R2 Blend (150.5 g) ↓
              </a>
              <a
                href="/Site/notebooks/aerospace-bracket/geometry/bracket_r5.step"
                download="bracket_r5.step"
                className="bracket-download-pill active"
              >
                Download R5 Baseline (151.5 g) ↓
              </a>
              <a
                href="/Site/notebooks/aerospace-bracket/geometry/bracket_r10.step"
                download="bracket_r10.step"
                className="bracket-download-pill"
              >
                Download R10 Blend (155.1 g) ↓
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
