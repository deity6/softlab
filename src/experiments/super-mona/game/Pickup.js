import * as THREE from 'three';
import gsap from 'gsap';
import { ASSETS, CELL, PALETTE } from './constants.js';
import { placeGroup } from './utils.js';

/** 已加载的 ContributionIcon 纹理（原 `eH`） */
const icons = [];
/** 纹理就绪前注册的回调（原 `eX`） */
const pending = [];
let iconsReady = false; // 原 `eD`

/** 原 `eF` */
const randomColor = () => new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);

/** 原 `w` */
const makeQuad = (w, h, color) =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(w * CELL, h * CELL),
    new THREE.MeshBasicMaterial({ color }),
  );

/**
 * 原代码在贴图加载后扫描 alpha>10 的像素边界，
 * 把图裁成以内容为中心的正方形（留 16px padding），再换算成 UV 的 offset/repeat。
 */
function cropToAlphaBounds(texture) {
  const image = texture.image;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let maxX = -1;
  let minY = canvas.height;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return;
  const size = Math.min(
    canvas.width,
    Math.max(maxX - minX + 1, maxY - minY + 1) + 16,
  );
  const centerY = (minY + maxY + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const offsetX = Math.min(Math.max(centerX - size / 2, 0), canvas.width - size);
  const offsetY = Math.min(Math.max(centerY - size / 2, 0), canvas.height - size);
  texture.offset.set(offsetX / canvas.width, 1 - (offsetY + size) / canvas.height);
  texture.repeat.set(size / canvas.width, size / canvas.height);
  texture.needsUpdate = true;
}

// 启动时预载 5 张贡献图标
Promise.all(
  ASSETS.contribution.map(
    (path) =>
      new Promise((resolve) => {
        new THREE.TextureLoader().load(path, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          cropToAlphaBounds(texture);
          resolve(texture);
        });
      }),
  ),
).then((list) => {
  icons.push(...list);
  iconsReady = true;
  pending.splice(0).forEach((fn) => fn());
});

/**
 * 原 `ez` —— 拾取物。
 * mega（金色、4×4、4 色象限）给 100 分并触发 Super；
 * 普通（3×3、每块独立随机色 + 中心贡献图标）给 50 分。
 */
