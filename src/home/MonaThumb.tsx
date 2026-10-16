import { useEffect, useRef } from 'react';

type Runner = { setActive(active: boolean): void; dispose(): void };

/**
 * The Mona card's cover.
 *
 * Unlike the other four thumbnails this one is not drawn — it runs the actual
 * game (same shaders, same palette, same InstancedMesh you get when you open
 * the experiment) with a script at the controls. A hand-drawn stand-in was
 * tried first and it kept drifting out of sync: every change to the palette or
 * the block rendering had to be mirrored by hand, and nobody remembers to.
 *
 * Two reasons it is loaded lazily and only once the card is near the viewport:
 * three.js plus the game modules are not small, and the index page has no other
 * reason to pay for them.
 */
export default function MonaThumb() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let runner: Runner | null = null;
    let visibleObserver: IntersectionObserver | null = null;
    let gate: IntersectionObserver | null = null;
    let cancelled = false;

    const boot = async () => {
      // `DemoRunner` 是 JS 模块，类型断言只为让 TS 闭嘴
      const mod = (await import('../experiments/super-mona/game/DemoRunner.js')) as unknown as {
        DemoRunner: new (canvas: HTMLCanvasElement) => Runner;
      };
      if (cancelled) return;
      try {
        runner = new mod.DemoRunner(canvas);
      } catch {
        // WebGL 不可用就让它空着，不值得为此塞一份 2D 替代实现进来
        return;
      }
      visibleObserver = new IntersectionObserver(
        ([entry]) => runner?.setActive(entry.isIntersecting),
        { threshold: 0.01 },
      );
      visibleObserver.observe(canvas);
    };

    if (typeof IntersectionObserver === 'undefined') {
      void boot();
    } else {
      gate = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          gate?.disconnect();
          gate = null;
          void boot();
        },
        { rootMargin: '240px' },
      );
      gate.observe(canvas);
    }

    return () => {
      cancelled = true;
      gate?.disconnect();
      visibleObserver?.disconnect();
      runner?.dispose();
    };
  }, []);

  return <canvas ref={ref} data-mona-demo="" aria-hidden="true" />;
}
