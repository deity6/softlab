import * as THREE from 'three';
import { CELL, GRID_X, GRID_Y } from './constants.js';
import { Game } from './Game.js';
import { DEMO_SPAN, DEMO_SPEED } from './demoLevel.js';

/**
 * 实验卡片封面上的那段演示。
 *
 * 封面**不是画出来的** —— 这里真的把游戏跑起来，画面和点进去玩到的完全同一套
 * 渲染（同一批 shader、同一套配色、同一个 InstancedMesh）。之前用手绘 2D 替代，
 * 结果一改配色、一改方块渲染，封面就跟游戏对不上了。
 *
 * 只做三件事，别的什么都不加：建渲染器、每帧 update、死了重开。
 * 相机与世界的比例由 CSS 保证（canvas 上挂了 `aspect-ratio: 94/26`）——
 * `Game.resize` 只做 `group.scale.set(width, width, 1)`，世界宽恒等于 1，
 * 所以画布比例一旦不是 94:26，画面就会被拉变形。
 */

/** 结算画面停这么久再重开：太短像是画面闪了一下，太长又像卡住了 */
const RESTART_DELAY = 1.8;
const CLEAR_COLOR = 0xe9edec;

/**
 * 取景框高度（格）。
 *
 * 世界是 94 格宽、26 格高，整幅塞进卡片那两百多像素里，一格只有 3px —— Mona
 * 三格宽，也就是 9px，看不出那是个角色，只像块脏点。
 *
 * 所以竖直方向只取 20 格：地形占 0–21 格，取 2–22 正好把地面、台阶和跳跃空间
 * 都装进去，顶上的空网格本来也没内容。Mona 因此长到约 18px，能看出在跑、在跳、
 * 在踩虫子。
 *
 * ⚠️ 高度定标、宽度自适应 —— 不是反过来。卡片宽度随断点变（单列时能到 400px），
 *    如果按宽度定取景，Mona 的像素大小会跟着卡片宽度漂。按高度定，它恒定。
 */
const VIEW_H = 26;

export class DemoRunner {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;
    this.active = true;
    this.w = 0;
    this.h = 0;
    this.scale = 0;
    this.restartIn = -1;
    this.game = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setClearColor(CLEAR_COLOR, 1);
    // 卡片只有一百多像素高，DPR 拉满只是白烧像素
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    // 取景用的中间节点：只做平移，游戏自己的坐标系一点没碰
    this.rig = new THREE.Group();
    this.scene.add(this.rig);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4);
    this.camera.position.z = 2;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.clock = new THREE.Clock();
    this.tick = this.tick.bind(this);

    this.resize();
    this.spawn();
    this.raf = requestAnimationFrame(this.tick);
  }

  spawn() {
    // 第一个参数是状态回调 —— 封面不显示 HUD，所以吞掉
    const game = new Game(() => {}, {
      autoPlay: true,
      silent: true,
      // 预制关卡 + 恒定速度 —— 封面要的是「每次一模一样、看着舒服、能循环」
      demo: { span: DEMO_SPAN, speed: DEMO_SPEED },
    });
    this.rig.add(game.group);
    this.game = game;
    this.applyView();
    this.restartIn = -1;
  }

  kill() {
    if (!this.game) return;
    this.rig.remove(this.game.group);
    this.game.dispose();
    this.game = null;
  }



  /** 卡片离开视口就停 —— 首页可能同时挂着好几张 */
  setActive(active) {
    this.active = active;
    if (active) this.clock.getDelta(); // 丢掉暂停期间累积的时间
  }

  /**
   * 尺寸与取景一起定。
   *
   * `Game.resize(width)` 只是 `group.scale.set(width, width, 1)` —— 世界宽恒为 1，
   * 所以传进去的其实是「一个世界单位占多少像素」，想放大就传大一点。
   */
  applyView() {
    if (this.w <= 0 || this.h <= 0) return;

    // 竖直恒定 VIEW_H 格，水平按画布实际比例铺开 —— 比例天然对齐，画面不会被拉伸
    const viewW = (VIEW_H * this.w) / this.h;
    const s = (this.w * GRID_X) / viewW; // 世界 1 单位 = s 像素
    this.scale = s;
    this.game?.resize(s);

    // 水平：取景框钉在 scrollX 那一格。`worldGroup` 整体左移了 scrollX 格，
    // 所以「第 scrollX 格」落在世界 x = -0.5，rig 右移半个（放大后的）世界宽即可。
    this.rig.position.x = -this.w / 2 + 0.5 * s;

    // 竖直完全固定：整幅 26 格就在这里，不跟角色、也不跟她脚下的地面。
    // 世界高 26 格，画面中心正对世界中心，所以位移就是 0 —— 背景网格因此纹丝不动。
    this.rig.position.y = 0;
  }

  resize() {
    const w = Math.round(this.canvas.clientWidth);
    const h = Math.round(this.canvas.clientHeight);
    if (w <= 0 || h <= 0 || (w === this.w && h === this.h)) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    this.camera.updateProjectionMatrix();
    this.applyView();
  }

  tick() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    if (!this.active || document.hidden) return;

    this.resize();
    if (!this.game) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.game.update(dt);

    // 演示里 Mona 也会死 —— 这反而像有人在玩。让它停一下再重开一局。
    if (this.game.gameOver) {
      if (this.restartIn < 0) this.restartIn = RESTART_DELAY;
      this.restartIn -= dt;
      if (this.restartIn <= 0) {
        this.kill();
        this.spawn();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.kill();
    this.renderer.dispose();
    // 首页可能反复进出，不主动丢 context 会攒到浏览器上限（8～16 个）
    this.renderer.forceContextLoss?.();
  }
}
