import { useEffect, useRef, useState, type RefObject } from 'react';
import { virtualPointer } from '../lib/virtualPointer';

/**
 * HERO 虚拟指针光球 —— 触摸端的「半可控鼠标」。
 *
 * 触摸设备没有鼠标指针，而 HERO 那行巨大的 SOFT LAB. 有一个只有指针才能
 * 触发的脾气：光标靠近时字母会让开。手机用户永远看不到这一幕。
 * 这个球就是补上去的那个"指针"：可以拖、松手后带惯性滑行，
 * 球所到之处字母照样躲开。
 *
 * ⚠️ 它的本质是**动**，不是一枚贴在页面上的图标：
 *    静止的白球只说明"这里有个东西"，滑行起来的球才说明"这里有个指针"。
 *
 * 规格来源：docs/handoff-hero-orb.md（视觉 §4 / 行为 §5 / 接法 §6）。
 *
 * 三条不能破的边界：
 *   ① 球默认 **armed**：停在左上角不动、不接管指针、不拦点击 —— 不碰它就等于没有它
 *      （整页默认开启，`?vp=0` 可关掉）；
 *   ② 球不接管**点击**（只接管拖拽），用户想点哪儿就点哪儿；
 *   ③ 球只在 `.hero` 范围内活动，不进 buttons / 卡片区。
 */

type OrbMode = 'off' | 'on';
type OrbState = 'idle' | 'hint' | 'grab' | 'drag' | 'glide';
type TierKey = 'mat' | 'lens' | 'alpha' | 'size' | 'caustic';
/** 自动巡游预设：linear 直线滑行 / curve 曲线游走（两端慢、末尾尤其慢） */
type RoamKind = 'linear' | 'curve';

/** 默认落点（相对 .hero 的局部坐标，px，指球的**中心**）：左上角，
 *  正好落在 kicker 那一行上方的留白里，不会一上来就压着标题。 */
const HOME_LEFT = 24;
const HOME_TOP = 24;

/* --- 物理参数（§5.1）。位置与速度都在 .hero 的局部坐标里，滚动不影响 --- */

/** ⚠️ 这是**每秒保留的比例**，不是"摩擦系数"本身 —— 值越大，摩擦越小、滑得越远越久。
 *  0.06 → 一次甩出滑约 355px；0.13 → 约 480px。
 *  2026-09-17 摩擦再调小一档：0.06 → 0.13。 */
const DRAG_DECAY = 0.13;
const MIN_V = 0.02; // px/ms，低于它就算停下
const MAX_V = 2.5; // px/ms（≈2500px/s）。封顶太低会"甩不动"，太高则撞边后会在
//                    边界之间弹很久才停 —— 实测 4.5 时一次猛甩能弹三四个来回
const EDGE_BOUNCE = 0.65; // 撞边反向 ×0.65（原 0.5，弹回更有力）
const EDGE_SLACK = 20; // 允许略微溢出到上下留白，贴边时不被生硬切断
const V_SMOOTH = 0.4; // 速度平滑系数（单帧 Δ/Δt 太抖，直接用它会让惯性乱飞）
const STRETCH_V = 1.6; // 拉满拉长所需的速度（px/ms）
const STRETCH_MAX = 0.12; // ≤1.12（§4.2「像被手指带着走的水滴」）

/* --- 自动巡游的两个预设（仅 Lab）。
   ① linear —— 随机方向 + 摩擦衰减。速度方向在整段里**不变**，所以每段读起来都
      接近直线（这正是用户观察到的"有点类似线性的"），"渐慢"完全来自摩擦。
   ② curve  —— 路径弯曲 + 速度包络。方向以随机角速度持续旋转（走出来是弧线），
      速度大小按 sin^SHAPE 包络：**慢起 → 中段饱满 → 长尾收束**。
      两端都慢、末尾尤其慢 —— 用户点名要的"起始以及末尾，主要是末尾的速度渐慢"。 */
const LINEAR_SPEED: [number, number] = [0.5, 0.95]; // px/ms（原 0.8–1.7 减半：不然手抓不住）
const CURVE_AMP: [number, number] = [0.3, 0.55]; // 峰值速度 px/ms
const CURVE_DUR: [number, number] = [2.8, 4.2]; // 一段巡游的时长（s）
const CURVE_SPIN: [number, number] = [0.35, 0.95]; // 角速度 rad/s：越大弯得越急
const CURVE_SHAPE = 1.3; // 包络指数：越大，首尾收得越绵长

