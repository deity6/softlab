import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import gsap from 'gsap';
import { ASSETS, LAYOUT_DESKTOP, LAYOUT_NARROW, pickLayout } from './constants.js';
import { Grid } from './Grid.js';
import {
  MONA3D_FACE_FRAG,
  MONA3D_PART_FRAG,
  MONA3D_PUPIL_FRAG,
  MONA3D_VERT,
} from './shaders.js';

const { mapLinear, clamp } = THREE.MathUtils;

/** 瞳孔 shader 需要一张描边贴图；原站没塞值，这里给一张全黑 1×1，效果等价于无描边 */
function createBlackTexture() {
  const data = new Uint8Array([0, 0, 0, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  return texture;
}

const OUTLINE_TEXTURE = createBlackTexture();

/**
 * 原 `class P` —— 把 GLB 拆开重建成程序化材质。
 * Face 走四色渐变 shader，Pupil 走噪点+高光 shader，其余部件用统一底色；
 * 对称部件在装配时就把镜像几何合并进去，眼睛则整体克隆翻转。
 */
class Mona3DAssembler {
  constructor(commonUniforms) {
    this.group = new THREE.Group();
    this.monaHeadGroup = new THREE.Group();
    this.commonUniforms = commonUniforms;
    this.group.add(this.monaHeadGroup);
  }

  create(scene) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = 'EyeGroup';
    this.monaHeadGroup.add(eyeGroup);

    scene.traverse((node) => {
      if (node.name === 'MonaHead') this.monaHeadGroup.position.copy(node.position);
      if (!(node instanceof THREE.Mesh)) return;

      const geometry = node.geometry;
      const material = this.createMaterial(node.name);
      const mirrored = geometry.clone();
      mirrored.scale(-1, 1, 1);

      switch (node.name) {
        case 'Face':
        case 'Nose':
        case 'Mouth':
        case 'Pupil_Highlight': {
          // 正面单体，只放一次
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(node.position);
          mesh.rotation.copy(node.rotation);
          this.monaHeadGroup.add(mesh);
          break;
        }
        case 'Eye':
        case 'Eyelash':
        case 'Pupil': {
          // 单侧眼睛，稍后靠克隆翻转出另一只
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(node.position);
          mesh.rotation.copy(node.rotation);
          mesh.name = node.name;
          eyeGroup.add(mesh);
          break;
        }
        default: {
          const merged = mergeGeometries([geometry, mirrored]);
          const mesh = new THREE.Mesh(merged, material);
          mesh.position.copy(node.position);
          mesh.rotation.copy(node.rotation);
          mesh.name = node.name;
          if (node.name === 'MonaTorso') this.group.add(mesh);
          else this.monaHeadGroup.add(mesh);
        }
      }
    });

    const mirroredEyes = eyeGroup.clone();
    mirroredEyes.name = 'EyeGroup_mirrored';
    mirroredEyes.scale.set(-1, 1, 1);
    this.monaHeadGroup.add(mirroredEyes);
  }

  createMaterial(name) {
    const uniforms = {
      uBaseColor: { value: new THREE.Color(1576487) },
      uColor1: { value: new THREE.Color(0xffffff) },
      uColor2: { value: new THREE.Color(0xffffff) },
      uLightDirection: { value: new THREE.Vector3(0.1, 1, 1).normalize() },
      ...(this.commonUniforms || {}),
    };

    switch (name) {
      case 'Eye':
        uniforms.uBaseColor.value.set(0xdfd4ee);
        break;
      case 'Eyelash':
        uniforms.uBaseColor.value.set(3875406);
        break;
      case 'Pupil_Highlight':
        uniforms.uBaseColor.value.set(0xffffff);
        break;
      default:
        break;
    }

    switch (name) {
      case 'Pupil':
        uniforms.uBaseColor.value.set(721951);
        return new THREE.ShaderMaterial({
          vertexShader: MONA3D_VERT,
          fragmentShader: MONA3D_PUPIL_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms: {
            ...uniforms,
            uOutlineTexture: { value: OUTLINE_TEXTURE },
            uOutlineColor: { value: new THREE.Color(3350645) },
          },
        });
      case 'Face':
        return new THREE.ShaderMaterial({
          vertexShader: MONA3D_VERT,
          fragmentShader: MONA3D_FACE_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms: {
            ...uniforms,
            uColor1: { value: new THREE.Color(0xffafc6) },
            uColor2: { value: new THREE.Color(0xe99e89) },
            uColor3: { value: new THREE.Color(0xe979a1) },
            uColor4: { value: new THREE.Color(0xf88580) },
          },
        });
      default:
        return new THREE.ShaderMaterial({
          vertexShader: MONA3D_VERT,
          fragmentShader: MONA3D_PART_FRAG,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms,
        });
    }
  }
}

/** 原 `class T` —— 头部随鼠标转动（左右 ±1.5rad，上下 ∓0.4rad） */
class Mona3D extends Mona3DAssembler {
  constructor() {
    super(null);
  }

  updateMouseInteraction(pos) {
    this.monaHeadGroup.rotation.y = 1.5 * pos.x;
    this.monaHeadGroup.rotation.x = -(0.4 * pos.y);
  }
}

/**
 * 原 `class A` —— 开局前看到的场景。
 * fov=10 的长焦相机 + 网格背景 + GLB Mona，
 * 鼠标靠近时头部跟着转（500px 内最强，700px 外完全不响应），出场是弹性上抛。
 */
export class OpeningScene {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(10, 1, 0.1, 100);
    this.group = new THREE.Group();
    this.desktopGrid = new Grid(LAYOUT_DESKTOP.gridX, true);
    this.narrowGrid = new Grid(LAYOUT_NARROW.gridX, true);
    this.grid = this.desktopGrid;
    this.monaGroup = new THREE.Group();
    this.mainMona = new Mona3D();
    this.openingTimeline = gsap.timeline({ paused: true });
    this.mousePos = new THREE.Vector2();
    this.mousePosTarget = new THREE.Vector2();
    this.facePosition = new THREE.Vector3();
    this.disposed = false;

    this.camera.position.z = 2;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const { mona } = LAYOUT_DESKTOP;
    this.monaGroup.position.set(mona.x, mona.y, 0);
    this.forwardRotationY = Math.atan2(
      this.camera.position.x - this.monaGroup.position.x,
      this.camera.position.z - this.monaGroup.position.z,
    );
    this.monaGroup.rotation.y = this.forwardRotationY - Math.PI;
    this.monaGroup.scale.setScalar(mona.scale);
    this.monaGroup.add(this.mainMona.group);

    this.narrowGrid.group.visible = false;
    this.group.add(this.desktopGrid.group, this.narrowGrid.group, this.monaGroup);

    this.createMona();
  }

  async createMona() {
    try {
      const gltf = await new GLTFLoader().loadAsync(ASSETS.mona3d);
      if (this.disposed) return;
      this.mainMona.create(gltf.scene);
      this.openingTimeline.fromTo(
        this.mainMona.group.position,
        { y: -2.5 },
        { y: 0, duration: 1.5, ease: 'elastic.out(1,0.5)' },
        0.3,
      );
      this.openingTimeline.to(
        this.monaGroup.rotation,
        { y: this.forwardRotationY, duration: 1, ease: 'expo.out' },
        0.3,
      );
      this.openingTimeline.play();
    } catch (error) {
      console.error('Unable to load Mona model.', error);
    }
  }

  show() {
    this.group.visible = true;
    this.openingTimeline.restart();
  }

  hide() {
    this.group.visible = false;
  }

  handleMouseMove(event, rect) {
    if (!this.group.visible) return;
    this.group.updateWorldMatrix(true, true);
    this.mainMona.monaHeadGroup.getWorldPosition(this.facePosition);
    this.facePosition.project(this.camera);

    const headX = rect.left + (this.facePosition.x + 1) * rect.width * 0.5;
    const headY = rect.top + (1 - this.facePosition.y) * rect.height * 0.5;
    const distance = Math.sqrt((headX - event.clientX) ** 2 + (headY - event.clientY) ** 2);
    const falloff = clamp(mapLinear(distance, 500, 700, 1, 0), 0, 1);
    const nx = clamp((event.clientX - headX) / rect.width, -0.5, 0.5);
    const ny = clamp((headY - event.clientY) / rect.height, -0.5, 0.5);

    this.mousePosTarget.set(nx * falloff, ny * falloff);
  }

  resize(width, height, viewportWidth) {
    if (width <= 0 || height <= 0) return;
    const layout = pickLayout(viewportWidth);
    const active = layout === LAYOUT_NARROW ? this.narrowGrid : this.desktopGrid;
    if (active !== this.grid) {
      this.grid.group.visible = false;
      this.grid = active;
      this.grid.group.visible = true;
    }
    this.monaGroup.position.set(layout.mona.x, layout.mona.y, this.monaGroup.position.z);
    this.monaGroup.scale.setScalar(layout.mona.scale);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // 按相机可视高度缩放网格，让它始终铺满
    const distance = this.camera.position.z - this.group.position.z;
    const visibleHeight =
      2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance * this.camera.aspect;
    this.grid.group.scale.set(visibleHeight, visibleHeight, 1);
  }

  update(dt) {
    if (!this.group.visible) return;
    this.grid.update(0);
    this.mousePos.lerp(this.mousePosTarget, Math.min(1, 4 * dt));
    this.mainMona.updateMouseInteraction(this.mousePos);
  }

  dispose() {
    this.disposed = true;
    this.openingTimeline.kill();
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m.dispose());
    });
  }
}
