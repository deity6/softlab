import * as THREE from 'three';
import { GRID_Y, pickLayout } from './constants.js';
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
  constructor({ wrapper, canvas, onStateChange }) {
    this.wrapper = wrapper;
    this.canvas = canvas;
    this.onStateChange = onStateChange;

    this.firstScene = new OpeningScene();
    this.camera = this.firstScene.camera;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
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
    this.game = new Game(this.onStateChange);
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

  update(active, visible) {
    if (!active || !visible) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.firstScene.update(dt);
    this.game?.update(dt);
    this.render();
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
