#version 300 es
precision highp float;
uniform sampler2D scene;
uniform vec2 resolution;
uniform float vignette;
uniform float exposure, saturation;
uniform float hue, temperature;
uniform float intro, introFeather;

/* --- colour grading -------------------------------------------------------
   The clouds in scene.frag carry their own sunset palette (four hard-coded
   tints per layer, 14 layers). Re-writing those 40+ constants per palette
   would mean recompiling the shader on every swatch click. Instead the grade
   runs here, on the finished frame: a three-stop ramp (shadow / mid / high)
   is built from the palette and used to *modulate* the colour rather than
   replace it, so the cloud layering and the drawn detail survive — the image
   gets a new light, not a new paint. */
uniform vec3 gradeShadow, gradeMid, gradeHigh;
uniform float gradeAmount;
uniform float grain;
/* Frame counter, only so the grain is not a fixed pattern welded to the
   screen — a static grain reads as dirt on the glass, not as film. */
uniform float grainSeed;

out vec4 color;

/* Cheap hash for the film grain — 3 lines, no texture, no extra uniform. */
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution;

  /* Chroma first: a hue rotate and a white-balance trim are corrections to
     the captured light, so they belong before any creative decision. */
  vec3 col = texture(scene, uv).rgb;
  if (hue != 0.) {
    vec3 axis = normalize(vec3(1.));
    float angle = radians(hue);
    col = col * cos(angle) + cross(axis, col) * sin(angle) + axis * dot(axis, col) * (1. - cos(angle));
  }
  col *= vec3(1. + temperature * .25, 1., 1. - temperature * .25);
  col = max(col, vec3(0.));
  col = mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, saturation) * exposure;

  /* Then the grade. `ramp` walks shadow → mid → highlight by the frame's own
     luminance, so the ramp always lands where the picture's values are, no
     matter how the scene is exposed. Multiplying by the ramp (instead of
     `mix`ing toward it) keeps every hue that was already in the frame — a
     train stays recognisably a train under a green sky. */
  const vec3 LUMA = vec3(.2126, .7152, .0722);
  float lum = dot(col, LUMA);
  vec3 ramp = mix(gradeShadow, gradeMid, smoothstep(0.0, 0.5, lum));
  ramp = mix(ramp, gradeHigh, smoothstep(0.45, 1.0, lum));
  /* Normalise against the ramp's own average luminance, so a palette can only
     change the colour balance and never the exposure. Dividing by the *mid*
     stop instead would blow the highlights out — with a typical three-stop
     ramp the highlights are ~1.8× the mid's luminance, and that much gain on
     top of an already-bright sunset washed the whole frame to cream. */
  float avgLuma = max((dot(gradeShadow, LUMA) + dot(gradeMid, LUMA) + dot(gradeHigh, LUMA)) / 3.0, 1e-3);
  ramp = ramp / avgLuma;
  col = mix(col, col * ramp, gradeAmount);

  /* A very fine grain to break up the wide flat gradients that banding shows
     in. Two changes from the first version, both of which came from pausing it
     and looking:

       - the weight was `1 - smoothstep(0.2, 0.9, lum)`, i.e. all the grain
         went into the shadows. Banding does live there, but so does most of
         the picture's surface, so the shadows speckled while the highlights
         stayed glassy. A flatter bell that peaks in the midtones breaks the
         banding just as well and stops looking like sensor noise.
       - the amplitude was 0.09 per unit. At the default 0.35 that is ±1.6% of
         full scale, which is fine in motion and very visible the moment the
         frame stops, because a still frame lets you actually see the grain
         instead of averaging it away. The default is now 0.16. */
  if (grain > 0.) {
    float n = grainHash(gl_FragCoord.xy + grainSeed);
    float weight = 0.35 + 0.65 * (1.0 - abs(lum - 0.42) * 1.5);
    col += (n - 0.5) * grain * 0.075 * clamp(weight, 0.0, 1.0);
  }

  col *= mix(1., .5 + .5 * pow(max(16. * uv.x * uv.y * (1. - uv.x) * (1. - uv.y), 0.), .2), vignette);

  if (intro < 1.) {
    float eased = intro * intro * (3. - 2. * intro);
    float edge = mix(-introFeather, 1. + introFeather, eased);
    float reveal = 1. - smoothstep(edge - introFeather, edge + introFeather, uv.x);
    col = mix(vec3(.008, .035, .051), col, reveal);
  }
  color = vec4(col, 1.);
}
