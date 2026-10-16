import { useEffect, useRef, useState, type CSSProperties } from 'react';

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
 * It is also the only thumbnail that has to *load* something: three.js plus the
 * game modules are not small, and the index page has no other reason to pay for
 * them. Hence the bar.
 */
export default function MonaThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let runner: Runner | null = null;
    let visibleObserver: IntersectionObserver | null = null;
    let gate: IntersectionObserver | null = null;
    let cancelled = false;
    let timer = 0;

    /**
     * The bar's values are invented, and that is the honest option here: a
     * dynamic `import()` reports nothing until it is done. So the bar eases
     * toward 92% and the real signal — the module having arrived — closes the
     * last 8%. It moves fastest at the start, which is also when the browser
     * is doing the most.
     */
    const startBar = () => {
      const t0 = performance.now();
      timer = window.setInterval(() => {
        const seconds = (performance.now() - t0) / 1000;
        setProgress((prev) => Math.max(prev, Math.min(92, (1 - Math.exp(-seconds / 1.1)) * 92)));
      }, 80);
    };

    const boot = async () => {
      startBar();
      // `DemoRunner` 是 JS 模块，类型断言只为让 TS 闭嘴
      const mod = (await import('../experiments/super-mona/game/DemoRunner.js')) as unknown as {
        DemoRunner: new (canvas: HTMLCanvasElement) => Runner;
      };
      if (cancelled) return;
      try {
        runner = new mod.DemoRunner(canvas);
      } catch {
        // WebGL 不可用就让它空着，不值得为此塞一份 2D 替代实现进来
        window.clearInterval(timer);
        setReady(true);
        return;
      }
      window.clearInterval(timer);
      setProgress(100);
      // 让进度条先跑到头再淡出，不然它会「到了 100% 却立刻消失」
      window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 260);

      visibleObserver = new IntersectionObserver(
        ([entry]) => runner?.setActive(entry.isIntersecting),
        { threshold: 0.01 },
      );
      visibleObserver.observe(canvas);
    };

    if (typeof IntersectionObserver === 'undefined') {
      void boot();
    } else {
      // 卡片进视口才开始下载
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
      window.clearInterval(timer);
      gate?.disconnect();
      visibleObserver?.disconnect();
      runner?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={ref} data-mona-demo="" aria-hidden="true" className="mona-thumb__canvas" />
      {/* 加载条：一道横跨封面的彩色幕布，角色骑在它前沿上往前走。
          颜色用的是角色那套拖尾色 —— 和游戏里同源。 */}
      <div className="mona-thumb__loader" data-ready={ready} aria-hidden="true">
        <div className="mona-thumb__track">
          {/* 用 `--p` + `clip-path` 裁，而不是改宽度：改宽度会把渐变一起压扁，
              那样颜色会「流动」，不像一条已经铺好的拖尾 */}
          <span
            className="mona-thumb__fill"
            style={{ '--p': `${progress}%` } as CSSProperties}
          />
        </div>
        <span className="mona-thumb__runner" style={{ left: `${progress}%` }} />
      </div>
    </>
  );
}
