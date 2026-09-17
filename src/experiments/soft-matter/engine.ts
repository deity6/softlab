/**
 * Soft-matter engine.
 *
 * Ported from Luffyzhang2016/soft-matter (github.com/Luffyzhang2016/soft-matter):
 * the rigid-body motion, the deformable shell, the shape generators and the
 * HDRI refraction shader are the reference implementation's own, with the DOM
 * bindings lifted out so a React panel can drive them.
 *
 * Layout of the model, for whoever reads this next:
 *   - `SoftBodyMotion` (vendor/physics.js) carries translation, rotation,
 *     inertia, grab torque and ground impulses.
 *   - The vertex loop in `step()` IS the soft body: every vertex is a
 *     spring-damper back to its rest position, and a grab displaces a
 *     Gaussian-weighted neighbourhood of the grab point. That is what makes a
 *     press dent the surface instead of sliding the whole blob around.
 */
import * as THREE from 'three';
import { onThemeChange } from '../../lib/theme';
import { SoftBodyMotion } from './vendor/physics';
import { makeShape } from './vendor/shapes';
import type { ShapeDecal } from './vendor/shapes';
import { HDRLoader } from './vendor/HDRLoader';

export type EngineShape = 'ghost' | 'watermelon' | 'bear' | 'star' | 'orb' | 'cube';

export interface EngineParams {
  elasticity: number; // 10..100
  damping: number; // 5..95
  glass: number; // 0..100
  angle: number; // -180..180
}

export interface EngineInit {
  shape: EngineShape;
  color: string;
  /** second gradient stop; omit for a flat colour */
  colorTo?: string;
  params: EngineParams;
}

export interface EngineHandle {
  setShape(name: EngineShape): void;
  /**
   * One stop paints a flat colour; two paint a vertical gradient through the
   * gel. The four reference presets use one, the vault palettes use two.
   */
  setColor(from: string, to?: string): void;
  setParams(params: EngineParams): void;
  /** release from the air above the stage */
  drop(): void;
  reset(): void;
  setPaused(paused: boolean): void;
  /** 1 = real time, below 1 = slow motion */
  setTimeScale(scale: number): void;
  dispose(): void;
}

/**
 * The scene's paper tone, read from the cascade rather than hard-coded.
 *
 * The three.js scene paints its own background and its own fog, so under a
 * dark theme a hard-coded #f5f7fa left a large pale rectangle sitting in the
 * middle of a dark page (measured: 58% of the viewport brighter than 200).
 * A transmissive body is also lit *by* its surroundings, so this is not only
 * a background problem — the jelly picked up the pale fog colour too.
 */
function readPaper(): number {
  if (typeof document === 'undefined') return 0xf5f7fa;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return (
      (parseInt(hex[1].slice(0, 2), 16) << 16) |
      (parseInt(hex[1].slice(2, 4), 16) << 8) |
      parseInt(hex[1].slice(4, 6), 16)
    );
  }
  return 0xf5f7fa;
}

