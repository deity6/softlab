/**
 * 全部 GLSL 逐字取自原站 chunk（原变量名 O / C / _ / I / E / G / L，
 * 另有网格线、方块、虫子精灵表、Mona 精灵、残影、转场等内联 shader）。
 * 注释里标注了它属于哪个材质的哪一部分。
 */

/** Mona 3D 形态的顶点着色器（原 `O`） */
export const MONA3D_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vNormal2;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main(){
  vUv = uv;
  vNormal = normal;
  vNormal2 = normalize(normalMatrix * normal);
  vPosition = position;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 screenPos = projectionMatrix * viewMatrix * worldPos;
  vWorldPosition = worldPos.xyz;

  gl_Position = screenPos;
}
`;

/** 3D simplex noise（Adam Stark 版，原 `C`） */
const NOISE_3D = /* glsl */ `
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

vec4 permute(vec4 x){return mod(x*x*34.0+x,289.);}
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2  C = vec2(0.166666667, 0.33333333333) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i,289.);
  vec4 p = permute( permute( permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = floor(j - 7.0 * x_ ) *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m * m;
  return 42.0 * dot( m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );
}
`;

/** hsv 工具（原 `_`） */
const HSV = /* glsl */ `
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

/** 2D simplex noise（Ashima Arts / Stefan Gustavson，原 `E`） */
const NOISE_2D = /* glsl */ `
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+10.0)*x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/** 默认部件片元着色器（原 `I`）—— 纯底色 + gamma 校正 */
export const MONA3D_PART_FRAG = /* glsl */ `${NOISE_3D + HSV}
uniform vec3 uBaseColor;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uLightDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vNormal2;
varying vec3 vPosition;

float getFresnel(vec3 normal, float power) {
  vec3 viewDir = vec3(0.0, -0.5, 1.0);
  return 1.0 - pow(max(dot(viewDir, normal), 0.0), power);
}

void main(){
  vec3 color = vNormal2 * 0.5 + 0.5;
  color = uBaseColor;

  color = pow(color, vec3(1.0/2.2));
  gl_FragColor = vec4(color, 1.0);
}
`;

/** 瞳孔片元着色器（原 `G`）—— 噪点 + 描边贴图 + 双层高光 */
export const MONA3D_PUPIL_FRAG = /* glsl */ `${NOISE_2D}
  uniform sampler2D uOutlineTexture;

  uniform vec3 uBaseColor;
  uniform vec3 uOutlineColor;
  varying vec2 vUv;
  varying vec3 vNormal2;

  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

    float n = snoise(uv * 1.5 + vec2(0.0, -0.5)) * 0.5 + 0.5;
    float outline = texture2D(uOutlineTexture, uv).r;
    vec3 color = mix(uBaseColor, uOutlineColor, n * n);
    color = mix(color, uOutlineColor, outline);

    vec3 baseColor = color;

    vec3 normal = normalize(vNormal2 * vec3(0.4, 1.0, 1.0));

    float light = max(0.0, dot(normal, normalize(vec3(0.0, 0.5, 1.0))));
    light = pow(light, 50.0);

    float light2 = max(0.0, dot(normalize((vNormal2) * vec3(1.0, 2.0, 2.0)), normalize(vec3(0.0, -0.5, 2.0))));
    light2 = pow(light2, 50.0);
    light = mix(light, light2, 0.3);

    color = mix(color, color * 6.0, light);

    color += light2 * baseColor * 4.0;

    color = pow(color, vec3(1.0 / 2.2));
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** 脸部片元着色器（原 `L`）—— 四色渐变 + 腮红 + HSV 光照 */
export const MONA3D_FACE_FRAG = /* glsl */ `${NOISE_3D + HSV}
uniform vec3 uBaseColor;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uLightDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vNormal2;
varying vec3 vPosition;

float getFresnel(vec3 normal, float power) {
  vec3 viewDir = vec3(0.0, -0.5, 1.0);
  return 1.0 - pow(max(dot(viewDir, normal), 0.0), power);
}

vec3 highlightDirection = normalize(vec3(0.0, 1.0, 0.6));

void main(){
  vec3 color = vNormal2 * 0.5 + 0.5;
  color = uBaseColor;

  float fresnel = 1.0 - getFresnel(vNormal, 4.0);
  fresnel *= 0.5;

  float r = vUv.y;

  float cheak = smoothstep(0.2, 0.0, length(abs(vUv - vec2(0.5, 0.0)) - vec2(0.24, 0.7)));

  color = mix(uColor1, uColor2, smoothstep(0.1, 0.5, r));
  color = mix(color, uColor3, smoothstep(0.5, 1.0, r));
  color = mix(color, uColor4, cheak);

  float light = max(0.0, dot(normalize(uLightDirection), vNormal2));
  float highlight = max(0.0, dot(highlightDirection, vNormal2));
  highlight = pow(highlight, 10.0);

  vec3 hsv = rgb2hsv(color);
  hsv.g += mix(0.05, 0.0, light) + highlight * 0.1;
  hsv.b += mix(-0.1, 0.1, light) + highlight;
  color = hsv2rgb(hsv);

  color = pow(color, vec3(1.0/2.2));
  gl_FragColor = vec4(color, 1.0);
}
`;

/** 网格线（原 `b` 类内联）—— 靠 instance 的 x 做左侧渐隐 */
export const GRID_FADE_VERT = /* glsl */ `
varying float vGridX;
void main() {
  vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
  vGridX = instancePosition.x + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
}
`;

export const GRID_FADE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vGridX;
void main() {
  float alpha = clamp((0.7 - vGridX) / 0.7, 0.0, 1.0);
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

/** Mona 精灵材质（原 `es`）—— Super 态走彩虹色相 */
export const MONA_SPRITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MONA_SPRITE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uOffset;
uniform vec2 uRepeat;
uniform float uTime;
uniform float uIsSuper;
varying vec2 vUv;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 applySuperMona(vec3 color, vec2 uv, float time) {
  float pureGrayscale = (color.r + color.g + color.b) / 3.0;
  vec3 rainbowHsv = vec3(uv.y * 0.3 + time, 0.8, 0.6);
  vec3 rainbowRgb = hsv2rgb(rainbowHsv);
  vec3 rainbowColor = mix(rainbowRgb, color, pureGrayscale);
  return rainbowColor;
}

void main() {
  vec4 texel = texture2D(uMap, vUv * uRepeat + uOffset);
  if (texel.a < 0.01) discard;
  if (uIsSuper > 0.5) {
    texel.rgb = applySuperMona(texel.rgb, vUv, uTime);
  }
  gl_FragColor = texel;
  #include <colorspace_fragment>
}
`;

/** 残影材质（原 `ei`）—— 纯色 alpha 剪影 */
export const GHOST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GHOST_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uOffset;
uniform vec2 uRepeat;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(uMap, vUv * uRepeat + uOffset);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}
`;

/** 虫子精灵表（原 `j` 类内联）—— 用两个 instance 属性传 UV 偏移与重复 */
export const BUG_VERT = /* glsl */ `
attribute vec2 instanceOffset;
attribute vec2 instanceRepeat;
varying vec2 vUv;
void main() {
  vUv = uv * instanceRepeat + instanceOffset;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const BUG_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < 0.01) discard;
  gl_FragColor = texel;
  #include <colorspace_fragment>
}
`;

/** 分数飘字（原 `ev` / `ex`）—— mega 分数会闪 */
export const SCORE_VERT = /* glsl */ `
varying vec2 vWorldPosition;
void main() {
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SCORE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vWorldPosition;
void main() {
  vec3 color = uColor + cos(uTime * 10.0) * 0.2;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/** 转场彩条（原 `eV` 内联）—— 直接写裁剪空间，逐层扫过 */
export const TRANSITION_VERT = /* glsl */ `
uniform float uOffsetY;
void main() {
  gl_Position = vec4(position.x, position.y + uOffsetY, 0.0, 1.0);
}
`;

export const TRANSITION_FRAG = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}
`;