export function createPickup(x, y, size, isMega) {
  const group = new THREE.Group();
  const parts = [];

  if (isMega) {
    const cell = size / 4;
    const pool = [...PALETTE];
    const quadrantColors = Array.from({ length: 4 }, () => {
      const idx = Math.floor(Math.random() * pool.length);
      return pool.splice(idx, 1)[0];
    });
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const quadrant = 2 * Math.floor(row / 2) + Math.floor(col / 2);
        const quadrantHex = quadrantColors[quadrant];
        const mesh = makeQuad(cell, cell, quadrantHex);
        const px = (-size / 2 + col * cell + cell / 2) * CELL;
        const py = (-size / 2 + row * cell + cell / 2) * CELL;
        mesh.position.set(px, py, 0);
        group.add(mesh);
        const mult = 2 + Math.floor(3 * Math.random());
        parts.push({
          mesh,
          materialColor: mesh.material.color,
          individualColor: randomColor(),
          // MEGA 的出场动画最终收敛到「该块自己的象限色」，
          // 而不是整个拾取物的统一色 —— 这样它稳定后仍是 4 象限彩色。
          targetColor: new THREE.Color(quadrantHex),
          targetPosition: { x: px, y: py },
          startOffset: {
            x: (col - 1.5) * cell * CELL * mult,
            y: (row - 1.5) * cell * CELL * mult,
          },
        });
      }
    }
  } else {
    const cell = size / 3;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const color = randomColor();
        const mesh = makeQuad(cell, cell, color);
        const px = (-size / 2 + col * cell + cell / 2) * CELL;
        const py = (-size / 2 + row * cell + cell / 2) * CELL;
        mesh.position.set(px, py, 0);
        group.add(mesh);
        const mult = 2 + Math.floor(3 * Math.random());
        const jitterX = (Math.random() - 0.5) * 2 * CELL;
        const jitterY = (Math.random() - 0.5) * 2 * CELL;
        parts.push({
          mesh,
          materialColor: mesh.material.color,
          individualColor: color,
          targetPosition: { x: px, y: py },
          startOffset: {
            x: (col - 1) * cell * CELL * mult + jitterX,
            y: (row - 1) * cell * CELL * mult + jitterY,
          },
        });
      }
    }
  }

  // 普通拾取物的中心图标层（原代码里只有非 mega 分支有）
  let iconMaterial = null;
  let iconMesh = null;
  if (!isMega) {
    iconMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    iconMesh = new THREE.Mesh(new THREE.PlaneGeometry(size * CELL, size * CELL), iconMaterial);
    iconMesh.position.set(0, 0, 0.02);
    iconMesh.renderOrder = 1;
    group.add(iconMesh);
    const iconIndex = Math.floor(Math.random() * icons.length || 0);
    const applyIcon = () => {
      iconMaterial.map = icons[iconIndex];
      iconMaterial.needsUpdate = true;
    };
    if (iconsReady) applyIcon();
    else pending.push(applyIcon);
  }

  const unified = randomColor().getHSL({ h: 0, s: 0, l: 0 });

  placeGroup(group, x, y, size, size);

  const runAppearAnimation = () => {
    const timeline = gsap.timeline();
    for (const part of parts) {
      const delay = Math.random() * parts.length * (isMega ? 0.07 : 0.06);
      const dur = 0.2 + (isMega ? 0.5 : 0.2) * Math.random();
      part.mesh.position.x = part.targetPosition.x + part.startOffset.x;
      part.mesh.position.y = part.targetPosition.y + part.startOffset.y;
      part.mesh.scale.set(0, 0, 1);

      // 目标色分两种：
      //   MEGA —— 收敛到「这一块自己的象限色」（必须先于 copy 取值）
      //   普通 —— 收敛到整个拾取物的统一色
      const goal = isMega ? part.materialColor.getHSL({ h: 0, s: 0, l: 0 }) : unified;

      part.materialColor.copy(part.individualColor);
      const hsl = part.materialColor.getHSL({ h: 0, s: 0, l: 0 });
      timeline
        .to(
          part.mesh.position,
          { x: part.targetPosition.x, y: part.targetPosition.y, duration: dur, ease: 'expo.out' },
          delay,
        )
        .to(part.mesh.scale, { x: 1, y: 1, duration: 0.5 * dur, ease: 'expo.out' }, delay)
        .to(
          hsl,
          {
            s: goal.s,
            l: goal.l,
            duration: isMega ? 0.6 : 0.4,
            ease: 'expo.out',
            onUpdate: () => part.materialColor.setHSL(hsl.h, hsl.s, hsl.l),
          },
          delay + (isMega ? 0.5 : 0),
        )
        .to(
          hsl,
          {
            h: goal.h,
            duration: isMega ? 0.6 : 0.8,
            ease: 'expo.out',
            onUpdate: () => part.materialColor.setHSL(hsl.h, hsl.s, hsl.l),
          },
          delay + (isMega ? 0.5 : 0),
        );
    }
    if (iconMaterial) timeline.to(iconMaterial, { opacity: 1, duration: 0.3, ease: 'expo.out' }, 0.6);
  };

  const runDisappearAnimation = (onComplete) => {
    const timeline = gsap.timeline({ onComplete });
    if (iconMaterial) timeline.to(iconMaterial, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0);
    for (const part of parts) {
      const delay = Math.random() * parts.length * (isMega ? 0.03 : 0.05);
      const scale = isMega ? 0.1 + 0.5 * Math.random() : 0.1 + 0.6 * Math.random();
      const peak = isMega ? 0.5 + 1.5 * Math.random() : 1.5;
      const hsl = part.materialColor.getHSL({ h: 0, s: 0, l: 0 });
      const targetHsl = part.individualColor.getHSL({ h: 0, s: 0, l: 0 });
      timeline
        .to(
          part.mesh.position,
          {
            x: part.targetPosition.x + part.startOffset.x * scale,
            y: part.targetPosition.y + part.startOffset.y * scale + (isMega ? 0.5 * CELL : 0),
            duration: isMega ? 1 : 0.5,
            ease: 'expo.out',
          },
          delay,
        )
        .to(part.mesh.scale, { x: peak, y: peak, duration: 0.2, ease: 'expo.out' }, delay)
        .to(part.mesh.scale, { x: 0, y: 0, duration: isMega ? 0.8 : 0.5, ease: 'expo.out' }, delay + 0.2)
        .to(
          hsl,
          {
            s: targetHsl.s,
            l: targetHsl.l,
            duration: 0.1,
            ease: 'expo.out',
            onUpdate: () => part.materialColor.setHSL(hsl.h, hsl.s, hsl.l),
          },
          delay,
        )
        .to(
          hsl,
          {
            h: targetHsl.h,
            duration: isMega ? 1 : 0.1,
            ease: 'expo.out',
            onUpdate: () => part.materialColor.setHSL(hsl.h, hsl.s, hsl.l),
          },
          delay,
        );
    }
  };

  return {
    x,
    y,
    width: size,
    height: size,
    mega: isMega,
    mesh: group,
    runAppearAnimation,
    runDisappearAnimation,
  };
}
