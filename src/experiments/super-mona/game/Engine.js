import * as THREE from 'three';
import { GRID_Y, pickLayout } from './constants.js';
import { FIXED_DT } from './rules.js';
import { OpeningScene } from './OpeningScene.js';
import { Transition } from './Transition.js';
import { Game } from './Game.js';

/**
 * 渲染世界用的正交相机（原 `g`）。
 * 初始 frustum 是 ±1，每次 resize 会改成 ±画布尺寸的一半。
 */
const worldCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4);
worldCamera.position.z = 2;
worldCamera.lookAt(new THREE.Vector3(0, 0, 0));
worldCamera.updateProjectionMatrix();

/**
 * 原 `class eJ` —— 引擎。
 * 持有两个场景（待机 3D Mona / 游戏），通过 Transition 在两者之间切换，
 * 并负责画布尺寸与网格缩放的同步。
 */
export class Engine {
  constructor({ wrapper, canvas, onStateChange, gameOptions = {} }) {
    this.wrapper = wrapper;
    this.canvas = canvas;
    this.onStateChange = onStateChange;
    /**
     * 传给 `Game` 的构造参数（`logRun` 之类）。放在这里是因为每一局
     * （开始 / 再来一局）都会重建一个 `Game`，这些选项得跟着一起传下去。
     */
    this.gameOptions = gameOptions;

    this.firstScene = new OpeningScene();
    this.camera = this.firstScene.camera;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    /** 固定步长的余量（见 `update`） */
    this.accumulator = 0;
    this.game = null;
    this.transition = new Transition();
    this.canvasWidth = 0;
    this.canvasHeight = 0;

    this.handleMouseMove = (event) => {
      this.firstScene.handleMouseMove(event, this.wrapper.getBoundingClientRect());
    };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0xe9edec, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    this.scene.add(this.firstScene.group, this.transition.group);
    window.addEventListener('mousemove', this.handleMouseMove);
    this.clock.start();
  }

  startGame(onComplete) {
    if (this.game) return false;
    return this.transitionToGame(() => this.firstScene.hide(), onComplete);
  }

  transitionToGame(prepare, onComplete) {
    return this.transition.start({
      onCovered: () => {
        prepare();
        this.createGame();
        this.camera = worldCamera;
      },
      onComplete,
    });
  }

  createGame() {
    if (this.game) return;
    this.game = new Game(this.onStateChange, this.gameOptions);
    this.scene.add(this.game.group);
    const width = this.wrapper.clientWidth;
    if (width > 0) this.game.resize(width);
  }

  stopGame(onComplete) {
    if (!this.game) return false;
    return this.transition.start({
      onCovered: () => {
        this.destroyGame();
        this.firstScene.show();
        this.camera = this.firstScene.camera;
      },
      onComplete,
    });
  }

  restartGame(onComplete) {
    if (!this.game) return false;
    return this.transitionToGame(() => this.destroyGame(), onComplete);
  }

  resize(viewportWidth) {
    const width = this.wrapper.clientWidth;
    const height = (GRID_Y * width) / pickLayout(viewportWidth).gridX;
    if (width <= 0 || height <= 0) return;

    const changed = width !== this.canvasWidth || height !== this.canvasHeight;
    if (changed) {
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.renderer.setSize(width, height, false);
      worldCamera.left = -width / 2;
      worldCamera.right = width / 2;
      worldCamera.top = height / 2;
      worldCamera.bottom = -height / 2;
      worldCamera.updateProjectionMatrix();
    }

    this.firstScene.resize(width, height, viewportWidth);

    if (changed) {
      this.game?.resize(width);
      this.render();
    }
  }

  /**
   * 逐帧推进。
   *
   * ⚠️ 这里是**固定步长**（累积器模式），不是把 rAF 给的 dt 直接喂下去。
   *
   * 为什么非改不可：排行榜的校验是「服务端拿种子把这一局重放一遍」，而地形是
   * 边滚动边生成的（`generateSceneUntil`）—— 只要调用时机差半帧，随机数的消费
   * 顺序就错开，之后整张地图和浏览器不是同一张，校验全废。固定步长之后，
   * 两边逐帧同 dt、同顺序。
   *
   * 顺带的效果：物理不再随显示器刷新率变化（144Hz 和 60Hz 手感一致）。
   */
  update(active, visible) {
    if (!active || !visible) {
      // 不可见时不要把时间攒着 —— 切回来那一刻会一次补出几百帧
      this.accumulator = 0;
      this.clock.getDelta();
      return;
    }

    this.accumulator += this.clock.getDelta();
    // 上限 0.25 秒：切标签页回来、或主线程卡一下，delta 可能是几十秒，
    // 补几千帧会直接卡死页面。丢掉这段不影响任何东西 —— 游戏内的时间就是
    // `elapsed`，它跟着帧数走，不跟墙上的钟走。
    if (this.accumulator > 0.25) this.accumulator = 0.25;

    let stepped = false;
    while (this.accumulator >= FIXED_DT) {
      this.firstScene.update(FIXED_DT);
      this.game?.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
      stepped = true;
    }
    if (stepped) this.render();
  }

  render() {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.transition.dispose();
    this.destroyGame();
    this.firstScene.dispose();
    this.renderer.dispose();
  }

  destroyGame() {
    if (!this.game) return;
    this.scene.remove(this.game.group);
    this.game.dispose();
    this.game = null;
  }
}