export function createEngine(container: HTMLElement, init: EngineInit): EngineHandle {
  // ---------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const PAPER = readPaper();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 18, 45);

  /* Re-read on a theme change. Without this the page turns dark and the
     canvas keeps its daytime sky until reload. */
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const retheme = () => {
    // `readPaper` reads `--paper` off the cascade, so this already follows an
    // explicit switch — the media query listener is only the trigger for the
    // OS changing its mind.
    const paper = readPaper();
    // `background` is typed as Color | Texture; we only ever assign a Color,
    // so the check also guards against someone swapping in a texture later.
    if (scene.background instanceof THREE.Color) scene.background.set(paper);
    (scene.fog as THREE.Fog | null)?.color.set(paper);
  };
  darkMq.addEventListener('change', retheme);
  // Pressing sun/moon does not fire the media query; without this the scene
  // keeps the palette it booted with.
  const offTheme = onThemeChange(retheme);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x727561, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-3, 7, 4);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0xe9edf3, roughness: 0.95, envMapIntensity: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // --------------------------------------------------------------- material
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.012,
    transmission: 1,
    thickness: 0.85,
    ior: 1.45,
    clearcoat: 0.35,
    clearcoatRoughness: 0.015,
    attenuationColor: new THREE.Color(init.color),
    attenuationDistance: 1.2,
    envMapIntensity: 1.1,
  });

  const settings: EngineParams = { ...init.params };
  const hdriAngle = { value: 0 };
  /** 0 = none, 1 = watermelon, 2 = ghost, 3 = bear — picks the shader branch */
  const fruitMode = { value: 2 };
  /**
   * Gradient paint. The two stops are mixed along the body's own Y axis inside
   * the transmission shader, so the colour reads as a property of the gel
   * rather than a light hitting it. That is what makes the vault's two-tone
   * palettes work here at all — a flat single colour just reads as tinted
   * plastic next to them.
   */
  const paintA = { value: new THREE.Color(init.color) };
  const paintB = { value: new THREE.Color(init.color) };
  const paintMin = { value: 0 };
  const paintRange = { value: 1 };
  const pmrem = new THREE.PMREMGenerator(renderer);

  function applyEnvironment(hdr: THREE.Texture): void {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.studioHDR = { value: hdr };
      shader.uniforms.hdriAngle = hdriAngle;
      shader.uniforms.watermelon = fruitMode;
      shader.uniforms.paintA = paintA;
      shader.uniforms.paintB = paintB;
      shader.uniforms.paintMin = paintMin;
      shader.uniforms.paintRange = paintRange;
      shader.vertexShader =
        'attribute vec3 fruitRest;\nvarying vec3 vFruit;\nuniform float paintMin;\nuniform float paintRange;\nvarying float vPaintT;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvFruit=fruitRest;\nvPaintT=clamp((fruitRest.y-paintMin)/paintRange,0.,1.);',
      );
      shader.fragmentShader =
        'uniform sampler2D studioHDR;\nuniform float hdriAngle;\nuniform float watermelon;\nuniform vec3 paintA;\nuniform vec3 paintB;\nvarying vec3 vFruit;\nvarying float vPaintT;\n' +
        shader.fragmentShader;
      const transmission = THREE.ShaderChunk.transmission_fragment
        .replace(
          'material.attenuationColor = attenuationColor;',
          `
      material.attenuationColor = mix(paintA, paintB, vPaintT);
      if(watermelon>.5 && watermelon<1.5){
        float h=vFruit.y-.19*pow(vFruit.x/1.7,2.);
        float bands=vFruit.x*5.8+sin(vFruit.z*3.2+vFruit.y*2.1)*1.15+sin(vFruit.x*12.+vFruit.z*7.)*.17;
        float stripe=.5+.5*sin(bands);
        vec3 rind=mix(vec3(.006,.095,.012),vec3(.21,.59,.025),smoothstep(.32,.62,stripe));
        vec3 flesh=mix(vec3(.96,.9,.012),attenuationColor,smoothstep(.66,1.63,h));
        material.attenuationColor=mix(rind,flesh,smoothstep(.46,.55,h));
        material.transmission*=mix(.52,1.,smoothstep(.46,.55,h));
        material.attenuationDistance=mix(.45,1.5,smoothstep(.46,.55,h));
        totalDiffuse=mix(rind*.42,totalDiffuse,smoothstep(.46,.55,h));
      }
      if(watermelon>1.5 && watermelon<2.5){
        float face=1.-smoothstep(.78,1.,length((vFruit.xy-vec2(0.,1.3))/vec2(.98,1.05)));
        material.attenuationColor=mix(vec3(.18,.9,.002),vec3(.015,.32,.002),face);
        material.attenuationDistance=.95;
        material.transmission*=1.;
      }
      if(watermelon>2.5){
        material.attenuationDistance=1.5;
      }
    `,
        )
        .replace(
          'totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );',
          `
      vec3 through = refract(-v, n, 1.0 / material.ior);
      through.xz = mat2(cos(hdriAngle),-sin(hdriAngle),sin(hdriAngle),cos(hdriAngle)) * through.xz;
      vec2 studioUV = vec2(atan(through.z,through.x)*RECIPROCAL_PI2+.5,asin(clamp(through.y,-1.0,1.0))*RECIPROCAL_PI+.5);
      vec3 room = texture2D(studioHDR,studioUV).rgb;
      vec3 tint = pow(material.attenuationColor,vec3(material.thickness/material.attenuationDistance));
      vec3 volume = mix(transmitted.rgb,room*tint,.58);
      totalDiffuse = mix(totalDiffuse,volume,material.transmission);
    `,
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <transmission_fragment>',
        transmission,
      );
    };
    material.needsUpdate = true;
  }

  // A local studio keeps reflections and fruit shading alive before the HDRI
  // lands — and forever if it never does.
  const studioPixels = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const isWindow =
        (x > 7 && x < 20 && y > 7 && y < 21 && x !== 13 && y !== 14) ||
        (x > 39 && x < 44 && y > 5 && y < 23);
      const value = isWindow ? 255 : y < 16 ? 105 : 65;
      const n = (y * 64 + x) * 4;
      studioPixels[n] = studioPixels[n + 1] = studioPixels[n + 2] = value;
      studioPixels[n + 3] = 255;
    }
  }
  const studioFallback = new THREE.DataTexture(studioPixels, 64, 32);
  studioFallback.needsUpdate = true;
  applyEnvironment(studioFallback);

  let hdrTexture: THREE.Texture | null = null;
  new HDRLoader().load(
    `${import.meta.env.BASE_URL}studio.hdr`,
    (hdr) => {
      hdrTexture = hdr;
      applyEnvironment(hdr);
    },
    undefined,
    () => {
      /* keep the procedural studio */
    },
  );

  // ------------------------------- contact shadow + transmitted light patch
  // Real-time approximation, not ray-traced caustics.
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tint: { value: new THREE.Color(init.color) },
      height: { value: 0 },
      glass: { value: 1 },
    },
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
  varying vec2 vUv;uniform vec3 tint;uniform float height;uniform float glass;
  void main(){vec2 q=(vUv-.5)*2.;float r=length(q);float contact=exp(-r*r*4.5);float rim=exp(-pow((r-.58)*6.,2.));float strength=exp(-height*.7);vec3 c=mix(vec3(.17,.18,.14),tint,.35*glass);gl_FragColor=vec4(c,(contact*(.21-.14*glass)+rim*.09*glass)*strength);}
