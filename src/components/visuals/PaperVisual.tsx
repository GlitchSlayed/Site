import { useEffect, useState } from 'react';

type Library = typeof import('@paper-design/shaders-react');
type Props = {
  variant: 'dither' | 'grain' | 'mesh';
  accent: string;
  animate?: boolean;
};

/** Loaded through client:visible. No shader module is imported during SSR. */
export default function PaperVisual({ variant, accent, animate = false }: Props) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setMotionAllowed(!reduced.matches);
    syncMotion();
    reduced.addEventListener('change', syncMotion);

    // Leave the Astro/CSS fallback intact if WebGL2 is unavailable.
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      import('@paper-design/shaders-react')
        .then(module => { if (!cancelled) setLibrary(module); })
        .catch(() => { /* retain the CSS fallback */ });
    }
    return () => {
      cancelled = true;
      reduced.removeEventListener('change', syncMotion);
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    let intersects = false;
    const sync = () => setActive(intersects && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting;
      sync();
    });
    observer.observe(host);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [host]);

  const speed = animate && motionAllowed && active ? 0.12 : 0;
  const common = {
    width: '100%', height: '100%', speed, frame: 1400,
    minPixelRatio: 1, maxPixelCount: 400_000,
    style: { width: '100%', height: '100%', display: 'block' },
  };

  return (
    <div ref={setHost} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {library && variant === 'dither' && (
        <library.Dithering {...common} colorBack="#090b10" colorFront={accent}
          shape="sphere" type="4x4" size={2} scale={0.7} offsetX={0.25} />
      )}
      {library && variant === 'grain' && (
        <library.GrainGradient {...common} colors={['#0a0b10', accent, '#16243b']}
          colorBack="#090b10" softness={0.75} intensity={0.3} noise={0.22}
          shape="corners" />
      )}
      {library && variant === 'mesh' && (
        <library.MeshGradient {...common} colors={['#090b10', '#122039', accent, '#16111c']}
          distortion={0.65} swirl={0.18} grainMixer={0.06} grainOverlay={0.08} />
      )}
    </div>
  );
}
