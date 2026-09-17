/* ============================================================================
 * MOTION BUTTONS — 行为层
 * ----------------------------------------------------------------------------
 * 职责：
 *   1. 声明式初始化（data-mo / data-mo-next 自动补全 DOM 结构）
 *   2. 需要指针/状态机的效果：磁吸、光标光斑、涟漪、粒子爆发、加载态流转
 *   3. 对外 API：window.MotionButtons
 *
 * 无依赖，可 ES module（export）也可直接 <script>。约 6KB。
 * ========================================================================== */

(function (global) {
  "use strict";

  /* ---------------------------------------------------------------------- *
   * 工具
   * ---------------------------------------------------------------------- */

  /* NOTE: we deliberately do NOT bail out of pointer effects when the user
     prefers reduced motion. Windows with "show animations" switched off reports
     reduce, and bailing out made ripple / magnetic / cursor-spot / particle-burst
     appear completely dead. The CSS side shortens the timings instead, which is
     the part that actually matters for comfort. */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** 把元素里除 .mo-ico / .mo-* 结构外的裸内容包进指定容器 */
  function wrapContent(btn, wrapper) {
    const keep = [];
    Array.from(btn.childNodes).forEach((node) => {
      if (node.nodeType === 1 && node.classList.contains("mo-ico")) keep.push(node);
      else wrapper.appendChild(node);
    });
    btn.appendChild(wrapper);
    // 保持 .mo-ico 在 DOM 中的相对顺序（图标通常在文字之后）
    keep.forEach((ico) => btn.appendChild(ico));
  }

  /** 取按钮当前可见文案 */
  function readText(btn) {
    const src = $(".mo-label", btn) || btn;
    return (src.textContent || "").trim();
  }

  /* ---------------------------------------------------------------------- *
   * 冷却保护（cooldown guard）
   * ---------------------------------------------------------------------- *
   * 有些效果是"离散事件"（点击播放一段动画）。如果用户快速连点，动画会被
   * 反复打断重播，看起来就是"来回抽搐"——用户反馈 Arrow Slide 正是如此：
   *   「我如果频繁触发，它就会来回动。可以加一个缓冲保护，或者叫做冷却保护。」
   *
   * 用法：
   *   const gate = makeGate(btn, () => 300);       // 300ms 冷却
   *   btn.addEventListener('click', () => {
   *     if (!gate.try()) return;                    // 冷却中 → 忽略这次触发
   *     play();
   *   });
   *
   * ⚠️ 是否加冷却要按需判断，不是所有效果都该加：
   *   该加 —— 离散播放型（Arrow Slide / Split Reveal / Loading / Success /
   *           Flip / Particle Burst）：重播 = 抽搐，必须节流。
   *   不该加 —— 连续跟随型（Magnetic / Cursor Spot）：本来就该实时跟手。
   *   不该加 —— 状态切换型（Press Scale / Ripple）：每次按压都要有反馈，
   *           节流反而会让用户觉得"没反应"。
   *   弹性拉伸 Elastic Stretch 也不用：它自己带蓄力—释放周期，本身就是节流。
   *
   * 冷却时长取该效果自身的动画时长最自然（动画没放完就不再接新的），
   * 所以 gate 接受一个返回毫秒数的函数，由调用方从令牌派生。
   * ---------------------------------------------------------------------- */
  function makeGate(el, cooldownMs) {
    let until = 0;
    const span = () => (typeof cooldownMs === "function" ? cooldownMs() : cooldownMs);
    return {
      /** 冷却结束了吗？返回 true 表示可以触发（并自动开始下一次冷却）。 */
      try() {
        const now = performance.now();
        if (now < until) return false;
        until = now + span();
        return true;
      },
      /** 距离冷却结束还有多少毫秒（0 表示已经可以触发）。 */
      remaining() {
        return Math.max(0, until - performance.now());
      },
      /** 立刻解除冷却（例如效果被强制复位时）。 */
      reset() {
        until = 0;
      },
    };
  }

  /* ---------------------------------------------------------------------- *
   * 结构构建器 —— 把简洁的书写形式补全为效果所需 DOM
   * ---------------------------------------------------------------------- */

  const BUILDERS = {
    /** 箭头滑入：需要 .mo-label 与 .mo-ico */
    "arrow-slide"(btn) {
      if (!btn.querySelector(".mo-label")) {
        const label = document.createElement("span");
        label.className = "mo-label";
        wrapContent(btn, label);
      }
      if (!btn.querySelector(".mo-ico")) {
        const ico = document.createElement("span");
        ico.className = "mo-ico";
        ico.setAttribute("aria-hidden", "true");
        ico.innerHTML =
          '<svg viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btn.appendChild(ico);
      }
    },

    /** 文案切换：current / next 两层纵向滚动 */
    "text-swap"(btn) {
      if (btn.querySelector(".mo-swap")) return;
      const text = readText(btn);
      const next = btn.dataset.moNext || text;
      const swap = document.createElement("span");
      swap.className = "mo-swap";
      swap.innerHTML =
        '<span class="mo-swap__current">' + text + "</span>" +
        '<span class="mo-swap__next">' + next + "</span>";
      btn.textContent = "";
      btn.appendChild(swap);

      const hasIcon = btn.dataset.moIcon !== "false";
      if (hasIcon) {
        const ico = document.createElement("span");
        ico.className = "mo-ico";
        ico.setAttribute("aria-hidden", "true");
        ico.innerHTML =
          '<svg viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        btn.appendChild(ico);
      }
    },

    /** 分裂展开：ghost 撑尺寸 + 左右两片 + 新文案层 */
    "split-reveal"(btn) {
      if (btn.querySelector(".mo-split")) return;
      const text = readText(btn);
      const next = btn.dataset.moNext || text;
      const box = document.createElement("span");
      box.className = "mo-split";
      box.innerHTML =
        '<span class="mo-split__ghost" aria-hidden="true">' + text + "</span>" +
        '<span class="mo-split__half mo-split__half--l" aria-hidden="true">' + text + "</span>" +
        '<span class="mo-split__half mo-split__half--r" aria-hidden="true">' + text + "</span>" +
        '<span class="mo-split__next">' + next + "</span>";
      btn.textContent = "";
      btn.appendChild(box);
    },

    /** 3D 翻转：正 / 背两面 */
    "flip-3d"(btn) {
      if (btn.querySelector(".mo-flip__inner")) return;
      const front = readText(btn);
      const back = btn.dataset.moNext || front;
      const inner = document.createElement("span");
      inner.className = "mo-flip__inner";
      inner.innerHTML =
        '<span class="mo-flip__side mo-flip__front">' + front + "</span>" +
        '<span class="mo-flip__side mo-flip__back">' + back + "</span>";
      btn.textContent = "";
      btn.appendChild(inner);
      btn.setAttribute("aria-pressed", "false");
    },

    /** 图标变形：两根 bar 模拟 + → 花形 → × */
    "icon-morph"(btn) {
      if (btn.querySelector(".mo-morph")) return;
      const label = $(".mo-label", btn);
      const box = document.createElement("span");
      box.className = "mo-morph";
      box.setAttribute("aria-hidden", "true");
      box.innerHTML =
        '<span class="mo-bar mo-bar--h"></span><span class="mo-bar mo-bar--v"></span>';
      if (label) btn.insertBefore(box, label);
      else btn.appendChild(box);
      btn.setAttribute("aria-expanded", "false");
    },

    /** 加载形变：label + spinner */
    "loading-morph"(btn) {
      if (!btn.querySelector(".mo-label")) {
        const label = document.createElement("span");
        label.className = "mo-label";
        wrapContent(btn, label);
      }
      if (!btn.querySelector(".mo-spinner")) {
        const sp = document.createElement("span");
        sp.className = "mo-spinner";
        sp.setAttribute("aria-hidden", "true");
        btn.appendChild(sp);
      }
      btn.setAttribute("aria-live", "polite");
    },

    /** 成功状态：在 loading-morph 基础上加对勾 */
    "success-morph"(btn) {
      BUILDERS["loading-morph"](btn);
      if (!btn.querySelector(".mo-check")) {
        const ck = document.createElement("span");
        ck.className = "mo-check";
        ck.setAttribute("aria-hidden", "true");
        ck.innerHTML =
          '<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M4 10.5 8 14.5 16 6"/></svg>';
        btn.appendChild(ck);
      }
    },

    /** 进度按钮：label + 百分数 */
    progress(btn) {
      if (!btn.querySelector(".mo-pct")) {
        const label = $(".mo-label", btn);
        if (!label) {
          const l = document.createElement("span");
          l.className = "mo-label";
          wrapContent(btn, l);
        }
        const pct = document.createElement("span");
        pct.className = "mo-pct";
        pct.textContent = "0%";
        btn.appendChild(pct);
      }
    },

    /** 粒子爆发：预生成粒子池 */
    "particle-burst"(btn) {
      if (btn.querySelector(".mo-particle")) return;
      const n = parseInt(btn.dataset.moParticles || "24", 10);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const p = document.createElement("span");
        p.className = "mo-particle";
        p.setAttribute("aria-hidden", "true");
        frag.appendChild(p);
      }
      btn.appendChild(frag);
    },
  };

  /* ---------------------------------------------------------------------- *
   * 行为绑定
   * ---------------------------------------------------------------------- */

  /** 涟漪：在点击位置注入扩散圆 */
  /**
   * 涟漪：一次点击生成**多圈同心波**，错开出发，像水面一圈圈荡开。
   *
   * 用户：「当前像扩散而不像涟漪，效果比较简陋」。旧版只放一个实心圆，
   * 那是"色块在变大"。真实涟漪是多圈波峰依次向外走、逐圈变弱。
   *
   * 尺寸**按落点分别算水平/垂直半轴**（不是正圆的直径）——
   * 见下方注释：正圆在扁按钮里会被裁成两条竖弧，这是"看不到涟漪"的主因。
   */
  function bindRipple(btn) {
    const rings = () =>
      parseInt(getComputedStyle(btn).getPropertyValue("--mo-ripple-rings"), 10) || 3;
    const gap = () =>
      parseFloat(getComputedStyle(btn).getPropertyValue("--mo-ripple-gap")) || 90;

    btn.addEventListener("pointerdown", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // ⚠️ 椭圆波，不是正圆：水平/垂直半轴分别取"到较远一侧边的距离"。
      //    正圆在 100×48 的扁胶囊里一超过 48px 就被上下裁掉，只剩两条竖弧
      //    （截图亲眼确认过）。椭圆则让波峰**同时抵达四边**，整圈始终可见。
      const halfW = Math.max(x, rect.width - x);
      const halfH = Math.max(y, rect.height - y);
      // 半径按到最远**角**的距离再放大一点：椭圆的两个半轴各自到达自己的边，
      // 但四个角仍需要更长一点才盖得住（1.0 时正好过角）。
      const k = 1.0;

      const n = rings();
      for (let i = 0; i < n; i++) {
        const wave = document.createElement("span");
        wave.className = "mo-ripple-wave";
        wave.style.left = x + "px";
        wave.style.top = y + "px";
        wave.style.setProperty("--mo-wave-w", halfW * 2 * k + "px");
        wave.style.setProperty("--mo-wave-h", halfH * 2 * k + "px");
        // stagger the rings so they read as successive wavefronts
        wave.style.setProperty("--mo-ripple-delay", i * gap() + "ms");
        // Later rings start thinner — energy dissipating outward. The base
        // stroke is 4.5px so the FIRST ring is clearly visible on the pale
        // page (3px read as "太淡" — the user could barely see the ripples).
        wave.style.setProperty("--mo-ripple-stroke", Math.max(1.5, 4.5 - i * 1.1) + "px");
        btn.appendChild(wave);
        wave.addEventListener("animationend", () => wave.remove());
      }
    });
  }

  /** 磁吸跟随：把光标偏移归一化写入 --mo-mx / --mo-my */
  /** 磁吸跟随：写入归一化光标偏移，位移 + 旋转 + 缩放由 CSS 消费 */
  function bindMagnetic(btn) {
    // 0.8 (was 0.35): at 14px × 0.35 the button only travelled ~4.9px, which
    // read as "nothing happened". The user asked for it to be obvious.
    const strength = parseFloat(btn.dataset.moStrength || "0.8");
    const clamp = (v) => Math.max(-1, Math.min(1, v));

    const set = (nx, ny) => {
      btn.style.setProperty("--mo-mx", (nx * strength).toFixed(3));
      btn.style.setProperty("--mo-my", (ny * strength).toFixed(3));
    };

    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      set(
        clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)),
        clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)),
      );
    });

    btn.addEventListener("pointerleave", () => set(0, 0));
    btn.addEventListener("blur", () => set(0, 0));
  }

  /**
   * 弹性拉伸 —— 按住蓄力，蓄满自动释放。
   *
   * 状态机：
   *   pointerdown  → charging：rAF 每帧把 `--mo-charge` 从 0 推到 1
   *   charge == 1  → 自动释放（用户说的"到最大就自动松手"）
   *   pointerup    → 提前释放（此时 charge 就是存了多少能量）
   *   释放         → is-releasing + 把蓄力深度写成 `--mo-fire-from` / `--mo-fire-amp`
   *
   * 弹射幅度 ∝ 蓄力深度，所以轻点一下 = 小弹，按满 = 大弹。
   * 到顶自动释放这条很重要：它让"按久一点"有终点，不会无限蓄下去。
   */
  function bindElasticStretch(btn) {
    const chargeMs = () =>
      parseFloat(getComputedStyle(btn).getPropertyValue("--mo-charge-time")) || 800;
    const releaseMs = () =>
      parseFloat(getComputedStyle(btn).getPropertyValue("--mo-dur-slow")) || 500;

    let raf = 0;
    let start = 0;
    let charge = 0;
    let charging = false;
    let fired = false;
    // Cooldown gate: while a release animation is playing, a new press must not
    // start a second charge. Without it, mashing the button restarts the
    // squeeze mid-bounce and the motion reads as a stutter rather than a series
    // of distinct boings. `releaseMs()` is the animation's own length, so the
    // gate opens exactly when the button is back at rest.
    const gate = makeGate(btn, releaseMs);

    const paint = (v) => {
      charge = v;
      btn.style.setProperty("--mo-charge", v.toFixed(3));
    };

    const release = () => {
      if (!charging) return;
      charging = false;
      cancelAnimationFrame(raf);

      // How hard to fire. A small floor keeps a stray tap from looking dead,
      // and the ^0.75 curve lifts the middle of the range so a half-hold is
      // clearly bigger than a tap (a straight line made them look identical).
      const depth = Math.max(0.12, charge);
      const shaped = Math.pow(depth, 0.75);
      const amp = parseFloat(
        getComputedStyle(btn).getPropertyValue("--mo-fire-amp") || "0.34",
      );
      btn.style.setProperty("--mo-fire-from", depth.toFixed(3));
      btn.style.setProperty("--mo-fire-amp", (amp * shaped).toFixed(3));

      btn.classList.remove("is-charging");
      // restart the release animation: remove, force reflow, re-add
      btn.classList.remove("is-releasing");
      void btn.offsetWidth;
      btn.classList.add("is-releasing");
      paint(0);
    };

    const tick = (now) => {
      if (!charging) return;
      const p = Math.min(1, (now - start) / chargeMs());
      // ease-in: the squeeze accelerates as it builds, which reads as "winding
      // up". p^1.6 rather than p^2 — squaring made the first half of the hold
      // barely move (measured 0.32 at 420ms), so a medium press looked the
      // same as a tap. The gentler exponent keeps the ramp legible throughout.
      paint(Math.pow(p, 1.6));
      if (p >= 1) {
        // charged all the way -> fire without waiting for the pointer to lift
        fired = true;
        release();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // A press during the release animation is ignored: the gate reopens only
      // once the bounce has finished, so rapid clicks produce clean, separate
      // boings instead of a mangled half-charge.
      if (!gate.try()) return;
      charging = true;
      fired = false;
      start = performance.now();
      btn.classList.remove("is-releasing");
      btn.classList.add("is-charging");
      paint(0);
      raf = requestAnimationFrame(tick);
    });

    // pointerup on the window: the pointer may have left the button while held
    const end = () => { if (charging) release(); };
    window.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("pointerleave", end);

    btn.addEventListener("animationend", (e) => {
      if (e.animationName === "mo-stretch-fire") {
        btn.classList.remove("is-releasing");
        btn.style.removeProperty("--mo-fire-from");
        btn.style.removeProperty("--mo-fire-amp");
      }
    });
  }

  /**
   * 光标光斑 —— 阻尼跟随的折射透镜。
   *
   * 用户反馈：「当前是一个淡蓝色的圈，跟随鼠标。我想要**阻尼跟随**以及
   *            **非线性**，类似于**光线折射**的效果。去掉蓝色/淡蓝色线圈。」
   *
   * 三个输出：
   *   --mo-lx / --mo-ly  **阻尼后**的位置（不是光标原位置！）
   *   --mo-spot-a        运动方向角度（deg）
   *   --mo-spot-v        速度 0..1（驱动拉长 / 高光强度）
   *   --mo-spot-p        光标横向占比，驱动文字上的掠过式扫光
   *
   * ⚠️ 阻尼跟随是这一版的核心。旧版把光标位置**直接**写进变量，光点与指针
   * 完全同步 —— 那看起来就是个贴在鼠标上的图章。现在位置在 rAF 里做 lerp：
   *   cur += (target - cur) * 0.16
   * 光点因此**落后一拍再追上来**，停下时缓慢吸附到位，像被拖着的透镜。
   * 这也是"非线性"的来源：位移对时间的响应是指数逼近，不是线性跟随。
   *
   * ⚠️ 速度按 **px/ms** 算，不能按"每次事件的位移"。指针事件每秒 100+ 次，
   * 单次位移只有几像素；拿单次位移除以一个大常数，速度恒为 0.02 上下，
   * 光斑根本不会变形。实测真实鼠标 0.3–0.8 px/ms，归一化常数取 1.0。
   */
  function bindCursorSpot(btn) {
    const FOLLOW = 0.16;   // per-frame lerp factor: lower = more lag/damping

    let tx = null;         // target (pointer) position, px within the button
    let ty = null;
    let cx = null;         // damped (current) position
    let cy = null;
    let lastX = null;
    let lastY = null;
    let lastT = 0;
    let v = 0;             // smoothed speed, 0..1
    let raf = 0;

    const frame = () => {
      // exponential approach — this is what makes the follow feel damped
      cx += (tx - cx) * FOLLOW;
      cy += (ty - cy) * FOLLOW;
      btn.style.setProperty("--mo-lx", cx.toFixed(2) + "px");
      btn.style.setProperty("--mo-ly", cy.toFixed(2) + "px");

      // speed decays once the pointer stops, so the lens relaxes to a circle
      v *= 0.9;
      if (v < 0.004) v = 0;
      btn.style.setProperty("--mo-spot-v", v.toFixed(3));

      const settled = Math.abs(tx - cx) < 0.15 && Math.abs(ty - cy) < 0.15;
      raf = (v > 0 || !settled) ? requestAnimationFrame(frame) : 0;
    };

    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      tx = x;
      ty = y;
      // first sample: start the lens AT the pointer instead of flying in
      if (cx === null) {
        cx = x;
        cy = y;
        btn.style.setProperty("--mo-lx", x + "px");
        btn.style.setProperty("--mo-ly", y + "px");
      }
      btn.style.setProperty("--mo-spot-p", ((x / r.width) * 100).toFixed(2) + "%");

      const t = e.timeStamp || performance.now();
      if (lastX !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dt = Math.max(1, t - lastT);
        const dist = Math.hypot(dx, dy);
        const pxPerMs = dist / dt;
        const speed = Math.min(1, pxPerMs / 1.0);
        v = v * 0.55 + speed * 0.45; // EMA: responsive but not jittery
        btn.style.setProperty("--mo-spot-v", v.toFixed(3));
        if (dist > 1) {
          const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          btn.style.setProperty("--mo-spot-a", deg.toFixed(1) + "deg");
        }
      }
      lastX = x;
      lastY = y;
      lastT = t;
      if (!raf) raf = requestAnimationFrame(frame);
    });

    btn.addEventListener("pointerleave", () => {
      lastX = null;
      lastY = null;
      v = 0;
      btn.style.setProperty("--mo-spot-v", "0");
    });

    // Click: a gloss band sweeps diagonally to the right (see .mo-gloss).
    // Restart-safe: remove the class, force a reflow, re-add it — so a rapid
    // second click replays the band from the left edge instead of jumping
    // mid-flight. `animationend` clears it; no timers.
    btn.addEventListener("click", () => {
      btn.classList.remove("is-glinting");
      void btn.offsetWidth;
      btn.classList.add("is-glinting");
    });
    btn.addEventListener("animationend", (e) => {
      if (e.animationName === "mo-gloss-sweep") btn.classList.remove("is-glinting");
    });
  }

  /**
   * 箭头滑入 —— 带冷却保护的进入/离开状态机。
   *
   * 用户反馈：「Arrow Slide 依旧是常规的，动画冷却保护没做。我如果频繁触发，
   * 它就会来回动。」—— 鼠标在边界上抖动时，`:hover` 会疯狂开合，文字与箭头
   * 反复来回滑，看起来像抽搐。
   *
   * 两个方向都要管，但方式不同（这是关键）：
   *   · 进入：冷却闸门。动画时长内不重复入场，避免抖动时反复重播。
   *   · 离开：**延迟**而不是立即收回。鼠标短暂划出边界时先挂起，
   *     若在延迟内又回到按钮上，就取消收回 —— 这样抖动不再产生来回。
   *     延迟取动画时长的一半，真的移开时收回依然干脆。
   *
   * ⚠️ CSS 里已经没有 `:hover` 选择器了 —— 如果保留，浏览器会绕过这里的闸门
   * 直接开合，冷却等于白做。`.is-shown` 是唯一的开关。
   */
  function bindArrowSlide(btn) {
    const dur = () =>
      parseFloat(getComputedStyle(btn).getPropertyValue("--mo-dur-fast")) || 300;
    const enterGate = makeGate(btn, dur);
    let leaveTimer = 0;
    let catchUp = 0;

    const show = () => {
      clearTimeout(leaveTimer);
      clearTimeout(catchUp);
      if (enterGate.try()) {
        btn.classList.add("is-shown");
        return;
      }
      // Still cooling down but the pointer IS on the button: queue the reveal
      // for when the cooldown expires rather than dropping it.
      catchUp = window.setTimeout(show, enterGate.remaining() + 20);
    };

    const hide = () => {
      clearTimeout(catchUp);
      // Defer the retract: a brief excursion over the edge should not collapse
      // the arrow, because that is what turns pointer jitter into "来回动".
      clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        btn.classList.remove("is-shown");
      }, dur() * 0.5);
    };

    btn.addEventListener("pointerenter", show);
    btn.addEventListener("pointerleave", hide);
    btn.addEventListener("focus", show);
    btn.addEventListener("blur", () => {
      clearTimeout(leaveTimer);
      btn.classList.remove("is-shown");
    });
  }

  /** 粒子爆发 */
  /**
   * 粒子爆发 —— 参考 doki 的点击粒子，但更简、更快。
   *
   * 用户：「参考 doki.pretender.asia 的全局点击粒子效果……可以更简一些，
   *        但依旧要有惊喜感」。
   *
   * 惊喜感来自**不均匀**（doki 的粒子之所以好看，是因为它们不是整齐的圆环）：
   *   · 角度：均匀分布 + 抖动（避免出现明显的"环"）
   *   · 距离：两档速度 —— 一部分冲得远（outer），一部分留在近处（inner），
   *     形成"爆发 + 余烬"两层
   *   · 每颗粒子有自己的延迟，快的先走
   *   · 方向角写进 `--mo-angle`，让粒子沿飞行方向拉长（CSS 里做）
   */
  /**
   * 3D 翻转 —— 点击驱动，三态交替填充，带冷却。
   *
   * 用户（任务里标为「重点」）：
   *   · 鼠标在触发/不触发之间来回切换时卡片一直转 → 改成 **click** 驱动
   *   · 加**冷却时间** → 翻转动画期间不接受新点击
   *   · 默认**不填充**（和普通按钮一样）
   *   · 第 1 次：蓝色从**底部**升起；第 2 次：绿色从**顶部**降下盖住；
   *     第 3 次：蓝色再从底部升起……如此交替
   *
   * `data-fill` 记录当前该显示哪一层：
   *   无 → blue（从底部升）→ green（从顶部降）→ blue → green → …
   * 每次点击同时把**另一层**推回它出发的方向，两层不会同时可见。
   * 角度**累积** +180°，所以连翻多次不会"翻回来"。
   */
  function bindFlip(btn) {
    // ⚠️ `--mo-dur-roll` is shared with BOTH the flip transform and the fill
    // layers (see PART 19). Read the same token here so the cooldown opens
    // exactly when the flip AND its fill have finished — reading a different
    // token (it used to read `--mo-dur-lazy`) let a second click in while the
    // fill was still climbing.
    const dur = () =>
      parseFloat(getComputedStyle(btn).getPropertyValue("--mo-dur-roll")) || 900;
    // ⚠️ 冷却**刻意只留 50ms**（用户 2026-09-17 明确要求）。
    //
    // 原本这里是 `dur() + 80`（整段动画期间不接受新点击）。那个保护的来由是
    // 旧版用 **hover** 驱动 —— 鼠标擦过就会反复触发，卡片"一直转"，非常不优雅。
    // 但现在翻转是 **click** 驱动：点击本身就需要人到场、按下、松开，
    // 天然有频率上限，用户连点是**有意为之**，应该被尊重而不是被拦。
    // 而且 `--mo-flip-angle` 是累加值，连点时 transition 会从**当前角度**接着
    // 往 +180° 走，读起来是连续旋转，不会闪回。
    //
    // 这 50ms 只防一件事：同一次物理点击被重复派发（pointer + click 双触发）。
    // 想要完全放开就把数值改成 0。
    const gate = makeGate(btn, () => 50);
    let angle = 0;
    let faceTimer = 0;
    let faceSync = 0;

    const apply = (fill) => {
      // park the layer we are NOT using back where it came from
      const unused = fill === "blue" ? "green" : "blue";
      btn.dataset.fill = fill;
      btn.dataset.unused = unused;
      angle += 180;
      btn.style.setProperty("--mo-flip-angle", angle + "deg");
      btn.setAttribute("aria-pressed", String(fill === "green"));

      // ⚠️ 正/背面**显式切换**，不靠 `backface-visibility`。
      //    `overflow: hidden`（裁填充层用）会把父级的 `transform-style` 强制成
      //    flat，backface 判定因此不可靠 —— 实测症状是翻到背面后显示的是
      //    **镜像的正面文字**，背面文案（"Flipped ✓"）永远轮不到出场。
      //    切换点选在"转到侧面"的那一瞬（settle 曲线前段快，约 16% 时长走完
      //    90°），那一刻两个面都读不出字，所以切换是无痕的。
      const face = fill === 'blue' ? 'back' : 'front';
      window.clearTimeout(faceTimer);
      faceTimer = window.setTimeout(() => { btn.dataset.face = face; }, Math.round(dur() * 0.16));
      // 兜底：连点间隔短于上面那一拍时，定时器会被不断重置，可能一直没切过去。
      // 动画走完后强制对齐一次同一个值（幂等，不会产生视觉抖动）。
      window.clearTimeout(faceSync);
      faceSync = window.setTimeout(() => { btn.dataset.face = face; }, Math.round(dur() + 60));
    };

    btn.addEventListener("click", () => {
      if (!gate.try()) return;
      const cur = btn.dataset.fill;
      // no fill -> blue; blue -> green; green -> blue
      apply(cur === "blue" ? "green" : "blue");
    });
  }

  /** 指针事件 → 元素内坐标（用于"从点击处炸开"） */
  function relPoint(el, e) {
    if (!e || typeof e.clientX !== "number") return null;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * 粒子爆发 —— **从点击位置**炸开（不是从按钮几何中心）。
   *
   * 用户：「Particle Burst 应以**点击位置**为触发点」。
   * 旧版把每颗粒子的 `left/top` 钉在 50%/50%，所以点按钮左边、粒子还是从
   * 正中间冒出来 —— 手感上"不是我在点的地方"。
   * 现在把落点写进每颗粒子的 `left/top`，角度/距离仍按原来的分布计算，
   * 于是整团粒子以**你按下的那个点**为圆心散开。
   * 未拿到坐标（键盘触发等）时回退到几何中心。
   */
  function burstParticles(btn, origin) {
    const parts = $$(".mo-particle", btn);
    const n = parts.length;
    const r = btn.getBoundingClientRect();
    const cx = origin ? origin.x : r.width / 2;
    const cy = origin ? origin.y : r.height / 2;

    parts.forEach((p, i) => {
      // even spread + jitter, so it never reads as a perfect ring
      const base = (i / n) * Math.PI * 2;
      const angle = base + (Math.random() - 0.5) * 0.7;
      // two speed tiers: fast sparks and slower embers
      const far = i % 3 !== 0;
      const dist = far
        ? 40 + Math.random() * 26
        : 20 + Math.random() * 14;

      // the burst is centred on the click, not on the button's middle
      p.style.left = cx.toFixed(1) + "px";
      p.style.top = cy.toFixed(1) + "px";
      p.style.setProperty("--mo-angle", ((angle * 180) / Math.PI).toFixed(1) + "deg");
      p.style.setProperty("--mo-dist", dist.toFixed(1) + "px");
      // fast sparks leave first; embers lag by up to ~70ms
      p.style.setProperty("--mo-particle-delay", (far ? 0 : 40 + Math.random() * 30).toFixed(0) + "ms");

      p.style.animation = "none";
      void p.offsetWidth; // 强制回流以重启动画
      p.style.animation = "";
    });
  }

  /* ---------------------------------------------------------------------- *
   * 状态机 —— Loading / Success / Progress 的三段式流转
   * ---------------------------------------------------------------------- */

  const timers = new WeakMap();

  function clearTimer(el) {
    const t = timers.get(el);
    if (t) {
      clearTimeout(t);
      timers.delete(el);
    }
  }

  const api = {
    /**
     * 进入加载态（记录原始尺寸，并算出"正圆"该用多宽）
     *
     * ⚠️ 只记宽度是不够的：`width: 44px` + 实际高度 48px 会收成一个**椭圆**
     * （截图实测过 —— 椭圆的蓝块，不是圆）。这里同时量出高度写进 `--mo-h`，
     * CSS 用 `width: var(--mo-h)`，宽度就等于高度，必然是正圆。
     */
    loading(el) {
      if (!el) return;
      clearTimer(el);
      // ⚠️ 基准尺寸只在**非完成态**下量：完成态宽度可能不同，拿它当基准会漂。
      if (!el.classList.contains("is-done")) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mo-w", r.width + "px");
        // ⚠️ 不要 Math.round：这个值会同时喂给 width 和 height，
        //    取整后与按钮真实高度差零点几像素，用户一眼看出"圆不太圆"。
        el.style.setProperty("--mo-h", r.height + "px");
      }
      // ⚠️ 完成态与加载态必须**互斥**：两个选择器特异性相同（都是 0,3,0），
      //    `.is-done` 又写在后面，若同时挂着就会赢过 `.is-loading` ——
      //    症状是"再点一次按钮不收缩，而且转圈圈叠在 Saved 上"（截图实测）。
      el.classList.remove("is-done", "is-success", "is-complete");
      el.classList.add("is-loading");
      el.setAttribute("aria-busy", "true");
      return api;
    },

    /** 进入成功态 */
    success(el) {
      if (!el) return;
      clearTimer(el);
      el.classList.remove("is-loading");
      el.classList.add("is-success");
      el.removeAttribute("aria-busy");
      return api;
    },

    /** 复原到初始态 */
    reset(el, delay) {
      if (!el) return;
      const run = () => {
        el.classList.remove("is-loading", "is-success", "is-complete", "is-done");
        el.style.removeProperty("--mo-w");
        el.style.setProperty("--mo-progress", "0%");
        const pct = $(".mo-pct", el);
        if (pct) pct.textContent = "0%";
      };
      if (delay) {
        cleanUp(el);
        timers.set(el, setTimeout(run, delay));
      } else {
        run();
      }
      return api;
    },

    /** 进度条：pct 为 0–100，到 100 自动追加完成态 */
    progress(el, pct) {
      if (!el) return;
      const v = Math.max(0, Math.min(100, Number(pct) || 0));
      el.style.setProperty("--mo-progress", v + "%");
      const label = $(".mo-pct", el);
      if (label) label.textContent = Math.round(v) + "%";
      if (v >= 100) el.classList.add("is-complete");
      return api;
    },

    /** 翻转开关 */
    flip(el, force) {
      if (!el) return;
      const next = typeof force === "boolean" ? force : !el.classList.contains("is-flipped");
      el.classList.toggle("is-flipped", next);
      el.setAttribute("aria-pressed", String(next));
      return api;
    },

    /** 图标形变开关 */
    morph(el, force) {
      if (!el) return;
      const next = typeof force === "boolean" ? force : !el.classList.contains("is-morphed");
      el.classList.add("is-animating");
      el.classList.toggle("is-morphed", next);
      el.setAttribute("aria-expanded", String(next));
      setTimeout(() => el.classList.remove("is-animating"), 420);
      return api;
    },

    /** 一次性描边完成态 */
    draw(el, on) {
      if (!el) return;
      el.classList.toggle("is-drawn", on !== false);
      return api;
    },

    burst: burstParticles,

    /**
     * 演示用完整循环：loading → success → reset
     *
     * ⚠️ `loadMs` 1600 → 600 → **1200**。
     *
     * 前面两次是"缩短空等"（用户嫌点了半天没反应）。第三次（2026-09-17 晚）是
     * 反过来 —— 用户发现 Success Morph **根本没有加载指示渲染出来**
     * （`.mo-spinner` 的样式写在 PART 11，这边是个 0×0 空 span），
     * 所以看到的是"停一会儿，然后变成绿底对勾"。
     * 补上"收缩成圆 + 一笔画满圆环"之后，这 1200ms 是**有内容的时间**，
     * 不再是罚站（见 docs/motion-timing-standard.md §3：动画时长 ≠ 无反馈等待）。
     * 1200ms 刚好让 800ms 的收缩 + 1200ms 的画弧正常铺开。
     */
    cycle(el, loadMs, holdMs) {
      api.loading(el);
      clearTimer(el);
      timers.set(
        el,
        setTimeout(() => {
          api.success(el);
          timers.set(el, setTimeout(() => api.reset(el), holdMs || 1400));
        }, loadMs || 1200)
      );
      return api;
    },

    /**
     * 纯加载：收缩成圆 → 转圈 → **自己回到胶囊**（不进成功态）。
     *
     * Loading Morph 没有"成功面"（它没有对勾），所以不该走 `cycle` ——
     * 旧版复用 cycle 会把它推进 `.is-success`（而它没有对应的成功样式），
     * 于是"转完什么都没发生"，用户读到的是**流程没闭环**
     * （原话：「没怎么体系交互」）。现在它是一条完整闭环：
     *   胶囊 →(500ms 收)→ 圆 + 转圈 →(转 1200ms)→ 回到胶囊
     */
    load(el, runMs, holdMs) {
      if (!el) return api;
      api.loading(el);
      clearTimer(el);
      // 转圈 2000ms（用户：「转圈时间太短」），然后进完成态停 1600ms 再回初始 ——
      // 这样"点 →（有事在发生）→ 有结果 → 复位"是一条完整闭环。
      timers.set(
        el,
        setTimeout(() => {
          el.classList.remove("is-loading");
          el.classList.add("is-done");
          el.removeAttribute("aria-busy");
          timers.set(el, setTimeout(() => api.reset(el), holdMs || 1600));
        }, runMs || 2000)
      );
      return api;
    },
  };

  function cleanUp(el) {
    const t = timers.get(el);
    if (t) clearTimeout(t);
  }

  /* ---------------------------------------------------------------------- *
   * 初始化
   * ---------------------------------------------------------------------- */

  const EFFECTS = [
    "fill-sweep", "border-draw", "magnetic", "press-scale", "arrow-slide",
    "ripple", "glow-pulse", "liquid-fill", "split-reveal", "shadow-lift",
    "loading-morph", "success-morph", "progress", "icon-morph", "text-swap",
    "elastic-stretch", "blob-morph", "particle-burst", "flip-3d", "cursor-spot",
  ];

  /** 需要在初始化时构建 DOM 的效果（其余为纯 CSS） */
  /** React 侧已自带结构的效果（见 MotionButton.tsx），JS 不再构建 */
  const REACT_BUILT = new Set(['border-draw', 'liquid-fill', 'split-reveal']);

  const NEEDS_BUILD = new Set([
    "arrow-slide", "text-swap", "split-reveal", "flip-3d",
    "icon-morph", "loading-morph", "success-morph", "progress", "particle-burst",
  ]);

  /** 需要绑定指针行为的持久效果 */
  const PERSISTENT = {
    ripple: bindRipple,
    magnetic: bindMagnetic,
    "cursor-spot": bindCursorSpot,
    "elastic-stretch": bindElasticStretch,
    "arrow-slide": bindArrowSlide,
    "flip-3d": bindFlip,
  };

  /** 声明式点击行为：data-mo-click */
  const CLICK_ACTIONS = {
    loading: (el) => api.loading(el),
    success: (el) => api.success(el),
    reset: (el) => api.reset(el),
    cycle: (el) => api.cycle(el),
    load: (el) => api.load(el),
    // 把事件透传下去：声明式的 data-mo-click="burst" 也要从**指针落点**炸开
    burst: (el, e) => burstParticles(el, relPoint(el, e)),
    flip: (el) => api.flip(el),
    morph: (el) => api.morph(el),
  };

  function initOne(el) {
    if (el.dataset.moReady === "true") return;

    // data-mo="fill-sweep ripple" → class 补齐
    if (el.dataset.mo) {
      el.dataset.mo
        .split(/\s+/)
        .filter(Boolean)
        .forEach((name) => el.classList.add("mo-" + name));
    }
    if (el.dataset.moNext) el.setAttribute("data-mo-next", el.dataset.moNext);

    const names = EFFECTS.filter((n) => el.classList.contains("mo-" + n));
    if (!names.length) return;

    if (!el.classList.contains("mo-btn")) el.classList.add("mo-btn");

    names.forEach((name) => {
      // React 侧已经渲染好结构的效果，行为层只跳过"构建 DOM"这一步
      if (REACT_BUILT.has(name)) return;
      if (NEEDS_BUILD.has(name) && BUILDERS[name]) BUILDERS[name](el);
      if (PERSISTENT[name]) PERSISTENT[name](el);
    });

    // 声明式点击
    if (el.dataset.moClick) {
      const action = CLICK_ACTIONS[el.dataset.moClick];
      if (action) el.addEventListener("click", (e) => action(el, e));
    }

    // 粒子爆发也响应点击 —— 传落点，让粒子从**点击处**炸开
    if (names.includes("particle-burst") && !el.dataset.moClick) {
      el.addEventListener("click", (e) => burstParticles(el, relPoint(el, e)));
    }

    el.dataset.moReady = "true";
  }

  function init(root) {
    const scope = root || document;
    $$("[data-mo], .mo-btn", scope).forEach(initOne);
    return api;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  api.init = init;
  api.effects = EFFECTS;
  global.MotionButtons = api;
})(typeof window !== "undefined" ? window : globalThis);
