import { useEffect, useRef, useState, useId } from 'react';
import type { Camera } from 'three';
import { getColormapRGB, type ColormapName } from '../../../lib/engineering/colormaps';
import { loadCadOrMeshAsset, disposeObject, type LoadedCadModel, type FeaSurfaceDataset } from '../../../lib/engineering/cadLoader';

export type LoadCaseId = 'lc1' | 'lc2' | 'lc3';
export type FilletRadiusId = 'r2' | 'r5' | 'r10';
export type ViewMode = 'stress' | 'displacement' | 'cad';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';

export interface BracketStressExplorerProps {
  initialLoadCase?: LoadCaseId;
  initialFilletRadius?: FilletRadiusId;
  initialMode?: ViewMode;
  initialDeformationScale?: number;
  initialColormap?: ColormapName;
  height?: number;
  className?: string;
  showTelemetry?: boolean;
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

const YIELD_STRENGTH_MPA = 503.0; // 7075-T651 yield allowable

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
    description: 'In-plane downward bearing load on web pin bore. Fillet notch is the primary stress concentration.',
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
    radiusLabel: `R${radiusInfo.radiusMm}`,
    radiusMm: radiusInfo.radiusMm,
    massGrams: radiusInfo.massGrams,
    peakStressMpa: peakStress,
    maxDisplacementMm: radiusInfo.maxDisplacementMm,
    yieldSafetyFactor: safetyFactor,
    maxStressScale,
    maxDispScale,
  };
}

export { disposeObject };

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/Site') ? '/Site' : '';
  }
  return '';
}

// In-memory caches for fetched datasets across toggles
const stepModelsCache = new Map<string, ArrayBuffer>();
const feaDatasetsCache = new Map<string, FeaSurfaceDataset>();