/** 人刚松手 / 一段巡游刚结束之后，隔多久才允许自动巡游接管。
 *  ⚠️ 以前这里是**立刻**：release() 没有推 kickAt，只要旧的 kickAt 已过期，
 *  球停下的**下一帧**就又被踢出去 —— 读起来是"手还没走它就回来抢"。
 *  2026-09-17 用户先要求"稍微长一点"，做到 2–3s 后反馈"有点长了"，
 *  最终定为 **1–1.8s**：够形成一个明确的停顿，又不至于让人以为它不会再动了。 */
const ROAM_REST: [number, number] = [1000, 1800];

/** 区间随机 */
const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/**
 * 现在是**默认打开**的（用户 2026-09-17 决定）。
 *
 * 原先这里是一整套"桌面 / 触摸判定"（URL > localStorage > UA），因为当初的约束是
 * 「桌面端看不到这个球」。用户后来推翻了它：「为什么不给默认网页也加上那个光球和
 * 参数调整？小球游走的视觉效果也很棒，桌面端也不影响体验（因为小球可以选择启用与否）。」
 *
 * 这个判断是成立的 —— 球默认 **armed**：停在左上角不动、不接管指针、不拦截点击，
 * 不点它就等于没有它。于是判定整个不需要了，只留一个强制关闭开关：
 *   `?vp=0`  关掉（做 A/B 对比、排查"是不是球的锅"时用）
 */
function readMode(): OrbMode {
  return new URLSearchParams(window.location.search).get('vp') === '0' ? 'off' : 'on';
}

/** 三层材质：body 管呼吸与投影，lens 管折射，caustic 管焦散，rim 管边缘光。
 *  最外层那枚 flash 只在"启用"那一瞬间出现一次。 */
function OrbFace() {
  return (
    <span className="hero-orb__body">
      <span className="hero-orb__lens" />
      <span className="hero-orb__caustic" />
      <span className="hero-orb__rim" />
      <span className="hero-orb__flash" />
    </span>
  );
}

interface BodyOpts {
  /** 能不能拖 */
  interactive: boolean;
  /** 没人碰的时候自己巡游（Lab 用：让"它会动"一眼可见） */
  autoplay: boolean;
  /** 巡游预设。用手挡一下随时能接管，两种都刻意调慢了 */
  roamKind?: RoamKind;
}

/**
 * 球的身体：位置、速度、状态机、指针接管。
 *
 * 每帧只写 CSS 变量与 left/top（不触发 React 重渲染）——状态切换才 setState。
 * 这一点很重要：物理轮里**不能**让 transition 参与每帧驱动的属性，
 * 否则形变永远慢一截（进度条那次就是这么栽的，见项目记忆）。
 */
