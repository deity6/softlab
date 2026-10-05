import { useEffect, useRef, useState } from 'react';
import { createCat, type CatHandle } from './cat';
import { findExperiment } from '../registry';

/** Eight coats, all dark enough to hold a silhouette against the pale stage. */
const COATS = [
  { name: '墨黑', hex: '#33333d' },
  { name: '橘虎斑', hex: '#df8b48' },
  { name: '奶咖', hex: '#c39a7b' },
  { name: '蓝猫', hex: '#7b8ca6' },
  { name: '布偶', hex: '#9b8b84' },
  { name: '樱花', hex: '#eb9db1' },
  { name: '薄荷', hex: '#79bfa4' },
  { name: '奶油', hex: '#e3bd85' },
];

export default function CatLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CatHandle | null>(null);
  const soundPrimed = useRef(false);
  const [coat, setCoat] = useState(COATS[0].hex);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: CatHandle | null = null;
    try {
      engine = createCat(host, { color: coat });
      engineRef.current = engine;
    } catch (err) {
      console.error('[softlab] could not start soft cat', err);
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setColor(coat);
  }, [coat]);

  useEffect(() => {
    // Skip the mount run: it would create the AudioContext before the visitor
    // has interacted at all, which browsers open as a permanently suspended
    // context. The engine turns sound on by itself on the first gesture.
    if (!soundPrimed.current) {
      soundPrimed.current = true;
      return;
    }
    engineRef.current?.setMuted(!sound);
  }, [sound]);

  return (
    <div className="exp-page">
      <div className="exp-bar">
        <span className="mono-sm">NO. {findExperiment('soft-cat')?.no ?? '03'}</span>
        <span className="exp-bar__title">Soft Cat</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          摸下去会陷，松手会弹
        </span>
        <span className="exp-bar__spacer" />
        <a className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide" href="#/" data-mo="arrow-slide">
          <span className="mo-label">返回列表</span>
        </a>
      </div>

      <div className="lab">
        <div className="lab__stage cat-stage" ref={hostRef} aria-label="可以抚摸的长条猫" />

        <div className="lab__hud">
          <div className="lab__title">
            <h1>
              Soft
              <br />
              <i>Cat.</i>
            </h1>
            <p>
              摸背 · 捏耳朵 · 拨尾巴 · 碰爪爪
              <br />
              PET · PRESS · RELEASE
            </p>
          </div>

          <div className="lab__dock">
            <span className="lab__hint">把光标放到它身上 · 按住会更用力</span>
            <div className="lab__controls cat-coats">
              {COATS.map((c) => (
                <button
                  key={c.hex}
                  className="swatch swatch--sm"
                  aria-label={c.name}
                  title={c.name}
                  data-on={c.hex === coat}
                  style={{ ['--c' as string]: c.hex }}
                  onClick={() => setCoat(c.hex)}
                />
              ))}
              <span className="cat-coats__sep" aria-hidden />
              <button
                className="mo-btn mo-btn--sm mo-press-scale"
                data-on={sound}
                title="摸它的时候会有呼噜声"
                onClick={() => setSound((s) => !s)}
              >
                {sound ? '呼噜 开' : '呼噜 关'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