export function BracketStressExplorer({
  initialLoadCase = 'lc1',
  initialFilletRadius = 'r5',
  initialMode = 'stress',
  initialDeformationScale = 50,
  initialColormap = 'turbo',
  height = 520,
  className = '',
  showTelemetry = true,
  showCadDownload = true,
}: BracketStressExplorerProps) {
  const compId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const [loadCase, setLoadCase] = useState<LoadCaseId>(initialLoadCase);
  const [radius, setRadius] = useState<FilletRadiusId>(initialFilletRadius);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [deformationScale, setDeformationScale] = useState<number>(initialDeformationScale);
  const [colormap, setColormap] = useState<ColormapName>(initialColormap);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showVectors, setShowVectors] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [isOrtho, setIsOrtho] = useState(false);
  const [isClippingActive, setIsClippingActive] = useState(false);
  const [clipAxis, setClipAxis] = useState<'x' | 'y' | 'z'>('x');
  const [clipOffset, setClipOffset] = useState<number>(0);
  const [clipInverted, setClipInverted] = useState(false);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusMsg, setStatusMsg] = useState('Loading CAD & FEA data…');
  const [probeInfo, setProbeInfo] = useState<{
    coord: [number, number, number];
    stressMpa?: number;
    dispMm?: number;
    dispVec?: [number, number, number];
  } | null>(null);

  const telemetry = getTelemetry(loadCase, radius);

  const resetCameraRef = useRef<(() => void) | null>(null);
  const setCameraPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);
  const updateSceneRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    updateSceneRef.current?.();
  }, [loadCase, radius, viewMode, deformationScale, colormap, showWireframe, showVectors, showGhost, isClippingActive, clipAxis, clipOffset, clipInverted]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    let disposed = false;
    let visible = false;
    let frame = 0;
    let renderer: import('three').WebGLRenderer | undefined;
    let scene: import('three').Scene | undefined;
    let perspCamera: import('three').PerspectiveCamera | undefined;
    let orthoCamera: import('three').OrthographicCamera | undefined;
    let activeCamera: Camera | undefined;
    let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls | undefined;
    let clipPlane: import('three').Plane | undefined;

    let currentGroup: import('three').Group | undefined;
    let activeCadModel: LoadedCadModel | undefined;

    let resizeObserver: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;

    setStatus('loading');
    setStatusMsg('Initializing WebGL CAD/CAE engine…');

    function stop() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    function render() {
      frame = 0;
      if (disposed || !visible || document.hidden || !renderer || !scene || !activeCamera || !controls) return;
      controls.update();
      renderer.render(scene, activeCamera);
      frame = requestAnimationFrame(render);
    }

    function syncVisibility() {
      stop();
      if (!disposed && visible && !document.hidden && renderer) {
        frame = requestAnimationFrame(render);
      }
    }

    async function init() {
      try {
        const [three, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);

        if (disposed || !host) return;

        scene = new three.Scene();

        // Cameras Setup
        const aspect = host.clientWidth / (host.clientHeight || 1);
        perspCamera = new three.PerspectiveCamera(38, aspect, 1, 3000);
        perspCamera.position.set(115, 95, 125);

        const frustumSize = 135;
        orthoCamera = new three.OrthographicCamera(
          (-frustumSize * aspect) / 2,
          (frustumSize * aspect) / 2,
          frustumSize / 2,
          -frustumSize / 2,
          1,
          3000
        );
        orthoCamera.position.copy(perspCamera.position);

        activeCamera = isOrtho ? orthoCamera : perspCamera;

        renderer = new three.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.localClippingEnabled = true;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.clippingPlanes = [];
        host.replaceChildren(renderer.domElement);

        controls = new OrbitControls(activeCamera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 33, 0); // Center around upright web middle

        // Lighting Rig
        const ambient = new three.AmbientLight(0xffffff, 0.85);
        scene.add(ambient);

        const keyLight = new three.DirectionalLight(0xffffff, 1.15);
        keyLight.position.set(120, 180, 140);
        scene.add(keyLight);

        const fillLight = new three.DirectionalLight(0xdde8f2, 0.65);
        fillLight.position.set(-130, -50, -90);
        scene.add(fillLight);

        const topRim = new three.DirectionalLight(0xffffff, 0.45);
        topRim.position.set(0, 200, 0);
        scene.add(topRim);

        // Ground Floor Grid at Base Bottom (Z = 0)
        // In our geometry: base is [-50, 50] x [-30, 30] x [0, 6], web up to Z=66
        const floorGrid = new three.GridHelper(180, 18, 0x64748b, 0x2e3844);
        floorGrid.position.y = 0;
        scene.add(floorGrid);

        // Coordinate axes indicator at corner
        const axesHelper = new three.AxesHelper(22);
        axesHelper.position.set(-54, 0.2, -34);
        scene.add(axesHelper);

        // Section plane
        clipPlane = new three.Plane(new three.Vector3(1, 0, 0), 0);

        const updateTheme = () => {
          if (!scene) return;
          const isDark = document.documentElement.dataset.theme !== 'light';
          scene.background = new three.Color(isDark ? 0x13171d : 0xf6f7f9);
          floorGrid.material = new three.LineBasicMaterial({
            color: isDark ? 0x3d4754 : 0xc7d1da,
            transparent: true,
            opacity: 0.65,
          });
        };
        updateTheme();
        themeObserver = new MutationObserver(updateTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        currentGroup = new three.Group();
        scene.add(currentGroup);

        // Preload function for STEP models
        async function loadStepModel(rad: FilletRadiusId): Promise<ArrayBuffer> {
          if (stepModelsCache.has(rad)) return stepModelsCache.get(rad)!;
          const base = getBaseUrl();
          const url = `${base}/notebooks/aerospace-bracket/geometry/bracket_${rad}.step`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
          const buf = await res.arrayBuffer();
          stepModelsCache.set(rad, buf);
          return buf;
        }

        // Preload function for FEA datasets
        async function loadFeaDataset(rad: FilletRadiusId): Promise<FeaSurfaceDataset> {
          if (feaDatasetsCache.has(rad)) return feaDatasetsCache.get(rad)!;
          const base = getBaseUrl();
          const url = `${base}/notebooks/aerospace-bracket/fea/bracket_${rad}_fea.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`);
          const dataset = (await res.json()) as FeaSurfaceDataset;
          feaDatasetsCache.set(rad, dataset);
          return dataset;
        }

        // Build / Update the Active 3D Scene
        async function rebuildScene() {
          if (!currentGroup || disposed) return;

          setStatus('loading');
          setStatusMsg(viewMode === 'cad' ? `Loading exact STEP CAD model (bracket_${radius}.step)…` : `Loading solved FEA mesh (bracket_${radius}_fea.json)…`);

          disposeObject(currentGroup);
          currentGroup.clear();
          if (activeCadModel) {
            activeCadModel.dispose();
            activeCadModel = undefined;
          }

          // Section clipping update
          if (renderer && clipPlane) {
            if (isClippingActive) {
              const normal = new three.Vector3(
                clipAxis === 'x' ? 1 : 0,
                clipAxis === 'y' ? 1 : 0,
                clipAxis === 'z' ? 1 : 0
              );
              if (clipInverted) normal.negate();
              clipPlane.normal.copy(normal);
              clipPlane.constant = clipInverted ? clipOffset : -clipOffset;
              renderer.clippingPlanes = [clipPlane];
            } else {
              renderer.clippingPlanes = [];
            }
          }

          try {
            // =========================================================
            // 1. CAD MODE: Real OpenCASCADE STEP Geometry
            // =========================================================
            if (viewMode === 'cad') {
              const stepBuf = await loadStepModel(radius);
              const loaded = await loadCadOrMeshAsset(stepBuf, {
                format: 'step',
                fileName: `bracket_${radius}.step`,
                color: 0x98a8b8,
                metalness: 0.78,
                roughness: 0.3,
                creaseAngleDeg: 24,
                edgeColor: 0x182430,
              });

              if (disposed) {
                loaded.dispose();
                return;
              }

              activeCadModel = loaded;
              currentGroup.add(loaded.root);
            }
            // =========================================================
            // 2. FEA STRESS & DISPLACEMENT MODES: Real C3D10 Surface Mesh
            // =========================================================
            else {
              const dataset = await loadFeaDataset(radius);
              const caseData = dataset.loads[loadCase] || dataset.loads.lc1;

              const numNodes = dataset.numNodes;
              const positions = new Float32Array(dataset.positions);
              const displacements = caseData.displacements;
              const stresses = caseData.nodalStress;

              // Deformed positions buffer
              const deformedPositions = new Float32Array(numNodes * 3);
              const vertexColors = new Float32Array(numNodes * 3);
              const scale = deformationScale;

              const maxStress = telemetry.maxStressScale;
              const maxDisp = telemetry.maxDispScale;

              for (let i = 0; i < numNodes; i++) {
                const x0 = positions[i * 3];
                const y0 = positions[i * 3 + 1];
                const z0 = positions[i * 3 + 2];

                const ux = displacements[i * 3];
                const uy = displacements[i * 3 + 1];
                const uz = displacements[i * 3 + 2];

                deformedPositions[i * 3] = x0 + ux * scale;
                deformedPositions[i * 3 + 1] = y0 + uy * scale;
                deformedPositions[i * 3 + 2] = z0 + uz * scale;

                // Color interpolation
                if (viewMode === 'displacement') {
                  const dispMag = Math.hypot(ux, uy, uz);
                  const t = Math.min(Math.max(dispMag / (maxDisp + 1e-9), 0), 1);
                  const rgb = getColormapRGB(t, colormap);
                  vertexColors[i * 3] = rgb.r / 255;
                  vertexColors[i * 3 + 1] = rgb.g / 255;
                  vertexColors[i * 3 + 2] = rgb.b / 255;
                } else {
                  // Stress mode
                  const s = stresses[i];
                  const t = Math.min(Math.max(s / (maxStress + 1e-9), 0), 1);
                  const rgb = getColormapRGB(t, colormap);
                  vertexColors[i * 3] = rgb.r / 255;
                  vertexColors[i * 3 + 1] = rgb.g / 255;
                  vertexColors[i * 3 + 2] = rgb.b / 255;
                }
              }

              // Build deformed surface mesh
              const geom = new three.BufferGeometry();
              geom.setAttribute('position', new three.BufferAttribute(deformedPositions, 3));
              geom.setAttribute('color', new three.BufferAttribute(vertexColors, 3));
              geom.setIndex(dataset.triangles);
              geom.computeVertexNormals();

              const mat = new three.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.18,
                roughness: 0.42,
                wireframe: showWireframe,
                side: three.DoubleSide,
              });
              const mesh = new three.Mesh(geom, mat);
              currentGroup.add(mesh);

              // Feature edge lines (if provided)
              if (dataset.featureEdges && dataset.featureEdges.length > 0 && !showWireframe) {
                const edgeGeom = new three.BufferGeometry();
                edgeGeom.setAttribute('position', geom.getAttribute('position'));
                edgeGeom.setIndex(dataset.featureEdges);
                const edgeMat = new three.LineBasicMaterial({
                  color: 0x1d2732,
                  transparent: true,
                  opacity: 0.75,
                });
                const edgeLines = new three.LineSegments(edgeGeom, edgeMat);
                edgeLines.renderOrder = 2;
                currentGroup.add(edgeLines);
              }

              // Ghost Undeformed Mesh (when deformed, scale > 0)
              if (showGhost && scale > 0) {
                const ghostGeom = new three.BufferGeometry();
                ghostGeom.setAttribute('position', new three.BufferAttribute(positions, 3));
                ghostGeom.setIndex(dataset.triangles);
                ghostGeom.computeVertexNormals();

                const ghostMat = new three.MeshBasicMaterial({
                  color: 0x6e7b88,
                  wireframe: true,
                  transparent: true,
                  opacity: 0.22,
                });
                const ghostMesh = new three.Mesh(ghostGeom, ghostMat);
                currentGroup.add(ghostMesh);
              }

              // 3D Load & Boundary Condition Indicators
              if (showVectors) {
                // Bolt Holes Fixed Constraints (at (±38, ±20, 0..6))
                const boltLocations = [
                  [-38, -20],
                  [38, -20],
                  [38, 20],
                  [-38, 20],
                ];
                boltLocations.forEach(([bx, by]) => {
                  const coneGeom = new three.ConeGeometry(2.4, 4.5, 12);
                  const coneMat = new three.MeshBasicMaterial({ color: 0x22c55e }); // green
                  const cone = new three.Mesh(coneGeom, coneMat);
                  cone.position.set(bx, -2.5, by); // point up at base hole
                  cone.rotation.x = Math.PI;
                  currentGroup?.add(cone);
                });

                // Load Arrows
                // Bore center is at X=0, Y=0, Z=48 (in mm)
                // LC1 / LC3: 2000 N / 3000 N downward along -Z
                if (loadCase === 'lc1' || loadCase === 'lc3') {
                  const arrowLength = loadCase === 'lc3' ? 26 : 20;
                  const arrowDir = new three.Vector3(0, -1, 0); // pointing down
                  const arrowOrigin = new three.Vector3(0, 48 + arrowLength, 0);
                  const arrowColor = 0xe11d48; // crimson red
                  const arrowHelper = new three.ArrowHelper(arrowDir, arrowOrigin, arrowLength, arrowColor, 5, 3.5);
                  currentGroup.add(arrowHelper);
                }
                // LC2: 500 N sideways out-of-plane along +Y (or pin axis)
                else if (loadCase === 'lc2') {
                  const arrowLength = 22;
                  const arrowDir = new three.Vector3(0, 0, 1); // pointing out-of-plane
                  const arrowOrigin = new three.Vector3(0, 48, -arrowLength - 4);
                  const arrowColor = 0xf59e0b; // amber
                  const arrowHelper = new three.ArrowHelper(arrowDir, arrowOrigin, arrowLength, arrowColor, 5, 3.5);
                  currentGroup.add(arrowHelper);
                }
              }
            }

            setStatus('ready');
          } catch (err) {
            console.error('Failed to rebuild BracketStressExplorer scene:', err);
            setStatus('error');
            setStatusMsg(err instanceof Error ? err.message : 'Error rendering 3D model.');
          }
        }

        updateSceneRef.current = rebuildScene;
        await rebuildScene();

        // Fit Camera Handler
        resetCameraRef.current = () => {
          if (!activeCamera || !controls) return;
          activeCamera.position.set(115, 95, 125);
          controls.target.set(0, 33, 0);
          controls.update();
        };

        setCameraPresetRef.current = (preset: CameraPreset) => {
          if (!activeCamera || !controls) return;
          const dist = 160;
          if (preset === 'iso') {
            activeCamera.position.set(115, 95, 125);
          } else if (preset === 'front') {
            // Front view: Looking at wide web face (X-Z plane)
            activeCamera.position.set(0, 33, dist);
          } else if (preset === 'side') {
            // Side view: Looking at narrow web edge along pin axis
            activeCamera.position.set(dist, 33, 0);
          } else if (preset === 'top') {
            // Top view: Looking down onto base plate
            activeCamera.position.set(0, dist + 33, 0.001);
          }
          controls.target.set(0, 33, 0);
          controls.update();
        };

        // Surface Hover Probe Raycaster
        const raycaster = new three.Raycaster();
        const mouse = new three.Vector2();

        const onPointerMove = (e: MouseEvent) => {
          if (!renderer || !activeCamera || !currentGroup) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, activeCamera);
          const intersects = raycaster.intersectObjects(currentGroup.children, true);

          if (intersects.length > 0 && intersects[0].point) {
            const hit = intersects[0];
            const pt = hit.point;

            // In FEA mode, lookup nearest node stress & displacement
            if (viewMode !== 'cad' && hit.faceIndex !== undefined && hit.faceIndex !== null) {
              const dataset = feaDatasetsCache.get(radius);
              const caseData = dataset?.loads[loadCase];
              if (dataset && caseData && hit.faceIndex * 3 < dataset.triangles.length) {
                const n0 = dataset.triangles[hit.faceIndex * 3];
                const stress = caseData.nodalStress[n0];
                const ux = caseData.displacements[n0 * 3];
                const uy = caseData.displacements[n0 * 3 + 1];
                const uz = caseData.displacements[n0 * 3 + 2];
                const dispMag = Math.hypot(ux, uy, uz);

                setProbeInfo({
                  coord: [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10, Math.round(pt.z * 10) / 10],
                  stressMpa: stress,
                  dispMm: dispMag,
                  dispVec: [ux, uy, uz],
                });
                return;
              }
            }

            setProbeInfo({
              coord: [Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10, Math.round(pt.z * 10) / 10],
            });
          } else {
            setProbeInfo(null);
          }
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);

        // Window resize
        const updateSize = () => {
          if (!host || !renderer || !perspCamera || !orthoCamera) return;
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (!w || !h) return;

          const newAspect = w / h;
          perspCamera.aspect = newAspect;
          perspCamera.updateProjectionMatrix();

          const fSize = 135;
          orthoCamera.left = (-fSize * newAspect) / 2;
          orthoCamera.right = (fSize * newAspect) / 2;
          orthoCamera.top = fSize / 2;
          orthoCamera.bottom = -fSize / 2;
          orthoCamera.updateProjectionMatrix();

          renderer.setSize(w, h);
        };

        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(host);

        render();
      } catch (err) {
        console.error('Bracket 3D viewer failed to load:', err);
        setStatus('error');
        setStatusMsg('WebGL 3D engine failed to initialize.');
      }
    }

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !renderer) {
        void init();
      }
      syncVisibility();
    });
    intersection.observe(host);

    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      if (currentGroup) disposeObject(currentGroup);
      if (activeCadModel) activeCadModel.dispose();
      controls?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [radius, viewMode, isOrtho]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await sectionRef.current?.requestFullscreen();
      }
    } catch {
      // Fullscreen not permitted
    }
  }

  const base = getBaseUrl();

  return (
    <section
      ref={sectionRef}
      className={`bracket-explorer eng-viewer ${className}`}
      aria-label="Aerospace Mounting Bracket 3D CAD & FEA Explorer"
    >
      {/* 3D Canvas Viewport */}
      <div className="bracket-explorer-canvas-wrap" style={{ height }}>
        <div ref={canvasHostRef} className="eng-viewer-canvas" />

        {/* Viewport Top Toolbar */}
        <div className="eng-viewer-toolbar bracket-explorer-top-bar">
          <button
            type="button"
            onClick={() => resetCameraRef.current?.()}
            title="Reset Camera View to Default"
          >
            Reset View
          </button>

          <div className="eng-viewer-btn-group">
            <button type="button" onClick={() => setCameraPresetRef.current?.('iso')} title="Isometric View">
              Iso
            </button>
            <button type="button" onClick={() => setCameraPresetRef.current?.('front')} title="Front Web View">
              Front
            </button>
            <button type="button" onClick={() => setCameraPresetRef.current?.('side')} title="Side Edge View">
              Side
            </button>
            <button type="button" onClick={() => setCameraPresetRef.current?.('top')} title="Top View">
              Top
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOrtho(o => !o)}
            title="Toggle Orthographic / Perspective View"
            aria-pressed={isOrtho}
          >
            {isOrtho ? 'Ortho' : 'Persp'}
          </button>

          <button
            type="button"
            onClick={() => setShowWireframe(w => !w)}
            aria-pressed={showWireframe}
            title="Toggle Mesh Polygon Wireframe"
            disabled={viewMode === 'cad'}
          >
            {showWireframe ? 'Solid' : 'Wireframe'}
          </button>

          <button
            type="button"
            onClick={() => setShowVectors(v => !v)}
            aria-pressed={showVectors}
            title="Toggle Applied Load Arrows & Boundary Constraints"
            disabled={viewMode === 'cad'}
          >
            {showVectors ? 'Vectors: On' : 'Vectors: Off'}
          </button>

          <button
            type="button"
            onClick={() => setShowGhost(g => !g)}
            aria-pressed={showGhost}
            title="Toggle Undeformed Ghost Overlay"
            disabled={viewMode === 'cad' || deformationScale === 0}
          >
            {showGhost ? 'Ghost: On' : 'Ghost: Off'}
          </button>

          <button
            type="button"
            onClick={() => setColormap(c => (c === 'turbo' ? 'viridis' : c === 'viridis' ? 'inferno' : 'turbo'))}
            title="Switch Scientific Colormap (Turbo, Viridis, Inferno)"
            disabled={viewMode === 'cad'}
          >
            Colormap: {colormap.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => setIsClippingActive(c => !c)}
            className={isClippingActive ? 'active' : ''}
            title="Toggle Internal Cross-Section Slicer"
          >
            Section Cut
          </button>

          <button type="button" onClick={toggleFullscreen} title="Toggle Fullscreen">
            Fullscreen
          </button>
        </div>

        {/* Section Cut Slicer Drawer */}
        {isClippingActive && (
          <div className="eng-viewer-slicer-card" aria-label="Section Cut Controls">
            <div className="eng-slicer-header">
              <span>Section Axis:</span>
              <div className="eng-slicer-axis-btns">
                {(['x', 'y', 'z'] as const).map(ax => (
                  <button
                    key={ax}
                    type="button"
                    className={clipAxis === ax ? 'active' : ''}
                    onClick={() => setClipAxis(ax)}
                  >
                    {ax.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`eng-slicer-invert-btn ${clipInverted ? 'active' : ''}`}
                onClick={() => setClipInverted(i => !i)}
                title="Invert Section Direction"
              >
                Invert
              </button>
            </div>
            <input
              type="range"
              min={-55}
              max={55}
              step={1}
              value={clipOffset}
              onChange={e => setClipOffset(Number(e.target.value))}
              className="eng-slicer-slider"
            />
          </div>
        )}

        {/* Interactive Surface Raycast Probe Badge */}
        {probeInfo && (
          <div className="eng-viewer-coord-badge bracket-probe-badge" aria-label="Surface Inspection Probe">
            <div className="bracket-probe-row">
              <span className="probe-label">Coord:</span>
              <span className="probe-val">({probeInfo.coord[0]}, {probeInfo.coord[1]}, {probeInfo.coord[2]}) mm</span>
            </div>
            {probeInfo.stressMpa !== undefined && (
              <div className="bracket-probe-row">
                <span className="probe-label">Stress:</span>
                <span className="probe-val highlight-stress">{probeInfo.stressMpa.toFixed(1)} MPa</span>
              </div>
            )}
            {probeInfo.dispMm !== undefined && (
              <div className="bracket-probe-row">
                <span className="probe-label">Disp |u|:</span>
                <span className="probe-val highlight-disp">{(probeInfo.dispMm * 1e3).toFixed(1)} µm</span>
              </div>
            )}
          </div>
        )}

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
                    : colormap === 'inferno'
                    ? 'linear-gradient(to right, #000004, #3b0f70, #8c2981, #de4968, #fe9f6d, #fcfdbf)'
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
            {statusMsg}
          </div>
        )}
        {status === 'error' && (
          <div className="eng-viewer-status" role="alert">
            <p>{statusMsg}</p>
          </div>
        )}
      </div>

      {/* Control Console */}
      <div className="bracket-explorer-panel">
        <div className="bracket-explorer-controls-stack">
          {/* Controls Row 1: Load Case and Fillet Blend */}
          <div className="bracket-explorer-controls-row">
            <div className="bracket-explorer-group">
              <span className="bracket-explorer-label" id={`${compId}-lc-label`}>
                FEA Load Case:
              </span>
              <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-lc-label`}>
                {(['lc1', 'lc2', 'lc3'] as LoadCaseId[]).map(lcId => (
                  <button
                    key={lcId}
                    type="button"
                    className={`bracket-explorer-btn ${loadCase === lcId ? 'active' : ''}`}
                    onClick={() => setLoadCase(lcId)}
                    aria-pressed={loadCase === lcId}
                    disabled={viewMode === 'cad'}
                  >
                    {lcId === 'lc1'
                      ? 'LC1 (Down)'
                      : lcId === 'lc2'
                      ? 'LC2 (Side)'
                      : 'LC3 (3 kN)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bracket-explorer-group">
              <span className="bracket-explorer-label" id={`${compId}-radius-label`}>
                Fillet Radius Blend:
              </span>
              <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-radius-label`}>
                {(['r2', 'r5', 'r10'] as FilletRadiusId[]).map(rId => (
                  <button
                    key={rId}
                    type="button"
                    className={`bracket-explorer-btn ${radius === rId ? 'active' : ''}`}
                    onClick={() => setRadius(rId)}
                    aria-pressed={radius === rId}
                  >
                    {rId.toUpperCase()} {rId === 'r5' ? '(Base)' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Row 2: Display Mode and Deformation Slider */}
          <div className="bracket-explorer-controls-row">
            <div className="bracket-explorer-group">
              <span className="bracket-explorer-label" id={`${compId}-mode-label`}>
                Display Mode:
              </span>
              <div className="bracket-explorer-toggle-group" role="group" aria-labelledby={`${compId}-mode-label`}>
                {(
                  [
                    { id: 'stress', label: 'Stress FEA' },
                    { id: 'displacement', label: 'Displacement' },
                    { id: 'cad', label: 'STEP CAD Solid' },
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

            <div className="bracket-explorer-group bracket-explorer-slider-group">
              <div className="bracket-explorer-slider-header">
                <label htmlFor={`${compId}-deform-slider`} className="bracket-explorer-label">
                  Deformation Scale:
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
                disabled={viewMode === 'cad'}
              />
            </div>
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
            <span className="bracket-downloads-title">Exact Parametric CAD Models (STEP AP214):</span>
            <div className="bracket-downloads-links">
              <a
                href={`${base}/notebooks/aerospace-bracket/geometry/bracket_r2.step`}
                download="bracket_r2.step"
                className={`bracket-download-pill ${radius === 'r2' ? 'active' : ''}`}
              >
                Download R2 Blend (150.5 g) ↓
              </a>
              <a
                href={`${base}/notebooks/aerospace-bracket/geometry/bracket_r5.step`}
                download="bracket_r5.step"
                className={`bracket-download-pill ${radius === 'r5' ? 'active' : ''}`}
              >
                Download R5 Baseline (151.5 g) ↓
              </a>
              <a
                href={`${base}/notebooks/aerospace-bracket/geometry/bracket_r10.step`}
                download="bracket_r10.step"
                className={`bracket-download-pill ${radius === 'r10' ? 'active' : ''}`}
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