function useOrbBody({ interactive, autoplay, roamKind = 'linear' }: BodyOpts) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<OrbState>('hint');
  const [armed, setArmed] = useState(true);
  const stateRef = useRef<OrbState>('hint');
  /** 未激活时球就待在左上角不动 —— 点击或直接拖走都算"启用它"（也是触摸端的兜底手势）。 */
  const armedRef = useRef(true);
  const playRef = useRef(autoplay);
  playRef.current = autoplay;
  /** 探针用的临时覆盖（null = 跟随 prop）。测试要能确定性地关掉巡游。 */
  const playOverride = useRef<boolean | null>(null);
  const kindRef = useRef<RoamKind>(roamKind);
  kindRef.current = roamKind;

  useEffect(() => {
    const el = ref.current;
    const hero = el?.closest<HTMLElement>('.hero');
    if (!el || !hero) return;

    const body = { x: HOME_LEFT, y: HOME_TOP, vx: 0, vy: 0 };
    let dragging = false;
    let pid = -1;
    let lastT = 0;
    let lastPx = 0;
    let lastPy = 0;
    let angle = 0;
    let kickAt = 0;
    /* 巡游段的状态：只有预设②（曲线）需要跨帧记住方向与时钟 */
    const roam = { active: false, t: 0, T: 0, dir: 0, spin: 0, amp: 0 };
    let lastKind: RoamKind = kindRef.current;

    const commit = (s: OrbState) => {
      if (stateRef.current === s) return;
      stateRef.current = s;
      setState(s);
    };

    /* 活动范围 = .hero 外扩 20px，再减掉球的半径。
       每帧重算，所以 resize / 滚动后自动跟上，不用额外监听。 */
    const bounds = () => {
      const r = el.offsetWidth / 2;
      return {
        minX: -EDGE_SLACK + r,
        maxX: hero.offsetWidth + EDGE_SLACK - r,
        minY: -EDGE_SLACK + r,
        maxY: hero.offsetHeight + EDGE_SLACK - r,
      };
    };

    const localise = (clientX: number, clientY: number) => {
      const hr = hero.getBoundingClientRect();
      const b = bounds();
      // 拖拽时也 clamp：手指把它拖到 buttons 区，球也必须停在 HERO 范围内
      // （§7「不离开 HERO 区」）。只在惯性时 clamp 的话，球会被拖出去留在那儿。
      return {
        x: Math.min(Math.max(clientX - hr.left, b.minX), b.maxX),
        y: Math.min(Math.max(clientY - hr.top, b.minY), b.maxY),
      };
    };

    /** 启用它：先来一次小小的发光，然后它才开始游走。
        点击（轻触）与直接拖走都走这里 —— 触摸端没有 hover，需要一个明确的起点。 */
    const activate = () => {
      if (!armedRef.current) return;
      armedRef.current = false;
      setArmed(false);
      el.setAttribute('data-flash', '1');
      // 让那一下发光先被看见，再起飞 —— 否则光还没散，球已经跑远了
      kickAt = performance.now() + 420;
    };

    const down = (e: PointerEvent) => {
      // ⚠️ 这里**不**因为 dragging 已经是 true 就提前返回。pointerup 会丢
      // （窗口失焦 / capture 被系统丢掉 / 事件被别处吃掉），一旦丢了球就卡在
      // "永远被按住"的状态，用户再按一次也拖不动它 —— 实测被这个坑了一次。
      // 重新按下 = 重新拿起，这比卡死好。
      activate();
      // 人一接手，自动巡游立刻让位 —— 不然球会一边跟你抢一边自己滑
      roam.active = false;
      dragging = true;
      pid = e.pointerId;
      // setPointerCapture 会让指针移出元素后仍然收到 move —— 拖拽必需。
      // 注意它会顺带派发一次 pointerleave（猫那边的老坑），这里不监听 leave，无碍。
      el.setPointerCapture(pid);
      // 重新拿起 = 清掉残余速度（§5.1）
      body.vx = 0;
      body.vy = 0;
      Object.assign(body, localise(e.clientX, e.clientY));
      lastT = e.timeStamp;
      lastPx = e.clientX;
      lastPy = e.clientY;
      virtualPointer.hijacked = true;
      virtualPointer.active = true;
      virtualPointer.x = e.clientX;
      virtualPointer.y = e.clientY;
      commit('grab');
      e.preventDefault();
    };

    const move = (e: PointerEvent) => {
      if (!dragging) return;
      // pointerup 会丢（窗口失焦 / capture 被丢 / 事件被别处吃掉）——
      // 最可靠的兜底是在 move 里看 e.buttons，否则球会卡在"永远被按住"。
      if ((e.buttons & 1) === 0) {
        release();
        return;
      }
      const dt = Math.max(e.timeStamp - lastT, 1);
      // 速度必须按 px/ms 归一化，并用 e.timeStamp 而不是假设事件间隔。
      // 项目踩过：按"单次事件位移 / 一个大常数"算，恒得 0.02，效果完全不出来。
      body.vx = body.vx * (1 - V_SMOOTH) + ((e.clientX - lastPx) / dt) * V_SMOOTH;
      body.vy = body.vy * (1 - V_SMOOTH) + ((e.clientY - lastPy) / dt) * V_SMOOTH;
      lastT = e.timeStamp;
      lastPx = e.clientX;
      lastPy = e.clientY;
      Object.assign(body, localise(e.clientX, e.clientY));
      commit('drag');
    };

    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (pid >= 0 && el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
      pid = -1;
      // 先给它一段安静时间再允许自动巡游接管（见 ROAM_REST）——
      // 无论这次是"甩出去的"还是"轻轻放下的"，都要等。
      kickAt = performance.now() + between(ROAM_REST);
      const sp = Math.hypot(body.vx, body.vy);
      if (sp > MAX_V) {
        body.vx *= MAX_V / sp;
        body.vy *= MAX_V / sp;
      }
      if (sp < 0.08) {
        body.vx = 0;
        body.vy = 0;
        virtualPointer.hijacked = false;
        virtualPointer.active = false;
        commit('idle');
      } else {
        commit('glide');
      }
    };

    let raf = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      // 夹紧 dt：切标签页回来时不要让它瞬移一大段
      const dt = Math.min(now - prev, 48);
      prev = now;

      if (!dragging) {
        // 巡游预设被切换 → 立刻收掉当前这段，下一段用新预设
        if (lastKind !== kindRef.current) {
          lastKind = kindRef.current;
          roam.active = false;
          body.vx = 0;
          body.vy = 0;
          kickAt = 0;
          commit('idle');
        }

        if (roam.active) {
          /* 预设② · 曲线游走：方向持续旋转 → 走出弧线；速度走包络 → 两端慢、末尾最慢。
             ⚠️ 它**不再叠摩擦** —— 包络已经负责"渐慢"，再叠摩擦会收得太急，
             末尾会从"慢下来"变成"刹住"。 */
          roam.t += dt / 1000;
          const p = Math.min(roam.t / roam.T, 1);
          const env = Math.pow(Math.sin(Math.PI * p), CURVE_SHAPE);
          roam.dir += roam.spin * (dt / 1000);
          const sp = roam.amp * env;
          body.x += Math.cos(roam.dir) * sp * dt;
          body.y += Math.sin(roam.dir) * sp * dt;

          // 撞边改**转向**而不是反弹：包络还在走，一次碰撞不该把它打断
          const b = bounds();
          if (body.x < b.minX) {
            body.x = b.minX;
            roam.dir = Math.PI - roam.dir;
          } else if (body.x > b.maxX) {
            body.x = b.maxX;
            roam.dir = Math.PI - roam.dir;
          }
          if (body.y < b.minY) {
            body.y = b.minY;
            roam.dir = -roam.dir;
          } else if (body.y > b.maxY) {
            body.y = b.maxY;
            roam.dir = -roam.dir;
          }
          body.vx = Math.cos(roam.dir) * sp;
          body.vy = Math.sin(roam.dir) * sp;

          if (p >= 1) {
            roam.active = false;
            body.vx = 0;
            body.vy = 0;
            kickAt = now + between(ROAM_REST);
            virtualPointer.hijacked = false;
            virtualPointer.active = false;
            commit('idle');
          }
        } else if (body.vx || body.vy) {
          /* 拖着丢出来的惯性：靠摩擦衰减。预设①的每一段也是走这条路径。 */
          const decay = Math.pow(DRAG_DECAY, dt / 1000);
          body.vx *= decay;
          body.vy *= decay;
          body.x += body.vx * dt;
          body.y += body.vy * dt;

          const b = bounds();
          if (body.x < b.minX) {
            body.x = b.minX;
            body.vx = -body.vx * EDGE_BOUNCE;
          } else if (body.x > b.maxX) {
            body.x = b.maxX;
            body.vx = -body.vx * EDGE_BOUNCE;
          }
          if (body.y < b.minY) {
            body.y = b.minY;
            body.vy = -body.vy * EDGE_BOUNCE;
          } else if (body.y > b.maxY) {
            body.y = b.maxY;
            body.vy = -body.vy * EDGE_BOUNCE;
          }

          if (Math.hypot(body.vx, body.vy) < MIN_V) {
            body.vx = 0;
            body.vy = 0;
            virtualPointer.hijacked = false;
            virtualPointer.active = false;
            commit('idle');
          }
        } else if ((playOverride.current ?? playRef.current) && !armedRef.current && now > kickAt) {
          // 没人碰的时候自己巡游一段，让"它会动"一眼可见
          if (kindRef.current === 'curve') {
            roam.active = true;
            roam.t = 0;
            roam.T = between(CURVE_DUR);
            roam.dir = Math.random() * Math.PI * 2;
            roam.spin = between(CURVE_SPIN) * (Math.random() < 0.5 ? -1 : 1);
            roam.amp = between(CURVE_AMP);
          } else {
            const a = Math.random() * Math.PI * 2;
            const sp = between(LINEAR_SPEED);
            body.vx = Math.cos(a) * sp;
            body.vy = Math.sin(a) * sp;
            kickAt = now + between(ROAM_REST);
          }
          virtualPointer.hijacked = true;
          virtualPointer.active = true;
          commit('glide');
        }
      }

      const sp = Math.hypot(body.vx, body.vy);

      // 位置（每帧写 left/top —— 它们不在 transition 里，所以立即生效）
      el.style.left = body.x.toFixed(1) + 'px';
      el.style.top = body.y.toFixed(1) + 'px';

      // 拉长：沿**运动方向**，幅度随速度（越快越像彗星），停下时收回圆形。
      // 低速时角度会抖，所以只在有速度时更新方向。
      if (sp > 0.01) {
        if (sp > 0.05) angle = (Math.atan2(body.vy, body.vx) * 180) / Math.PI;
        const t = Math.min(sp / STRETCH_V, 1);
        const stretch = 1 + t * STRETCH_MAX;
        el.style.setProperty('--orb-angle', angle.toFixed(1) + 'deg');
        el.style.setProperty('--orb-stretch', stretch.toFixed(3));
        el.style.setProperty('--orb-squash', (1 - (stretch - 1) * 0.35).toFixed(3));
      } else if (el.style.getPropertyValue('--orb-stretch')) {
        // 停下就把内联值交还给 CSS。不交还的话，CSS 里那份"静态状态规格"
        // （DRAG 的 1.12 / GLIDE 的 1.08）会被这里的 1.000 一直压着，
        // 于是任何静态预览都看不到它们 —— 调样式时会被这个骗到。
        el.style.removeProperty('--orb-angle');
        el.style.removeProperty('--orb-stretch');
        el.style.removeProperty('--orb-squash');
      }

      // 球在动 → 它就是这个时刻的指针。这不是"伪造鼠标事件"，是真的坐标。
      if (dragging || body.vx || body.vy) {
        const hr = hero.getBoundingClientRect();
        virtualPointer.x = hr.left + body.x;
        virtualPointer.y = hr.top + body.y;
        virtualPointer.active = true;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // 首次出现的呼吸播完就回落待机（时长只有一个来源：CSS 令牌，不用 setTimeout）
    const onAnimEnd = (e: AnimationEvent) => {
      if (e.animationName === 'orb-flash-ring') {
        el.removeAttribute('data-flash'); // 发光的环放完就摘掉，别留着占层
        return;
      }
      if (stateRef.current === 'hint') commit('idle');
    };
    el.addEventListener('animationend', onAnimEnd);

    /* Dev-only 探针：把球精确摆到某个视口坐标、或强制某个状态。
       没有它，截图核对"球压在蓝字上是什么样"就只能靠拖 —— 而拖着的时候
       球是拉长的，看不出原始形状。生产构建里 `import.meta.env.DEV` 为 false，
       整块会被摇掉。 */
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__orb = {
        place: (clientX: number, clientY: number) => {
          Object.assign(body, localise(clientX, clientY));
          body.vx = 0;
          body.vy = 0;
          // 顺便把自动巡游推迟一会儿，否则摆好的球下一帧就自己跑了
          kickAt = performance.now() + 2500;          virtualPointer.hijacked = false;
          virtualPointer.active = false;
          commit('idle');
          return { ...body };
        },
        force: (s: OrbState) => {
          commit(s);
          return { state: s, pos: { ...body } };
        },
        /** 跳过点击、直接启用（验收脚本用） */
        arm: () => {
          armedRef.current = false;
          setArmed(false);
          kickAt = performance.now() + 420;
          return { armed: false };
        },
        /** 临时开关自动巡游（null = 跟随菜单）。测试要能确定性地比两种预设。 */
        play: (on: boolean | null) => {
          playOverride.current = on;
          roam.active = false;
          body.vx = 0;
          body.vy = 0;
          kickAt = 0;
          return { play: playOverride.current };
        },
        read: () => ({
          ...body,
          state: stateRef.current,
          armed: armedRef.current,
          dragging,
          pid,
          roaming: roam.active,
          play: playOverride.current ?? playRef.current,
          /** 距离允许自动巡游接管还有多久（ms，负数=已经过点） */
          restFor: Math.round(kickAt - performance.now()),
          hero: { w: hero.offsetWidth, h: hero.offsetHeight },
        }),
      };
    }

    if (interactive) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      // capture / 失焦都会让 up 丢掉，补两条窗口级的兜底
      window.addEventListener('pointerup', release);
      window.addEventListener('blur', release);
    }

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('animationend', onAnimEnd);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', release);
      el.removeEventListener('pointercancel', release);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
      virtualPointer.hijacked = false;
      virtualPointer.active = false;
    };
  }, [interactive]);

  return { ref, state, armed };
}

