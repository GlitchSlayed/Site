// Reusable 3D engineering model viewer built on Three.js, loaded lazily only
// when visible. GPU resources are disposed on unmount.
import { useCallback, useEffect, useRef, useState } from 'react';

interface EngineeringModelViewerProps {
  src: string;
  showAxes?: boolean;
  showGrid?: boolean;
  showWireframe?: boolean;
  className?: string;
  height?: number;
  fitToView?: boolean;
}

export function EngineeringModelViewer({
  src,
  showAxes = true,
  showGrid = true,
  showWireframe = false,
  className,
  height = 450,
  fitToView = true,
}: EngineeringModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const threeRef = useRef<typeof import('three') | null>(null);
  const orbitRef = useRef<any>(null);
  const gltfRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const mountedRef = useRef(false);

  const isDark =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';

  const loadThree = useCallback(async () => {
    if (threeRef.current) {
      setLoaded(true);
      return;
    }
    try {
      const [threeModule, orbitModule, gltfModule] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      threeRef.current = threeModule as typeof import('three');
      orbitRef.current = orbitModule.OrbitControls;
      gltfRef.current = gltfModule.GLTFLoader;
      setLoaded(true);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error('Failed to load Three.js'));
    }
  }, []);

  const initThree = useCallback(() => {
    const three = threeRef.current;
    const OrbitControls = orbitRef.current;
    const container = containerRef.current;
    if (!three || !OrbitControls || !container) return;

    const scene = new three.Scene();
    scene.background = new three.Color(isDark ? 0x0a0a0a : 0xfafafa);

    const camera = new three.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(5, 3, 7);

    const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new three.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new three.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    if (showGrid) {
      const grid = new three.GridHelper(20, 40, 0x444444, 0x222222);
      scene.add(grid);
    }

    if (showAxes) {
      const axes = new three.AxesHelper(3);
      scene.add(axes);
    }

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    if (fitToView && modelRef.current) {
      fitModelToView(camera, controls, modelRef.current);
    }

    animate();
  }, [showAxes, showGrid, fitToView, isDark]);

  const fitModelToView = useCallback(
    (camera: any, controls: any, model: any) => {
      const three = threeRef.current;
      if (!three) return;
      const box = new three.Box3().setFromObject(model);
      const center = box.getCenter(new three.Vector3());
      const size = box.getSize(new three.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

      camera.position.set(center.x, center.y, center.z + cameraZ);
      camera.lookAt(center);
      controls.target.copy(center);
      controls.update();
    },
    [],
  );

  const loadModel = useCallback(() => {
    const three = threeRef.current;
    const GLTFLoader = gltfRef.current;
    if (!three || !GLTFLoader) return;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf: any) => {
        if (modelRef.current) sceneRef.current?.remove(modelRef.current);
        modelRef.current = gltf.scene;
        modelRef.current.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (showWireframe && child.material) {
              child.material.wireframe = true;
            }
          }
        });
        sceneRef.current?.add(modelRef.current);
        if (fitToView && cameraRef.current && controlsRef.current) {
          fitModelToView(cameraRef.current, controlsRef.current, modelRef.current);
        }
      },
      undefined,
      (error: unknown) => {
        setLoadError(error instanceof Error ? error : new Error('Failed to load model'));
      },
    );
  }, [src, showWireframe, fitToView]);

  const animate = useCallback(() => {
    if (!mountedRef.current) return;
    requestAnimationFrame(animate);
    if (controlsRef.current) controlsRef.current.update();
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  const handleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleResetCamera = () => {
    if (
      sceneRef.current &&
      cameraRef.current &&
      controlsRef.current &&
      modelRef.current
    ) {
      fitModelToView(cameraRef.current, controlsRef.current, modelRef.current);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadThree();
    return () => {
      mountedRef.current = false;
      dispose();
    };
  }, [loadThree]);

  useEffect(() => {
    if (!loaded || !containerRef.current || !src) return;
    initThree();
    loadModel();
    return () => {
      dispose();
    };
  }, [loaded, initThree, loadModel, src]);

  const dispose = () => {
    if (controlsRef.current) controlsRef.current.dispose?.();
    controlsRef.current = null;
    if (rendererRef.current) {
      rendererRef.current.renderLists?.dispose?.();
      rendererRef.current.dispose?.();
      rendererRef.current.domElement.remove?.();
    }
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    modelRef.current = null;
  };

  const windowResize = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;
    cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
  }, []);

  useEffect(() => {
    window.addEventListener('resize', windowResize);
    return () => window.removeEventListener('resize', windowResize);
  }, [windowResize]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current) return;
    const currentDark = document.documentElement.dataset.theme === 'dark';
    sceneRef.current.background = new (threeRef.current!.Color)(
      currentDark ? 0x0a0a0a : 0xfafafa,
    );
  });

  if (loadError) {
    return (
      <div className={`eng-viewer eng-viewer-error ${className || ''}`} role="alert" aria-live="polite" style={{ height }}>
        <p>Unable to load the 3D model viewer.</p>
        <button type="button" onClick={loadThree} aria-label="Retry loading 3D viewer">
          Retry
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`eng-viewer eng-viewer-loading ${className || ''}`} style={{ height }} aria-label="3D model viewer loading">
        <p>Loading 3D viewer…</p>
      </div>
    );
  }

  return (
    <section
      ref={containerRef}
      className={`eng-viewer ${className || ''}`}
      aria-label="Engineering 3D model viewer"
      tabIndex={-1}
    >
      <div className="eng-viewer-toolbar">
        <button type="button" onClick={handleResetCamera} aria-label="Fit model to view">
          Fit view
        </button>
        <button type="button" onClick={handleFullscreen} aria-label="Toggle fullscreen">
          Fullscreen
        </button>
      </div>
    </section>
  );
}
