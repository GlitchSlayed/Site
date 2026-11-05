import { useEffect, useRef, useState } from 'react';
import type { Object3D, Material, Texture, BufferGeometry } from 'three';

interface EngineeringModelViewerProps {
  src: string;
  showAxes?: boolean;
  showGrid?: boolean;
  showWireframe?: boolean;
  className?: string;
  height?: number;
  fitToView?: boolean;
}
/** Dispose owned model/helper resources once, including shared materials and textures. */
export function disposeObject(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    const mesh = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); });
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

export function EngineeringModelViewer({ src, showAxes = true, showGrid = true, showWireframe = false, className = '', height = 450, fitToView = true }: EngineeringModelViewerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    let failed = false, disposed = false, visible = false, started = false, frame = 0;
    let renderer: import('three').WebGLRenderer | undefined;
    let scene: import('three').Scene | undefined;
    let camera: import('three').PerspectiveCamera | undefined;
    let controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls | undefined;
    let resize: ResizeObserver | undefined;
    let theme: MutationObserver | undefined;
    setState('loading');
    setError('');

    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function render() {
      frame = 0;
      if (failed || disposed || !visible || document.hidden || !renderer || !scene || !camera || !controls) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }
    function syncVisibility() {
      stop();
      if (!failed && !disposed && visible && !document.hidden && renderer) frame = requestAnimationFrame(render);
    }
    function fail(reason: unknown) {
      if (disposed) return;
      stop();
      failed = true;
      setError(reason instanceof Error ? reason.message : 'Unable to load this model.');
      setState('error');
    }
    async function start() {
      if (started || disposed) return;
      started = true;
      try {
        const [three, { OrbitControls }, { GLTFLoader }] = await Promise.all([
          import('three'), import('three/examples/jsm/controls/OrbitControls.js'), import('three/examples/jsm/loaders/GLTFLoader.js'),
        ]);
        if (disposed) return;
        scene = new three.Scene();
        camera = new three.PerspectiveCamera(45, 1, .01, 10000);
        camera.position.set(5, 3, 7);
        renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        host.append(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        scene.add(new three.AmbientLight(0xffffff, .7));
        const light = new three.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 7);
        scene.add(light);
        if (showGrid) scene.add(new three.GridHelper(20, 40, 0x777777, 0x999999));
        if (showAxes) scene.add(new three.AxesHelper(3));
        const updateSize = () => {
          const width = host.clientWidth, height = host.clientHeight;
          if (!width || !height || !camera || !renderer) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        };
        updateSize();
        resize = new ResizeObserver(updateSize);
        resize.observe(host);
        const updateTheme = () => { if (scene) scene.background = new three.Color(document.documentElement.dataset.theme === 'dark' ? 0x242622 : 0xf1eee4); };
        updateTheme();
        theme = new MutationObserver(updateTheme);
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        syncVisibility();
        new GLTFLoader().load(src, gltf => {
          if (disposed) { disposeObject(gltf.scene); return; }
          gltf.scene.traverse(object => {
            const mesh = object as import('three').Mesh;
            if (!mesh.isMesh) return;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach(material => { if ('wireframe' in material) material.wireframe = showWireframe; });
          });
          scene!.add(gltf.scene);
          fitRef.current = () => {
            if (!camera || !controls) return;
            const bounds = new three.Box3().setFromObject(gltf.scene);
            if (bounds.isEmpty()) return;
            const center = bounds.getCenter(new three.Vector3());
            const radius = Math.max(bounds.getSize(new three.Vector3()).length() / 2, .001);
            const vertical = camera.fov * Math.PI / 180;
            const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
            const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.2;
            camera.near = Math.max(radius / 1000, .00001);
            camera.far = distance + radius * 20;
            camera.position.copy(center).add(new three.Vector3(0, 0, distance));
            camera.updateProjectionMatrix();
            controls.target.copy(center);
            controls.update();
          };
          if (fitToView) fitRef.current();
          setState('ready');
        }, undefined, fail);
      } catch (reason) { fail(reason); }
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void start();
      syncVisibility();
    });
    intersection.observe(host);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      resize?.disconnect();
      theme?.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
      fitRef.current = null;
      controls?.dispose();
      if (scene) disposeObject(scene);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [src, showAxes, showGrid, showWireframe, fitToView, attempt]);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await sectionRef.current?.requestFullscreen();
    } catch { /* Fullscreen can be disallowed by the embedding document. */ }
  }
  return <section ref={sectionRef} className={`eng-viewer ${className}`} style={{ height }} aria-label="Engineering 3D model viewer">
    <div ref={canvasHostRef} className="eng-viewer-canvas" />
    <div className="eng-viewer-toolbar">
      <button type="button" onClick={() => fitRef.current?.()} disabled={state !== 'ready'}>Fit view</button>
      <button type="button" onClick={fullscreen}>Fullscreen</button>
    </div>
    {state === 'loading' && <p className="eng-viewer-status" role="status">Loading 3D viewer…</p>}
    {state === 'error' && <div className="eng-viewer-status" role="alert"><p>Unable to load the 3D model. {error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
  </section>;
}