interface OrbProps {
  state: OrbState;
  tier?: Partial<Record<TierKey, string>>;
}

/** 球的 DOM（位置与形变由 useOrbBody 每帧写，这里只负责材质与状态属性）。 */
function OrbShell({
  state,
  tier,
  interactive,
  armed,
  orbRef,
}: OrbProps & {
  interactive?: boolean;
  /** true = 尚未启用（停在左上角，等一次点击/拖走） */
  armed?: boolean;
  orbRef?: React.Ref<HTMLDivElement>;
}) {
  const live = state === 'grab' || state === 'drag' || state === 'glide';
  return (
    <div
      className="hero-orb"
      ref={orbRef}
      data-state={state}
      data-live={live ? '1' : undefined}
      data-interactive={interactive ? '1' : undefined}
      data-armed={armed ? '1' : undefined}
      data-mat={tier?.mat}
      data-lens={tier?.lens}
      data-alpha={tier?.alpha}
      data-size={tier?.size}
      data-caustic={tier?.caustic}
      aria-hidden
    >
      <OrbFace />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 球的完整形态（?vp=1 —— 桌面与触摸**同一套**）
 * ---------------------------------------------------------------------------
 * 一颗**活的**球 + 左上角一条小横杠（调参菜单默认收起，点它才弹出来）。
 * 桌面端也是这一套 —— 用户 2026-09-17 明确要求：「桌面端也应该默认把那个小球
 * 气泡以及横杠的调参栏给设置出来；只要不去碰它、触摸它，它的逻辑还是不变的。」
 *
 * 刻意**不**摆一排静止的状态样本，也不放放大的解剖球 —— 两种都试过，
 * 读起来是"几个图标印在页面上"，恰好把这个功能的本质（动）抹掉了。
 * 状态在拖它的时候自己会全部出现；材质靠"把球停在字上"看。
 * ------------------------------------------------------------------------ */

const TIERS: { key: TierKey; label: string; opts: { id: string; label: string }[] }[] = [
  {
    key: 'mat',
    label: 'material 材质方向',
    opts: [
      { id: 'pearl', label: 'pearl 珍珠' },
      { id: 'lens', label: 'lens 玻璃 ★' },
      { id: 'droplet', label: 'droplet 水滴' },
    ],
  },
  {
    key: 'lens',
    label: 'lens 模糊 / 提亮',
    opts: [
      { id: 'soft', label: '0.6 / 1.08' },
      { id: 'std', label: '1.0 / 1.12 ★' },
      { id: 'crisp', label: '1.4 / 1.16' },
    ],
  },
  {
    key: 'size',
    label: 'size 直径',
    opts: [
      { id: 'sm', label: '30' },
      { id: 'std', label: '34 ★' },
      { id: 'lg', label: '40' },
    ],
  },
  {
    key: 'alpha',
    label: 'idle 待机不透明度',
    opts: [
      { id: 'low', label: '0.38' },
      { id: 'std', label: '0.50 ★' },
      { id: 'high', label: '0.62' },
    ],
  },
  {
    key: 'caustic',
    label: 'caustic 焦散',
    opts: [
      { id: 'soft', label: '淡' },
      { id: 'std', label: '标准 ★' },
      { id: 'hard', label: '强' },
    ],
  },
];

const DEFAULT_TIER: Record<TierKey, string> = {
  mat: 'lens',
  lens: 'std',
  size: 'std',
  alpha: 'std',
  caustic: 'std',
};

/** 左上角那条小横杠的"泛光"提示只出现一次：点开过就写一笔，
 *  之后刷新、下次再来都不再泛 —— 一个提示重复第二遍就变成噪音了。 */
const TIP_KEY = 'softlab.orb.tip';

function readTip(): boolean {
  try {
    return window.localStorage.getItem(TIP_KEY) !== '1';
  } catch {
    // 隐私模式下读不到存储：宁可不闪，也不要每次刷新都闪一遍
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * 横杠的位置：默认贴在小标题（`.site-head`）下方，**并且整条留在 HERO 交互框外**
 * ---------------------------------------------------------------------------
 * 演进：
 *   ① 最早写死 `top: 14px` —— 压在左上角 brand 上（用户 2026-09-17 截图指出）
 *   ② 改成「`.site-head` 下沿 + 8px」—— 又掉进 HERO 交互框里，和框/气泡叠住
 *      （用户 2026-09-17 再次指出）。根因：实测 `.site-head` 的下沿**正好等于**
 *      `.hero` 的上沿（桌面 1440 / 移动 390 / 平板 820 全都是 y=57），
 *      所以「下沿 + 8」必然越界。
 *   ③ 现在用双约束取更严格的那个 —— 既要在小标题下方，又要留在框外。
 * ------------------------------------------------------------------------ */

const BAR_POS_KEY = 'softlab.orb.bar';
const BAR_PAD = 6; // 距视口边缘的最小留白
/** 与 `.orb-bar` 的 CSS 尺寸保持一致：用来算「整条留在交互框外」需要多少空间 */
const BAR_H = 14;
/** 与左上角「SOFT LAB」标志底边的最小间距 */
const BAR_GAP_ABOVE = 1;
/** 与 HERO 交互框上沿的最小间距（要 >0，否则会像以前一样压在框线上） */
const BAR_GAP_BELOW = 1;
/** 按住多久才算"要挪位置"（ms）。低于它就算是普通点击 → 展开菜单 */
const BAR_HOLD = 320;

function defaultBarPos(): { left: number; top: number } {
  const hero = document.querySelector('.hero');
  // 锚点用 `.brand`（标志本体）的底边。**不能用 `.site-head`**：后者的盒底被自身
  // padding 撑到了 57px，正好等于 `.hero` 的上沿，拿它当参照必然越界。
  const brand = document.querySelector('.brand');
  const head = document.querySelector('.site-head');
  const brandBottom = brand
    ? brand.getBoundingClientRect().bottom
    : head
      ? head.getBoundingClientRect().bottom
      : 41;
  const heroTop = hero ? hero.getBoundingClientRect().top : 57;

  // 桌面 1440 / 窄屏 742 / 移动 390 / 平板 820 实测：标志底 41、框沿 57，
  // 中间那条 16px 的缝正好放得下 14px 的横杠 → 两个约束都落在 top=42。
  const belowBrand = brandBottom + BAR_GAP_ABOVE; // 期望：在小标题下方
  const aboveHero = heroTop - BAR_H - BAR_GAP_BELOW; // 硬约束：整条留在交互框外
  // ⚠️ 极端窄的视口下标志万一折行变高，这两个值会打架。此时**取 aboveHero**：
  //    「底部在交互框外面」是用户明确的硬要求，优先保它。
  const wanted = Math.min(belowBrand, aboveHero);
  return { left: 14, top: Math.round(Math.max(BAR_PAD, wanted)) };
}

function readBarPos(): { left: number; top: number } {
  try {
    const raw = window.localStorage.getItem(BAR_POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { left?: unknown; top?: unknown };
      if (typeof p.left === 'number' && typeof p.top === 'number') {
        return { left: p.left, top: p.top };
      }
    }
  } catch {
    /* 隐私模式 / 脏数据：退回默认位置 */
  }
  return defaultBarPos();
}

/** 别让它被拖出视口（窗口缩小之后回来的位置也要夹一次） */
function clampBar(p: { left: number; top: number }, el: HTMLElement) {
  const w = el.offsetWidth || 24;
  const h = el.offsetHeight || 14;
  return {
    left: Math.min(Math.max(p.left, BAR_PAD), Math.max(BAR_PAD, window.innerWidth - w - BAR_PAD)),
    top: Math.min(Math.max(p.top, BAR_PAD), Math.max(BAR_PAD, window.innerHeight - h - BAR_PAD)),
  };
}

/**
 * 长按横杠 → 拖到别处 → 松手记住。短按仍然是"展开菜单"。
 *
 * 拖过之后要**吃掉紧随的那一次 click**，否则松手会顺手把菜单弹开 ——
 * 用户只是想挪个位置，不该连带发生别的事。
 */
function useDockDrag(ref: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pos = clampBar(readBarPos(), el);
    let holdTimer = 0;
    let dragging = false;
    let eatClick = false;
    const start = { x: 0, y: 0, left: 0, top: 0 };

    const paint = () => {
      el.style.left = `${pos.left}px`;
      el.style.top = `${pos.top}px`;
    };
    paint();

    const cancelHold = () => {
      if (!holdTimer) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start.x = e.clientX;
      start.y = e.clientY;
      start.left = pos.left;
      start.top = pos.top;
      holdTimer = window.setTimeout(() => {
        holdTimer = 0;
        dragging = true;
        el.setAttribute('data-drag', '1');
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* capture 拿不到也照样能拖（只是指针移出元素后跟不动） */
        }
      }, BAR_HOLD);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        // 还没到长按时间就明显移动了 → 用户其实是在滚动，取消长按判定
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancelHold();
        return;
      }
      pos = clampBar(
        { left: start.left + (e.clientX - start.x), top: start.top + (e.clientY - start.y) },
        el,
      );
      paint();
    };

    const onUp = () => {
      cancelHold();
      if (!dragging) return;
      dragging = false;
      el.removeAttribute('data-drag');
      eatClick = true;
      // 兜底：万一这次没有 click 跟上来，别把后面的点击也吃掉
      window.setTimeout(() => {
        eatClick = false;
      }, 400);
      try {
        window.localStorage.setItem(BAR_POS_KEY, JSON.stringify(pos));
      } catch {
        /* 存不下就只在本次会话里生效 */
      }
    };

    // 捕获阶段拦掉，React 挂在 root 上的 onClick 就收不到了
    const onClickCapture = (e: MouseEvent) => {
      if (!eatClick) return;
      eatClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    const onResize = () => {
      pos = clampBar(pos, el);
      paint();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClickCapture, true);
    window.addEventListener('resize', onResize);

    return () => {
      cancelHold();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('resize', onResize);
    };
  }, [ref]);
}

function OrbStage() {
  const [tier, setTier] = useState<Record<TierKey, string>>(DEFAULT_TIER);
  const [play, setPlay] = useState(true);
  const [roam, setRoam] = useState<RoamKind>('curve');
  // 调参菜单默认**收起**成左上角一条小横杠：启用球之后，菜单不该一直占着屏幕
  const [open, setOpen] = useState(false);
  // 泛光只在"从没点开过"时出现 —— 它唯一的任务是让人好奇地点一下
  const [tip, setTip] = useState(readTip);
  const { ref, state, armed } = useOrbBody({ interactive: true, autoplay: play, roamKind: roam });
  const dockRef = useRef<HTMLButtonElement>(null);
  useDockDrag(dockRef);

  const openMenu = () => {
    setOpen(true);
    if (tip) {
      setTip(false);
      try {
        window.localStorage.setItem(TIP_KEY, '1');
      } catch {
        /* 隐私模式：这次不闪就行了 */
      }
    }
  };

  return (
    <>
      {/* 活球：直接挂 .hero 下（不能放进别的容器，否则物理找不到 HERO 边界） */}
      <OrbShell orbRef={ref} state={state} armed={armed} interactive tier={tier} />

      {/* 最小化态：一条小横杠。短按展开菜单，**长按可以拖到任意位置并记住** */}
      <button
        ref={dockRef}
        type="button"
        className="orb-bar orb-dock"
        data-hidden={open ? '1' : undefined}
        data-tip={tip ? '1' : undefined}
        onClick={openMenu}
        aria-label="展开调参菜单（长按可拖动位置）"
      />

      <div className="orb-tuner" data-open={open ? '1' : '0'}>
        <div className="orb-tuner__head">
          <span className="orb-tuner__k">ORB LAB</span>
          <button
            type="button"
            className="orb-bar"
            onClick={() => setOpen(false)}
            aria-label="最小化"
          />
        </div>
        {TIERS.map((g) => (
          <div className="orb-group" key={g.key}>
            <span className="orb-group__k">{g.label}</span>
            <div className="orb-group__opts">
              {g.opts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="orb-opt"
                  aria-pressed={tier[g.key] === o.id}
                  onClick={() => setTier((t) => ({ ...t, [g.key]: o.id }))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="orb-group">
          <span className="orb-group__k">自动巡游</span>
          <div className="orb-group__opts">
            <button type="button" className="orb-opt" aria-pressed={play} onClick={() => setPlay(true)}>
              开
            </button>
            <button type="button" className="orb-opt" aria-pressed={!play} onClick={() => setPlay(false)}>
              关
            </button>
          </div>
        </div>
        <div className="orb-group">
          <span className="orb-group__k">巡游预设</span>
          <div className="orb-group__opts">
            <button type="button" className="orb-opt" aria-pressed={roam === 'linear'} onClick={() => setRoam('linear')}>
              linear 直线
            </button>
            <button type="button" className="orb-opt" aria-pressed={roam === 'curve'} onClick={() => setRoam('curve')}>
              curve 曲线 ★
            </button>
          </div>
        </div>
        <p className="orb-tuner__note">
          先<b>点它一下</b>（或直接拖走）才会启用 —— 那一下会亮一下。<b>linear</b> 是随机方向 +
          摩擦（每段是直线），<b>curve</b> 是弧线 + 速度包络（慢起、末尾尤其慢）。
          ★ = 当前推荐值 · 正式形态是 <b>?vp=1</b> · 桌面端默认看不到球
        </p>
      </div>
    </>
  );
}

export default function HeroOrb() {
  // 只在首次渲染判定一次：URL > localStorage > UA
  // 'on' 与 'lab' 现在是同一套东西（`?orb=lab` 保留为旧链接的别名）
  const [mode] = useState<OrbMode>(readMode);
  if (mode === 'off') return null;
  return <OrbStage />;
}