`,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  scene.add(shadow);

  const causticMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      tint: shadowMaterial.uniforms.tint,
      height: shadowMaterial.uniforms.height,
      glass: shadowMaterial.uniforms.glass,
    },
    vertexShader: shadowMaterial.vertexShader,
    fragmentShader: `
 varying vec2 vUv;uniform vec3 tint;uniform float height;uniform float glass;
 void main(){vec2 q=(vUv-.5)*2.;float r=length(q*vec2(1.,1.2));float ring=exp(-pow((r-.53)*12.,2.));float core=exp(-dot(q,q)*10.);float a=(ring*.025+core*.16)*exp(-height*.9)*glass;gl_FragColor=vec4(mix(tint,vec3(1.),.38),a);}
`,
  });
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), causticMaterial);
  caustic.rotation.x = -Math.PI / 2;
  caustic.position.y = 0.018;
  scene.add(caustic);

  // ------------------------------------------------------------------ jelly
  const body = new SoftBodyMotion();
  const jelly = new THREE.Mesh(new THREE.BufferGeometry(), material);
  scene.add(jelly);

  let geometry: THREE.BufferGeometry;
  let positions: THREE.BufferAttribute;
  let rest: Float32Array;
  let localVelocity: Float32Array;
  let seams: number[][] = [];
  let details: { mesh: THREE.Mesh; point: THREE.Vector3; closest: number }[] = [];
  let shapeWidth = 3;
  let shapeDepth = 2;

  // ------------------------------------------------ contact-driven bounce
  /**
   * The reference implementation compresses the whole body about its centre on
   * impact, so every landing reads the same regardless of how the thing was
   * oriented — you only get a different camera angle, not a different bounce.
   *
   * Instead, each landing drops a few *contact impacts*: localised dents with a
   * raised rim, anchored at the vertices that actually touched down and fading
   * over about a third of a second. Land on a corner and you get one deep dent;
   * land flat and you get a spread of shallow ones; land on an edge and it
   * creases along the contact line. The global squash is kept, but reduced to a
   * supporting role so the impact shape is what you read.
   */
  interface Impact {
    /** contact point, in local space */
    local: THREE.Vector3;
    /** unit vector from the contact towards the body centre */
    inward: THREE.Vector3;
    strength: number;
    /** 1 → 0 over IMPACT_LIFE */
    life: number;
  }
  const IMPACT_RADIUS = 0.6;
  const IMPACT_R2 = IMPACT_RADIUS * IMPACT_RADIUS;
  /** Short and sharp: a contact mark, not a dent that lingers and eats the bounce. */
  const IMPACT_LIFE = 0.2;
  const MAX_IMPACTS = 5;
  /**
   * Ceiling on the combined dent depth. Without it, several overlapping
   * contacts on one landing add up, flatten the body into the floor and the
   * whole thing reads as "stuck to the ground" instead of bouncing off it.
   */
  const MAX_SINK = 0.18;
  /** Contacts closer than this just deepen the dent that is already there. */
  const IMPACT_MIN_GAP2 = 0.16;
  /**
   * How much of the centre-led squash to keep. This stays at full strength:
   * scaling it down was a mistake — the squash *is* the bounce to the eye, and
   * the contact impacts only add direction on top of it.
   */
  const SQUASH_MIX = 1;
  /** Below this landing speed nothing deserves a dent. */
  const IMPACT_MIN_SPEED = 0.75;
  const IMPACT_STRENGTH_PER_SPEED = 0.07;
  const IMPACT_STRENGTH_MAX = 0.2;

  let impacts: Impact[] = [];
  let contactMask = new Uint8Array(0);
  const impactScratch = new THREE.Vector3();

  const p = new THREE.Vector3();
  const sum = new THREE.Vector3();
  const displacement = new THREE.Vector3();

  /**
   * One material per decal role, so a shape can ask for "an eye" or "a grain of
   * sugar" instead of an array index. Roles are shared across shapes: the
   * bear's eyes and the ghost's eyes are literally the same material.
   */
  const DECO_MATERIALS: Record<NonNullable<ShapeDecal['mat']>, THREE.Material> = {
    eye: new THREE.MeshPhysicalMaterial({
      color: '#2b1d24',
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    ink: new THREE.MeshPhysicalMaterial({ color: '#39252e', roughness: 0.12, metalness: 0, clearcoat: 1 }),
    seed: new THREE.MeshPhysicalMaterial({ color: '#33201a', roughness: 0.18, metalness: 0, clearcoat: 0.85 }),
    nose: new THREE.MeshPhysicalMaterial({ color: '#6b4238', roughness: 0.22, metalness: 0, clearcoat: 0.8 }),
    belly: new THREE.MeshPhysicalMaterial({ color: '#fdf1e2', roughness: 0.42, metalness: 0, clearcoat: 0.4 }),
    blush: new THREE.MeshBasicMaterial({ color: '#f2b84b' }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    frost: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.7,
      // A touch of self-illumination so the grains stay white inside a dark
      // gel instead of picking up the body colour and disappearing.
      emissive: new THREE.Color('#e4ecf4'),
      emissiveIntensity: 0.55,
    }),
  };

  function loadShape(name: EngineShape): void {
    release();
    body.reset();
    geometry?.dispose();
    for (const d of details) {
      scene.remove(d.mesh);
      d.mesh.geometry.dispose();
    }
    details = [];

    const made = makeShape(name);
    geometry = made.geometry;
    jelly.geometry = geometry;
    positions = geometry.attributes.position as THREE.BufferAttribute;
    rest = (positions.array as Float32Array).slice();
    body.setShape(rest);
    localVelocity = new Float32Array(rest.length);
    impacts = [];
    contactMask = new Uint8Array(positions.count);
    geometry.setAttribute('fruitRest', new THREE.BufferAttribute(rest.slice(), 3));
    fruitMode.value = name === 'watermelon' ? 1 : name === 'ghost' ? 2 : name === 'bear' ? 3 : 0;

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    shapeWidth = size.x;
    shapeDepth = size.z;
    // The gradient runs bottom-to-top through the body's own rest bounds, so a
    // palette reads the same on a thin star and on a tall bear.
    paintMin.value = box.min.y;
    paintRange.value = Math.max(1e-4, box.max.y - box.min.y);

    // Vertices that coincide after the merge need one averaged normal, or the
    // UV seam shows up as a hard crease when the shell deforms.
    const coincident = new Map<string, number[]>();
    for (let i = 0; i < positions.count; i++) {
      const key = [rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]]
        .map((v) => Math.round(v * 10000))
        .join(',');
      if (!coincident.has(key)) coincident.set(key, []);
      coincident.get(key)!.push(i);
    }
    seams = [...coincident.values()].filter((g) => g.length > 1);

    for (const decal of made.face) {
      const { x, y, z, r } = decal;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 18, 12),
        DECO_MATERIALS[decal.mat ?? 'ink'],
      );
      mesh.scale.set(decal.sx ?? 1, decal.sy ?? 1, decal.sz ?? 0.55);
      if (decal.tilt) mesh.geometry.rotateZ(decal.tilt);
      scene.add(mesh);
      let closest = 0;
      let best = Infinity;
      for (let i = 0; i < positions.count; i++) {
        const dist = (rest[i * 3] - x) ** 2 + (rest[i * 3 + 1] - y) ** 2 + (rest[i * 3 + 2] - z) ** 2;
        if (dist < best) {
          best = dist;
          closest = i;
        }
      }
      details.push({ mesh, point: new THREE.Vector3(x, y, z), closest });
    }

    // Optical character per shape: only the glass ball is polished crystal.
    // Iridescence changes which shader permutation three compiles, so only
    // touch `needsUpdate` when the flag actually flips.
    const wantsPolish = name === 'orb';
    if (wantsPolish !== polished) {
      polished = wantsPolish;
      material.iridescence = wantsPolish ? 0.9 : 0;
      material.iridescenceIOR = 1.35;
      material.iridescenceThicknessRange = [150, 650];
      material.clearcoat = wantsPolish ? 1 : 0.35;
      material.needsUpdate = true;
    }
    // A ball has the shortest optical path of any preset, so it needs the
    // shortest attenuation distance to show any colour at all. Ghost and
    // watermelon override this again inside their own shader branches.
    material.attenuationDistance = wantsPolish ? 0.5 : 0.7;

    updateNormals();
    // The contact shadow borrows the body's mid-tone unless the gel is lime,
    // in which case it stays green the way the reference project has it.
    shadowMaterial.uniforms.tint.value.copy(paintA.value).lerp(paintB.value, 0.5);
    if (name === 'ghost') shadowMaterial.uniforms.tint.value.set('#83df1e');
    updateMaterial();
    resize();
    paused = false;
  }

  function updateNormals(): void {
    geometry.computeVertexNormals();
    const normal = geometry.attributes.normal as THREE.BufferAttribute;
    for (const group of seams) {
      sum.set(0, 0, 0);
      for (const i of group) sum.add(p.fromBufferAttribute(normal, i));
      sum.normalize();
      for (const i of group) normal.setXYZ(i, sum.x, sum.y, sum.z);
    }
    normal.needsUpdate = true;
  }

  // ---------------------------------------------------------------- pointer
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const target = new THREE.Vector3();
  const grabLocal = new THREE.Vector3();
  const cursor = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff704d }),
  );
  cursor.visible = false;
  scene.add(cursor);

  let dragging = false;
  let paused = false;
  let selected = 0;
  let activePointer: number | null = null;

  function aim(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
  }

  function onPointerDown(e: PointerEvent): void {
    aim(e);
    const hits = ray.intersectObject(jelly);
    if (!hits.length) return;
    paused = false;
    dragging = true;
    activePointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    target.copy(hits[0].point);
    grabLocal.copy(target);
    jelly.worldToLocal(grabLocal);
    let nearest = Infinity;
    for (let i = 0; i < positions.count; i++) {
      const d = p.fromBufferAttribute(positions, i).distanceToSquared(grabLocal);
      if (d < nearest) {
        nearest = d;
        selected = i;
      }
    }
    grabLocal.fromArray(rest, selected * 3);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), target);
    cursor.visible = true;
    cursor.position.copy(target);
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    aim(e);
    if (dragging) {
      if (ray.ray.intersectPlane(plane, hit)) {
        target.copy(hit);
        target.x = THREE.MathUtils.clamp(target.x, -4, 4);
        target.y = THREE.MathUtils.clamp(target.y, 0.1, 5);
        target.z = THREE.MathUtils.clamp(target.z, -2, 3);
        cursor.position.copy(target);
      }
    } else {
      canvas.style.cursor = ray.intersectObject(jelly).length ? 'grab' : 'default';
    }
  }

  function release(): void {
    dragging = false;
    cursor.visible = false;
    canvas.style.cursor = 'default';
    if (activePointer !== null && canvas.hasPointerCapture(activePointer)) {
      canvas.releasePointerCapture(activePointer);
    }
    activePointer = null;
  }

  function onPointerUp(): void {
    release();
  }

  function drop(): void {
    release();
    paused = false;
    body.drop(2.1);
    (positions.array as Float32Array).set(rest);
    localVelocity.fill(0);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onPointerUp);
  canvas.addEventListener('dblclick', drop);
  window.addEventListener('blur', onPointerUp);

  // ------------------------------------------------------------- materials
  /** The glass ball is polished crystal; every other preset is gummy. */
  let polished = false;

  function updateMaterial(): void {
    material.transmission = settings.glass / 100;
    material.roughness = (polished ? 0.006 : 0.012) + (1 - material.transmission) * 0.2;
    material.color
      .copy(paintA.value)
      .lerp(paintB.value, 0.5)
      .lerp(new THREE.Color(0xffffff), material.transmission);
    shadowMaterial.uniforms.glass.value = material.transmission;
    hdriAngle.value = (settings.angle * Math.PI) / 180;
    scene.environmentRotation.y = hdriAngle.value;
  }

  /**
   * `to` is optional — a palette with a single stop stays a flat colour, which
   * is how the reference project's own four presets behave.
   */
  function applyColor(from: string, to?: string): void {
    paintA.value.set(from);
    paintB.value.set(to ?? from);
    shadowMaterial.uniforms.tint.value.copy(paintA.value).lerp(paintB.value, 0.5);
    if (fruitMode.value === 2) shadowMaterial.uniforms.tint.value.set('#83df1e');
    updateMaterial();
  }

  // ---------------------------------------------------------------- resize
  function resize(): void {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const mobile = w < 600;
    const distance = mobile ? 14.5 : 12.5;
    renderer.toneMappingExposure = mobile ? 1.05 : 0.95;
    sun.intensity = mobile ? 1.7 : 2;
    material.thickness = mobile ? 0.65 : 0.85;
    material.envMapIntensity = mobile ? 1.2 : 1.1;
    camera.position.set(0, 1.15 + distance * Math.tan((18 * Math.PI) / 180), distance);
    camera.lookAt(0, mobile ? 0.72 : 1.15, 0);
    camera.clearViewOffset();
    if (w >= 600 && w < 1000) camera.setViewOffset(w, h, w * 0.065, 0, w, h);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ------------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let accumulated = 0;
  let raf = 0;
  let timeScale = 1;
  /** Physics substeps executed — the honest measure of how fast time runs. */
  let simSteps = 0;

  const diag = { frames: 0, simSteps: 0, errors: 0, lastError: '', height: 0, vertices: 0 };
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__labDiag = diag;
    (window as unknown as Record<string, unknown>).__labDebug = {
      vertices: () => positions.count,
      triangles: () => (geometry.index ? geometry.index.count / 3 : 0),
      drop,
      bodyPosition: () => body.position.slice(),
      /** sum of |vertex| — a stable number means the shell has gone quiet */
      vertexSum: () => {
        const a = positions.array as Float32Array;
        let s = 0;
        for (let i = 0; i < a.length; i++) s += Math.abs(a[i]);
        return s;
      },
      angularSpeed: () => {
        const w = body.angularVelocity;
        return Math.hypot(w.x, w.y, w.z);
      },
      /**
       * How much the shell is deformed, and how concentrated that deformation
       * is. A flat landing spreads it around (ratio near 1); a corner landing
       * piles it into one place (ratio well above 1). This is the number that
       * tells us the bounce actually depends on orientation.
       */
      deformStats: () => {
        const a = positions.array as Float32Array;
        let max = 0;
        let sum = 0;
        for (let i = 0; i < positions.count; i++) {
          const n = i * 3;
          const d = Math.hypot(a[n] - rest[n], a[n + 1] - rest[n + 1], a[n + 2] - rest[n + 2]);
          if (d > max) max = d;
          sum += d;
        }
        const mean = sum / positions.count || 1e-9;
        return { max, mean, ratio: max / mean, live: impacts.length };
      },
      /** Drop from the air already tilted — lets a test pick the landing pose. */
      dropTilted: (tilt: number) => {
        release();
        paused = false;
        body.drop(2.1);
        body.rotation.setFromAxisAngle(
          new THREE.Vector3(1, 0.35, 0.5).normalize(),
          tilt,
        );
        (positions.array as Float32Array).set(rest);
        localVelocity.fill(0);
        impacts = [];
        contactMask.fill(0);
      },
      /**: world point -> viewport CSS pixels, for driving pointer events */
      screenOf: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const r = canvas.getBoundingClientRect();
        return {
          px: r.left + (v.x * 0.5 + 0.5) * r.width,
          py: r.top + (-v.y * 0.5 + 0.5) * r.height,
          ndc: [v.x, v.y, v.z],
          rect: [r.left, r.top, r.width, r.height],
          cam: camera.position.toArray(),
          aspect: camera.aspect,
        };
      },
    };
  }

  function step(dt: number): void {
    const desired = dragging ? { target: target.toArray(), local: grabLocal.toArray() } : null;
    body.step(dt, { ...settings, grab: desired });

    const spring = 65 + settings.elasticity * 1.4;
    const dragDamping = 5 + settings.damping * 0.16;
    // The centre-led squash takes a supporting role now; the contact impacts
    // carry the read, so a corner landing and a flat landing look different.
    const scaleY = 1 - body.squash * SQUASH_MIX;
    const scaleXZ = 1 / Math.sqrt(Math.max(scaleY, 0.2));

    if (dragging) {
      displacement
        .copy(target)
        .sub(new THREE.Vector3().fromArray(body.position))
        .sub(body.center)
        .applyQuaternion(body.rotation.clone().invert())
        .add(body.center)
        .sub(grabLocal);
    } else {
      displacement.set(0, 0, 0);
    }

    // Age the dents — a landing is over in about a third of a second.
    for (let k = impacts.length - 1; k >= 0; k--) {
      impacts[k].life -= dt / IMPACT_LIFE;
      if (impacts[k].life <= 0) impacts.splice(k, 1);
    }

    const falling = -body.velocity[1];
    const a = positions.array as Float32Array;
    const bcx = body.center.x;
    const bcy = body.center.y;
    const bcz = body.center.z;

    for (let i = 0; i < positions.count; i++) {
      const n = i * 3;
      const dist =
        (rest[n] - grabLocal.x) ** 2 +
        (rest[n + 1] - grabLocal.y) ** 2 +
        (rest[n + 2] - grabLocal.z) ** 2;
      const influence = dragging ? Math.exp(-dist / 0.7) : 0;

      // Sum the local dents. Each one presses the contact patch inwards and
      // pushes a rim of material outward around it, which is what makes a soft
      // body look like it *splashed* rather than shrank.
      let sinkX = 0;
      let sinkY = 0;
      let sinkZ = 0;
      if (impacts.length) {
        const rx = rest[n];
        const ry = rest[n + 1];
        const rz = rest[n + 2];
        for (const im of impacts) {
          const ex = rx - im.local.x;
          const ey = ry - im.local.y;
          const ez = rz - im.local.z;
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 > IMPACT_R2) continue;
          const t = Math.sqrt(d2) / IMPACT_RADIUS;
          const dent = Math.exp(-t * t * 3.4);
          const rim = Math.exp(-((t - 0.8) ** 2) * 16) * 0.4;
          const amount = (rim - dent) * im.strength * im.life;
          sinkX += im.inward.x * amount;
          sinkY += im.inward.y * amount;
          sinkZ += im.inward.z * amount;
        }
        const sinkLen = Math.hypot(sinkX, sinkY, sinkZ);
        if (sinkLen > MAX_SINK) {
          const k = MAX_SINK / sinkLen;
          sinkX *= k;
          sinkY *= k;
          sinkZ *= k;
        }
      }

      for (let c = 0; c < 3; c++) {
        const j = n + c;
        const want =
          rest[j] * (c === 1 ? scaleY : scaleXZ) +
          displacement.getComponent(c) * influence +
          (c === 0 ? sinkX : c === 1 ? sinkY : sinkZ);
        localVelocity[j] += ((want - a[j]) * spring - localVelocity[j] * dragDamping) * dt;
        a[j] += localVelocity[j] * dt;
      }

      // Ground contact, and impact spawning on the substep of first touch.
      p.fromArray(a, n).sub(body.center).applyQuaternion(body.rotation).add(body.center);
      const worldY = p.y + body.position[1];
      if (worldY < 0.02) {
        sum.set(0, 0.02 - worldY, 0).applyQuaternion(body.rotation.clone().invert());
        a[n] += sum.x;
        a[n + 1] += sum.y;
        a[n + 2] += sum.z;
        localVelocity[n] *= 0.6;
        localVelocity[n + 1] *= 0.6;
        localVelocity[n + 2] *= 0.6;

        if (!contactMask[i]) {
          contactMask[i] = 1;
          // Only a real landing deserves a dent — not the endless micro
          // contacts of a body that is just sitting still.
          if (falling > IMPACT_MIN_SPEED && impacts.length < MAX_IMPACTS) {
            const lx = rest[n];
            const ly = rest[n + 1];
            const lz = rest[n + 2];
            // Every vertex of one contact patch reports at once. Let the first
            // one own the dent instead of stacking five on the same spot —
            // that stacking is what flattens the body onto the floor.
            let crowded = false;
            for (const im of impacts) {
              const dx = im.local.x - lx;
              const dy = im.local.y - ly;
              const dz = im.local.z - lz;
              if (dx * dx + dy * dy + dz * dz < IMPACT_MIN_GAP2) {
                crowded = true;
                break;
              }
            }
            if (!crowded) {
              impactScratch.set(bcx - lx, bcy - ly, bcz - lz);
              const len = impactScratch.length() || 1;
              impactScratch.divideScalar(len);
              impacts.push({
                local: new THREE.Vector3(lx, ly, lz),
                inward: impactScratch.clone(),
                strength: Math.min(falling * IMPACT_STRENGTH_PER_SPEED, IMPACT_STRENGTH_MAX),
                life: 1,
              });
            }
          }
        }
      } else if (contactMask[i]) {
        contactMask[i] = 0;
      }
    }
  }

  function animate(): void {
    raf = requestAnimationFrame(animate);
    try {
      // Slow motion works by feeding the accumulator less time per frame, so
      // the fixed 120 Hz solver simply takes fewer steps — the physics itself
      // is untouched, it just unfolds slower.
      accumulated += Math.min(clock.getDelta(), 0.05) * timeScale;
      if (!paused) {
        while (accumulated >= 1 / 120) {
          step(1 / 120);
          accumulated -= 1 / 120;
          simSteps++;
        }
        positions.needsUpdate = true;
        updateNormals();
      } else {
        accumulated = 0;
      }

      jelly.quaternion.copy(body.rotation);
      jelly.position
        .fromArray(body.position)
        .add(body.center)
        .sub(p.copy(body.center).applyQuaternion(body.rotation));
      jelly.updateMatrixWorld(true);

      // Decals ride the nearest vertex's displacement, then the rigid transform.
      for (const d of details) {
        const n = d.closest * 3;
        d.mesh.position.copy(d.point);
        d.mesh.position.x += (positions.array as Float32Array)[n] - rest[n];
        d.mesh.position.y += (positions.array as Float32Array)[n + 1] - rest[n + 1];
        d.mesh.position.z += (positions.array as Float32Array)[n + 2] - rest[n + 2];
        jelly.localToWorld(d.mesh.position);
        d.mesh.quaternion.copy(body.rotation);
      }

      const height = body.lowest;
      const spread = 1 + height * 0.15;
      shadowMaterial.uniforms.height.value = height;
      shadow.position.set(body.position[0] + height * 0.22, 0.012, body.position[2] - 0.1);
      shadow.scale.set(shapeWidth * 1.35 * spread, shapeDepth * 1.8 * spread, 1);
      caustic.position.set(body.position[0] + 0.35 + height * 0.15, 0.018, body.position[2] - 0.3);
      caustic.scale.set(shapeWidth * 1.15, shapeDepth * 1.4, 1);

      if (import.meta.env.DEV) {
        diag.frames++;
        diag.simSteps = simSteps;
        diag.height = height;
        diag.vertices = positions.count;
      }

      renderer.render(scene, camera);
    } catch (err) {
      if (import.meta.env.DEV) {
        diag.errors++;
        diag.lastError = String(err);
      }
      console.error('[softlab] frame threw', err);
    }
  }
  // Load the first shape *before* starting the loop: the animation frame would
  // otherwise run once with `positions` still undefined and throw.
  loadShape(init.shape);
  applyColor(init.color, init.colorTo);
  animate();

  // ----------------------------------------------------------------- handle
  return {
    setShape(name: EngineShape) {
      loadShape(name);
    },
    setColor(from: string, to?: string) {
      applyColor(from, to);
    },
    setParams(next: EngineParams) {
      Object.assign(settings, next);
      updateMaterial();
    },
    drop,
    reset() {
      release();
      body.reset();
      (positions.array as Float32Array).set(rest);
      localVelocity.fill(0);
      paused = false;
    },
    setPaused(value: boolean) {
      paused = value;
      clock.getDelta();
    },
    setTimeScale(scale: number) {
      timeScale = Math.max(0.05, Math.min(2, scale));
      clock.getDelta();
    },
    dispose() {
      cancelAnimationFrame(raf);
      offTheme();
      darkMq.removeEventListener('change', retheme);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onPointerUp);
      canvas.removeEventListener('dblclick', drop);
      window.removeEventListener('blur', onPointerUp);
      geometry?.dispose();
      for (const d of details) {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
      }
      details = [];
      for (const deco of Object.values(DECO_MATERIALS)) deco.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      shadow.geometry.dispose();
      shadowMaterial.dispose();
      caustic.geometry.dispose();
      causticMaterial.dispose();
      cursor.geometry.dispose();
      (cursor.material as THREE.Material).dispose();
      material.dispose();
      studioFallback.dispose();
      hdrTexture?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
