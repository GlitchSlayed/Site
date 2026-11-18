import { useEffect, useRef, useState } from 'react';
import type { Camera } from 'three';
import { loadCadOrMeshAsset, disposeObject, type LoadedCadModel, detectFormat } from '../../../lib/engineering/cadLoader';

export interface CadModelItem {
  id: string;
  label: string;
  src: string;
  format?: string;
  description?: string;
}

export type DisplayMode = 'cad' | 'shaded' | 'wireframe' | 'xray';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';

export interface EngineeringModelViewerProps {
  src?: string;
  models?: CadModelItem[];
  initialModelId?: string;
  format?: string;
  showAxes?: boolean;
  showGrid?: boolean;
  showEdges?: boolean;
  showWireframe?: boolean;
  showDimensions?: boolean;
  allowFileDrop?: boolean;
  allowSectionCut?: boolean;
  className?: string;
  height?: number;
  fitToView?: boolean;
  title?: string;
}

export { disposeObject };

export function EngineeringModelViewer({
  src,
  models,
  initialModelId,
  format: explicitFormat,
  showAxes = true,
  showGrid = true,
  showEdges = true,
  showWireframe = false,
  showDimensions = true,
  allowFileDrop = true,
  allowSectionCut = true,
  className = '',
  height = 480,
  fitToView = true,
  title,
}: EngineeringModelViewerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const [activeModelId, setActiveModelId] = useState<string>(
    initialModelId || (models && models.length > 0 ? models[0].id : '')
  );

  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    showWireframe ? 'wireframe' : showEdges ? 'cad' : 'shaded'
  );
  const [isOrtho, setIsOrtho] = useState(false);
  const [isClippingActive, setIsClippingActive] = useState(false);
  const [clipAxis, setClipAxis] = useState<'x' | 'y' | 'z'>('x');
  const [clipOffset, setClipOffset] = useState<number>(0);
  const [clipInverted, setClipInverted] = useState(false);

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; z: number } | null>(null);
  const [modelTelemetry, setModelTelemetry] = useState<{
    size: [number, number, number];
    triangleCount: number;
    vertexCount: number;
    format: string;
    partCount: number;
  } | null>(null);

  const [droppedFileName, setDroppedFileName] = useState<string | null>(null);
  const droppedBufferRef = useRef<{ buffer: ArrayBuffer; name: string } | null>(null);

  const fitCameraRef = useRef<(() => void) | null>(null);
  const setCameraPresetRef = useRef<((preset: CameraPreset) => void) | null>(null);
  const updateClippingRef = useRef<((active: boolean, axis: 'x' | 'y' | 'z', offset: number, inverted: boolean) => void) | null>(null);
  const updateDisplayModeRef = useRef<((mode: DisplayMode) => void) | null>(null);

  // Active source
  const currentModelItem = models?.find(m => m.id === activeModelId);
  const currentSrc = droppedFileName
    ? null
    : (currentModelItem ? currentModelItem.src : src);
  const currentFormat = droppedFileName
    ? detectFormat(droppedFileName)
    : (currentModelItem?.format || explicitFormat);

  useEffect(() => {
    updateDisplayModeRef.current?.(displayMode);
  }, [displayMode]);

  useEffect(() => {
    updateClippingRef.current?.(isClippingActive, clipAxis, clipOffset, clipInverted);
  }, [isClippingActive, clipAxis, clipOffset, clipInverted]);

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
    let currentLoadedModel: LoadedCadModel | undefined;
    let clipPlane: import('three').Plane | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;

    setState('loading');
    setError('');

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

    function fail(reason: unknown) {
      if (disposed) return;
      stop();
      setError(reason instanceof Error ? reason.message : 'Unable to load 3D CAD model.');
      setState('error');
    }

    async function init() {
      try {
        const [three, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);

        if (disposed || !host) return;

        scene = new three.Scene();

        // Dual Camera Setup (Perspective + Orthographic)
        const aspect = host.clientWidth / (host.clientHeight || 1);
        perspCamera = new three.PerspectiveCamera(40, aspect, 0.1, 5000);
        perspCamera.position.set(100, 80, 100);

        const frustumSize = 120;
        orthoCamera = new three.OrthographicCamera(
          (-frustumSize * aspect) / 2,
          (frustumSize * aspect) / 2,
          frustumSize / 2,
          -frustumSize / 2,
          0.1,
          5000
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
        controls.target.set(0, 0, 0);

        // Lighting Rig
        const ambient = new three.AmbientLight(0xffffff, 0.75);
        scene.add(ambient);

        const keyLight = new three.DirectionalLight(0xffffff, 1.1);
        keyLight.position.set(150, 220, 150);
        scene.add(keyLight);

        const fillLight = new three.DirectionalLight(0xdde6f0, 0.6);
        fillLight.position.set(-150, -60, -100);
        scene.add(fillLight);

        const rimLight = new three.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(0, 180, -150);
        scene.add(rimLight);

        // Grid & Coordinate Guides
        let gridHelper: import('three').GridHelper | undefined;
        let axesHelper: import('three').AxesHelper | undefined;

        if (showGrid) {
          gridHelper = new three.GridHelper(160, 16, 0x5a6878, 0x2e3844);
          scene.add(gridHelper);
        }
        if (showAxes) {
          axesHelper = new three.AxesHelper(25);
          scene.add(axesHelper);
        }

        const updateTheme = () => {
          if (!scene) return;
          const isDark = document.documentElement.dataset.theme !== 'light';
          scene.background = new three.Color(isDark ? 0x14181e : 0xf4f6f8);
          if (gridHelper) {
            gridHelper.material = new three.LineBasicMaterial({
              color: isDark ? 0x3d4754 : 0xc7d0d9,
              transparent: true,
              opacity: 0.65,
            });
          }
        };
        updateTheme();
        themeObserver = new MutationObserver(updateTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Clipping Plane setup
        clipPlane = new three.Plane(new three.Vector3(1, 0, 0), 0);

        updateClippingRef.current = (active, axis, offset, inverted) => {
          if (!renderer || !clipPlane) return;
          if (!active) {
            renderer.clippingPlanes = [];
            return;
          }
          const normal = new three.Vector3(
            axis === 'x' ? 1 : 0,
            axis === 'y' ? 1 : 0,
            axis === 'z' ? 1 : 0
          );
          if (inverted) normal.negate();
          clipPlane.normal.copy(normal);
          clipPlane.constant = inverted ? offset : -offset;
          renderer.clippingPlanes = [clipPlane];
        };

        // Load 3D Model Asset
        const modelSource = droppedBufferRef.current
          ? droppedBufferRef.current.buffer
          : currentSrc;

        if (!modelSource) {
          throw new Error('No 3D model source provided.');
        }

        const loaded = await loadCadOrMeshAsset(modelSource, {
          format: currentFormat,
          fileName: droppedFileName || (currentModelItem ? currentModelItem.label : 'Model'),
        });

        if (disposed) {
          loaded.dispose();
          return;
        }

        currentLoadedModel = loaded;
        scene.add(loaded.root);

        // Adjust Grid to sit just below model bottom
        if (gridHelper) {
          gridHelper.position.y = loaded.bounds.min.y;
        }
        if (axesHelper) {
          axesHelper.position.set(loaded.bounds.min.x - 5, loaded.bounds.min.y, loaded.bounds.min.z - 5);
        }

        // Set telemetry
        const totalTris = loaded.parts.reduce((sum, p) => sum + p.triangleCount, 0);
        const totalVerts = loaded.parts.reduce((sum, p) => sum + p.vertexCount, 0);
        setModelTelemetry({
          size: [
            Math.round(loaded.bounds.size.x * 10) / 10,
            Math.round(loaded.bounds.size.y * 10) / 10,
            Math.round(loaded.bounds.size.z * 10) / 10,
          ],
          triangleCount: totalTris,
          vertexCount: totalVerts,
          format: loaded.format.toUpperCase(),
          partCount: loaded.parts.length,
        });

        // Fit Camera Function
        const fitView = () => {
          if (!activeCamera || !controls || !currentLoadedModel) return;
          const { center, radius } = currentLoadedModel.bounds;
          const dist = radius * 2.5;

          activeCamera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.7);
          controls.target.copy(center);

          if (isOrtho && orthoCamera) {
            const h = host?.clientHeight || 1;
            const w = host?.clientWidth || 1;
            const orthoAspect = w / h;
            const fSize = radius * 2.4;
            orthoCamera.left = (-fSize * orthoAspect) / 2;
            orthoCamera.right = (fSize * orthoAspect) / 2;
            orthoCamera.top = fSize / 2;
            orthoCamera.bottom = -fSize / 2;
            orthoCamera.updateProjectionMatrix();
          } else if (perspCamera) {
            perspCamera.near = Math.max(radius / 200, 0.1);
            perspCamera.far = radius * 50;
            perspCamera.updateProjectionMatrix();
          }
          controls.update();
        };

        fitCameraRef.current = fitView;

        setCameraPresetRef.current = (preset: CameraPreset) => {
          if (!activeCamera || !controls || !currentLoadedModel) return;
          const { center, radius } = currentLoadedModel.bounds;
          const dist = radius * 2.6;

          if (preset === 'iso') {
            activeCamera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.7);
          } else if (preset === 'front') {
            activeCamera.position.set(center.x, center.y, center.z + dist);
          } else if (preset === 'side') {
            activeCamera.position.set(center.x + dist, center.y, center.z);
          } else if (preset === 'top') {
            activeCamera.position.set(center.x, center.y + dist, center.z + 0.001);
          }
          controls.target.copy(center);
          controls.update();
        };

        if (fitToView) {
          fitView();
        }

        // Material display modes update
        updateDisplayModeRef.current = (mode: DisplayMode) => {
          if (!currentLoadedModel) return;
          currentLoadedModel.parts.forEach(part => {
            const mat = part.mesh.material as any;
            if (!mat) return;

            if (mode === 'cad') {
              mat.wireframe = false;
              mat.metalness = 0.75;
              mat.roughness = 0.32;
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.depthWrite = true;
              if (part.edges) part.edges.visible = true;
            } else if (mode === 'shaded') {
              mat.wireframe = false;
              mat.metalness = 0.4;
              mat.roughness = 0.5;
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.depthWrite = true;
              if (part.edges) part.edges.visible = false;
            } else if (mode === 'wireframe') {
              mat.wireframe = true;
              if (part.edges) part.edges.visible = false;
            } else if (mode === 'xray') {
              mat.wireframe = false;
              mat.transparent = true;
              mat.opacity = 0.38;
              mat.depthWrite = false;
              if (part.edges) part.edges.visible = true;
            }
          });
        };
        updateDisplayModeRef.current(displayMode);

        // Raycast Hover Probe
        const raycaster = new three.Raycaster();
        const mouse = new three.Vector2();

        const onPointerMove = (e: MouseEvent) => {
          if (!renderer || !activeCamera || !currentLoadedModel) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, activeCamera);
          const meshes = currentLoadedModel.parts.map(p => p.mesh);
          const intersects = raycaster.intersectObjects(meshes, false);

          if (intersects.length > 0) {
            const pt = intersects[0].point;
            setHoverCoord({
              x: Math.round(pt.x * 100) / 100,
              y: Math.round(pt.y * 100) / 100,
              z: Math.round(pt.z * 100) / 100,
            });
          } else {
            setHoverCoord(null);
          }
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);

        // Resize handler
        const updateSize = () => {
          if (!host || !renderer || !perspCamera || !orthoCamera) return;
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (!w || !h) return;

          const newAspect = w / h;
          perspCamera.aspect = newAspect;
          perspCamera.updateProjectionMatrix();

          if (currentLoadedModel) {
            const fSize = currentLoadedModel.bounds.radius * 2.4;
            orthoCamera.left = (-fSize * newAspect) / 2;
            orthoCamera.right = (fSize * newAspect) / 2;
            orthoCamera.top = fSize / 2;
            orthoCamera.bottom = -fSize / 2;
            orthoCamera.updateProjectionMatrix();
          }

          renderer.setSize(w, h);
        };

        resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(host);

        setState('ready');
        syncVisibility();
      } catch (err) {
        console.error('EngineeringModelViewer init failed:', err);
        fail(err);
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
      if (currentLoadedModel) currentLoadedModel.dispose();
      controls?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [currentSrc, currentFormat, droppedFileName, activeModelId, isOrtho, attempt]);

  // Drag and drop local file handling
  const handleDragOver = (e: React.DragEvent) => {
    if (!allowFileDrop) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!allowFileDrop) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const buf = await file.arrayBuffer();
      droppedBufferRef.current = { buffer: buf, name: file.name };
      setDroppedFileName(file.name);
    }
  };

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

  return (
    <section
      ref={sectionRef}
      className={`eng-viewer cad-model-viewer ${className}`}
      aria-label={title || 'Interactive 3D CAD Model Viewer'}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Viewer Viewport Canvas */}
      <div className="eng-viewer-canvas-wrap" style={{ height }}>
        <div ref={canvasHostRef} className="eng-viewer-canvas" />

        {/* Primary Viewport Action Bar */}
        <div className="eng-viewer-toolbar">
          <button
            type="button"
            onClick={() => fitCameraRef.current?.()}
            disabled={state !== 'ready'}
            title="Fit view to viewport"
          >
            Fit view
          </button>
          <button type="button" onClick={toggleFullscreen} title="Toggle Fullscreen">
            Fullscreen
          </button>
        </div>

        {/* CAD & Engineering Tools Bar */}
        <div className="eng-viewer-cad-toolbar">
          <div className="eng-viewer-btn-group">
            <button
              type="button"
              onClick={() => setCameraPresetRef.current?.('iso')}
              title="Isometric View"
              disabled={state !== 'ready'}
            >
              Iso
            </button>
            <button
              type="button"
              onClick={() => setCameraPresetRef.current?.('front')}
              title="Front View"
              disabled={state !== 'ready'}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setCameraPresetRef.current?.('side')}
              title="Side View"
              disabled={state !== 'ready'}
            >
              Side
            </button>
            <button
              type="button"
              onClick={() => setCameraPresetRef.current?.('top')}
              title="Top View"
              disabled={state !== 'ready'}
            >
              Top
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOrtho(o => !o)}
            title="Toggle Orthographic / Perspective Projection"
            aria-pressed={isOrtho}
            disabled={state !== 'ready'}
          >
            {isOrtho ? 'Ortho' : 'Persp'}
          </button>

          <div className="eng-viewer-btn-group">
            <button
              type="button"
              className={displayMode === 'cad' ? 'active' : ''}
              onClick={() => setDisplayMode('cad')}
              title="CAD Shaded with Feature Edges"
              disabled={state !== 'ready'}
            >
              CAD
            </button>
            <button
              type="button"
              className={displayMode === 'shaded' ? 'active' : ''}
              onClick={() => setDisplayMode('shaded')}
              title="Smooth Shaded Surface"
              disabled={state !== 'ready'}
            >
              Shaded
            </button>
            <button
              type="button"
              className={displayMode === 'wireframe' ? 'active' : ''}
              onClick={() => setDisplayMode('wireframe')}
              title="Polygon Wireframe"
              disabled={state !== 'ready'}
            >
              Wireframe
            </button>
            <button
              type="button"
              className={displayMode === 'xray' ? 'active' : ''}
              onClick={() => setDisplayMode('xray')}
              title="X-Ray Internal Transparency"
              disabled={state !== 'ready'}
            >
              X-Ray
            </button>
          </div>

          {allowSectionCut && (
            <button
              type="button"
              onClick={() => setIsClippingActive(c => !c)}
              className={isClippingActive ? 'active' : ''}
              title="Cross-Section Slicer"
              disabled={state !== 'ready'}
            >
              Section Cut
            </button>
          )}
        </div>

        {/* Section Cut Slicer Drawer */}
        {allowSectionCut && isClippingActive && (
          <div className="eng-viewer-slicer-card" aria-label="Section Cut Controls">
            <div className="eng-slicer-header">
              <span>Section Plane Axis:</span>
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
                title="Invert Section Cut Direction"
              >
                Invert
              </button>
            </div>
            <input
              type="range"
              min={-60}
              max={60}
              step={1}
              value={clipOffset}
              onChange={e => setClipOffset(Number(e.target.value))}
              className="eng-slicer-slider"
            />
          </div>
        )}

        {/* Surface Hover Coordinate Probe */}
        {hoverCoord && (
          <div className="eng-viewer-coord-badge" aria-label="3D Surface Coordinates">
            <span>X: {hoverCoord.x} mm</span>
            <span>Y: {hoverCoord.y} mm</span>
            <span>Z: {hoverCoord.z} mm</span>
          </div>
        )}

        {/* Drag and Drop File Overlay Indicator */}
        {allowFileDrop && !droppedFileName && (
          <div className="eng-viewer-drop-hint">
            Drop any CAD file (STEP, STL, OBJ, PLY, 3MF, GLB, INP) here to inspect
          </div>
        )}

        {droppedFileName && (
          <div className="eng-viewer-dropped-badge">
            <span>Inspecting local file: <strong>{droppedFileName}</strong></span>
            <button
              type="button"
              onClick={() => {
                droppedBufferRef.current = null;
                setDroppedFileName(null);
              }}
              title="Reset to default model"
            >
              Reset
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="eng-viewer-status" role="status">
            Loading CAD 3D geometry engine…
          </div>
        )}
        {state === 'error' && (
          <div className="eng-viewer-status" role="alert">
            <p>Unable to load 3D CAD model. {error}</p>
            <button type="button" onClick={() => setAttempt(a => a + 1)}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Model Selector Bar (if multi-model playlist provided) */}
      {models && models.length > 1 && !droppedFileName && (
        <div className="eng-viewer-model-selector" role="tablist" aria-label="CAD Model Variants">
          {models.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={activeModelId === m.id}
              className={`eng-viewer-model-btn ${activeModelId === m.id ? 'active' : ''}`}
              onClick={() => setActiveModelId(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Dimensions & Engineering Metadata Bar */}
      {showDimensions && modelTelemetry && (
        <div className="eng-viewer-telemetry-bar">
          <div className="eng-telemetry-item">
            <span className="eng-telemetry-label">Bounding Dimensions (X × Y × Z)</span>
            <span className="eng-telemetry-val">
              {modelTelemetry.size[0]} × {modelTelemetry.size[1]} × {modelTelemetry.size[2]} mm
            </span>
          </div>
          <div className="eng-telemetry-item">
            <span className="eng-telemetry-label">Mesh Surface</span>
            <span className="eng-telemetry-val">
              {modelTelemetry.triangleCount.toLocaleString()} triangles ({modelTelemetry.vertexCount.toLocaleString()} vertices)
            </span>
          </div>
          <div className="eng-telemetry-item">
            <span className="eng-telemetry-label">Native Format</span>
            <span className="eng-telemetry-badge">{modelTelemetry.format}</span>
          </div>
        </div>
      )}
    </section>
  );
}

// Re-export alias for convenience in MDX files
export const CadModelViewer = EngineeringModelViewer;
