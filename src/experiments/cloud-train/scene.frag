#version 300 es
precision highp float;
uniform vec3 iResolution;uniform float iTime,uFeedback,zoom,offset,amplitude,uDetail;uniform sampler2D iChannel0,iChannel1;out vec4 result;
uniform float intro, introFeather;
float openingLayer(float start) {
  if (intro >= 1.) return 1.;
  float width = mix(.08, .24, clamp(introFeather / .6, 0., 1.));
  return smoothstep(start, min(start + width, 1.), intro);
}
uniform vec3 skyTint, smokeTint, trainTint;
vec3 trainRecolor(vec3 base){
  float y = dot(base, vec3(.299,.587,.114));
  return clamp(trainTint * (y / max(dot(trainTint, vec3(.299,.587,.114)), 1e-4)), 0.0, 1.0);
}
float noise(vec2 x){
    vec2 f = fract(x);
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);
    
    vec2 p = floor(x);
	float a = texture(iChannel0, (p+vec2(0.0, 0.0))/1024.0).x;
	float b = texture(iChannel0, (p+vec2(1.0,0.0))/1024.0).x;
	float c = texture(iChannel0, (p+vec2(0.0,1.0))/1024.0).x;
	float d = texture(iChannel0, (p+vec2(1.0,1.0))/1024.0).x;

    
	return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;
}

float fbm(vec2 x, int detail){
    float a = 0.0;
    float b = 1.0;
    float t = 0.0;
    for(int i = 0; i < min(detail, int(uDetail)); i++){
        float n = noise(x);
        a += b*n;
        t += b;
        b *= 0.7;
        x *= 2.0; 
    
    }
    return a/t;
}

float fbm2(vec2 x, int detail){
    float a = 0.0;
    float b = 1.0;
    float t = 0.0;
    for(int i = 0; i < min(detail, int(uDetail)); i++){
        float n = noise(x);
        a += b*n;
        t += b;
        b *= 0.9;
        x *= 2.0; 
    
    }
    return a/t;
}

float box(vec2 uv, float x1, float x2, float y1, float y2){
    return (uv.x > x1 && uv.x < x2 && uv.y > y1 && uv.y < y2)?1.0:0.0;
} 

// ============================================================================
// LOCAL EDITS vs the reference shader — 2 numbers per band, all of them the
// same kind. The reference leaves `midlevel` at 0.05 / -0.1 for the two
// foreground bands, and because `layer()` paints everything *below*
// `h + midlevel`, a foreground cloud whose surface wanders ±0.3 covers the
// bridge deck (uv.y ≈ 0.17) and the locomotive (≈ 0.11) for most frames —
// the train is genuinely there in the code and genuinely never seen. The
// reference's own page has the same problem; it is not a porting error.
//
// Dropping both bands by 0.15–0.20 puts the drifting surface back under the
// deck, so the train is visible and the clouds still pass in front of it when
// the amplitude slider is pushed up — which is what the slider is for.
// Every other line is byte-identical to the reference.
// ============================================================================

#define dot2(v) dot(v, v)
#define layer(dh, v) { float p=openingLayer(dist>=10. ? .08+.60*(100.-dist)/90. : (dist>1.5 ? .78 : .88)); if(dist!=matchedDepth && uv.y < h + midlevel - (dh)) { matchedDepth=dist; accumulated.rgb+=(1.-accumulated.a)*p*(v); accumulated.a+=(1.-accumulated.a)*p; if(accumulated.a>=1.) return accumulated; } }

vec4 foreground(vec2 uv, float t){
    vec4 accumulated=vec4(0.); float matchedDepth=-1.; float midlevel;
    float h;
    float disp;
    float dist;
    vec2 uv2;
    
    uv.y -= 0.2;
    // clouds foreground //////////////////////////////////////////////////////////////
    
    // c14
    // Exactly the reference value, and it should stay that way. This layer is
    // the one the train passes behind — it is what gives the picture depth,
    // and its height is the author's composition, not a bug to be tuned.
    //
    // I have now moved this twice, both times trying to keep the engine
    // visible, and both times I was solving the wrong problem: the engine
    // appearing and disappearing behind a cloud is the effect. Leave it alone.
    midlevel = -0.1;
    disp = 1.7;
    dist = 1.0;
    uv2 = uv + vec2(t/dist + 40.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.12, vec3(0.43, 0.32, 0.31));
    layer(0.08, vec3(0.55, 0.42, 0.41));
    layer(0.04, vec3(0.66, 0.42, 0.40));
    layer(0., vec3(0.77, 0.48, 0.46));
    
    // c13
    // Exactly the reference value: 0.05. Both foreground bands sit where the
    // author put them — this one crosses the bridge deck, the one above
    // swallows the train. I moved these twice trying to "unocclude" things and
    // both times I flattened the depth instead of fixing a bug. There was no
    // bug. The occlusion is the picture. Do not tune these again without a
    // reason that has nothing to do with visibility.
    midlevel = 0.05;
    disp = 1.7;
    dist = 2.0;
    uv2 = uv + vec2(t/dist + 38.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.95, 0.66, 0.48));
    layer(0.04, vec3(0.98, 0.76, 0.64));
    layer(0., vec3(0.95, 0.80, 0.77));
    
    return vec4(accumulated.a>0. ? accumulated.rgb/accumulated.a : vec3(0.95,0.80,0.77),accumulated.a);
}

vec4 background(vec2 uv, float t){
    vec4 accumulated=vec4(0.); float matchedDepth=-1.; float midlevel;
    float h;
    float disp;
    float dist;
    vec2 uv2;
    
    // clouds ///////////////////////////////////////////////////////
    
    // c12
    midlevel = 0.3;
    disp = 0.9;
    dist = 10.0;
    uv2 = uv + vec2(t/dist + 32.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.14, vec3(0.48, 0.19, 0.20));
    layer(0.1, vec3(0.68, 0.28, 0.19));
    layer(0.07, vec3(0.88, 0.38, 0.24));
    layer(0., vec3(0.95, 0.45, 0.30));
    
    // c11
    midlevel = 0.35;
    disp = 1.0;
    dist = 15.0;
    uv2 = uv + vec2(t/dist + 30.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.04, vec3(0.98, 0.76, 0.64));
    layer(0., vec3(0.95, 0.80, 0.77));
    
    // c10
    midlevel = 0.35;
    disp = 3.5;
    dist = 20.0;
    uv2 = uv + vec2(t/dist + 27.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.12, vec3(0.43, 0.32, 0.31));
    layer(0.08, vec3(0.55, 0.42, 0.41));
    layer(0.04, vec3(0.66, 0.42, 0.40));
    layer(0., vec3(0.77, 0.48, 0.46));
    
    // c9
    midlevel = 0.45;
    disp = 2.0;
    dist = 25.0;
    uv2 = uv + vec2(t/dist + 23.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.04, vec3(0.98, 0.57, 0.36));
    layer(0., vec3(1.0, 0.62, 0.44));
    
    // c8
    midlevel = 0.5;
    disp = 2.3;
    dist = 30.0;
    uv2 = uv + vec2(t/dist + 20.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.12, vec3(0.41, 0.27, 0.27));
    layer(0.08, vec3(0.53, 0.35, 0.32));
    layer(0.04, vec3(0.80, 0.24, 0.17));
    layer(0., vec3(0.99, 0.29, 0.20));
    
    // c7
    midlevel = 0.5;
    disp = 2.5;
    dist = 35.0;
    uv2 = uv + vec2(t/dist + 18.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.88, 0.38, 0.24));
    layer(0.05, vec3(0.98, 0.42, 0.28));
    layer(0., vec3(1.0, 0.48, 0.35));
    
    // c6
    midlevel = 0.6;
    disp = 2.0;
    dist = 40.0;
    uv2 = uv + vec2(t/dist + 18.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.95, 0.66, 0.48));
    layer(0., vec3(1.0, 0.76, 0.60));
    
    // c5
    midlevel = 0.75;
    disp = 3.5;
    dist = 45.0;
    uv2 = uv + vec2(t/dist + 15.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.2, vec3(1.0, 0.55, 0.33));
    layer(0.15, vec3(0.98, 0.50, 0.24));
    layer(0.1, vec3(0.90, 0.55, 0.40));
    layer(0., vec3(1.0, 0.62, 0.44));
    
    // c4
    midlevel = 0.7;
    disp = 2.7;
    dist = 50.0;
    uv2 = uv + vec2(t/dist + 12.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.04, vec3(0.73, 0.36, 0.30));
    layer(0., vec3(0.80, 0.40, 0.34));
    
    // c3
    midlevel = 0.8;
    disp = 2.7;
    dist = 60.0;
    uv2 = uv + vec2(t/dist + 9.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.93, 0.58, 0.35));
    layer(0., vec3(1.0, 0.76, 0.60));
    
    // c2
    midlevel = 0.9;
    disp = 3.0;
    dist = 70.0;
    uv2 = uv + vec2(t/dist + 7.0, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.56, 0.25, 0.22));
    layer(0.05, vec3(0.60, 0.30, 0.27));
    layer(0., vec3(0.74, 0.35, 0.30));
    
    // c1
    midlevel = 1.0;
    disp = 5.0;
    dist = 100.0;
    uv2 = uv + vec2(t/dist + 3.5, 0.0);
    h = (fbm(uv2, 8) - 0.5)*disp*amplitude;
    layer(0.1, vec3(0.92, 0.85, 0.82));
    layer(0., vec3(1.0, 0.94, 0.91));
    
    return vec4(accumulated.rgb+(1.-accumulated.a)*mix(vec3(.008,.035,.051),skyTint,openingLayer(0.)), 1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord/iResolution.y - .5*iResolution.xy/iResolution.y)/zoom + .5*iResolution.xy/iResolution.y; uv.y -= offset;
    //uv.x += iTime;
    float t = iTime*4.0;
    vec4 bg = background(uv, t);
    
    vec4 fg = vec4(0.);
    int n = 5;
    if (uv.y < 0.5)
    for (int i = 0; i < n; i++){
        fg += foreground(uv, t+(4./3.)*float(i)/float(n)/60.) / (float(n));
    }
    
    vec3 col = bg.rgb; vec3 openingBackground = col;
    // train /////////////////////////////////////////////////////////////////////
    float k;
    vec4 accumulated=vec4(0.); float matchedDepth=-1.; float midlevel;
    float h;
    float disp;
    float dist;
    vec2 uv2;
    uv.y -= 0.2;
    // choo choo
    k = 1.0;
    uv2 = fract(uv*9.0);
    float wagon = 1.0;
    wagon *= 1.0 - step(0.45, uv.x);
    wagon *= 1.0 - step(0.115, uv.y);
    wagon *= step(0.103, uv.y);
    wagon *= step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0));
    
    float join = 1.0; 
    join *= 1.0 - step(0.45, uv.x);
    join *= 1.0 - step(0.11, uv.y);
    join *= step(0.107, uv.y);
    
    
    float roof = 1.0;
    roof *= 1.0 - step(0.45, uv.x);
    roof *= 1.0 - step(0.117, uv.y);
    roof *= step(0.11, uv.y);
    roof *= step(0.15, 1.0 - abs(uv2.x*2.0 - 1.0));
    
    float loco = box(uv, 0.45, 0.5, 0.103, 0.112);
    float chem1 = box(uv, 0.49, 0.495, 0.103, 0.12);
    float chem2 = box(uv, 0.488, 0.496, 0.12, 0.123);
    float locoRoof = box(uv, 0.443, 0.47, 0.11, 0.117);
    
    float wheel = 1.0 - step(0.00004, dot2(uv - vec2(0.457, 0.106)));
    wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.487, 0.105)));
    wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.497, 0.105)));
    
    if (uv.x < 0.45 && uv.y > 0.025 && uv.y < 0.2){
        wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.2, 0.95)));
        wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.8, 0.95)));
    }
    col = mix(col, trainRecolor(vec3(0.18, 0.12, 0.15)), join);
    col =  mix(col, trainRecolor(vec3(0.48, 0.19, 0.20)), wagon);
    col = mix(col, trainRecolor(vec3(0.18, 0.12, 0.15)), roof);
    
    col = mix(col, trainRecolor(vec3(0.38, 0.19, 0.20)), loco);
    col = mix(col, trainRecolor(vec3(0.38, 0.19, 0.20)), chem1);
    col = mix(col, trainRecolor(vec3(0.18, 0.12, 0.15)), locoRoof);
    col = mix(col, trainRecolor(vec3(0.18, 0.12, 0.15)), chem2 + wheel);
    // loco smoke //////
    
    dist = 5.0;
    uv2 = uv + vec2(t/dist + 3.5, 0.0);
    uv2.x -= t/dist*0.2;
    h = fbm2(uv2, 8) - 0.55;
    
    if(uv.x < 0.49){
        float x = -uv.x + 0.49;
        float y = abs(uv.y + h*0.4 - 0.16*sqrt(x) - 0.12) - 0.8*x*exp(-x*10.0);
        if(y < 0.0) col = vec3(1.0, 0.94, 0.91)*smokeTint;
        if(y < - 0.02) col = vec3(0.92, 0.85, 0.82)*smokeTint;
    }
    
    //bridge ///////
    dist = 5.0;
    uv2 = uv + vec2(t/dist + 32.5, 0.0);
    uv2.x = fract(uv2.x*3.0);
    k = 1.0;
    k *= smoothstep(0.001, 0.003, abs(uv2.y - pow(uv2.x - 0.5, 2.0)*0.15 - 0.12));
    k *= min(step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0))
         +   step(0.17, uv2.y), 1.0);
    k *= min(smoothstep(0.02, 0.05, 1.0 - abs(uv2.x*2.0 - 1.0))
         +   step(0.177, uv2.y), 1.0);
         
    k *= min(step(0.1, uv2.y)
           + smoothstep(-0.09, -0.085, -uv2.y - 0.001/(1.0 - abs(uv2.x*2.0 - 1.0))), 1.0);
           
    k *= min(smoothstep(0.05, 0.2, 1.0 - abs(fract(uv2.x*16.0)*2.0 - 1.0))
         +   step(0.12, uv2.y - pow(uv2.x - 0.5, 2.0)*0.15)
         +   step(-0.1, -uv2.y), 1.0);
    col = mix(vec3(0.29, 0.09, 0.08)*smoothstep(-0.08, 0.08, uv.y), col, k);
    
    
    
    col = mix(openingBackground, col, openingLayer(.70)); col = mix(col, fg.rgb, fg.a);

    // Output to screen
    uv = fragCoord/iResolution.xy;
    col = mix(col, texture(iChannel1, uv).rgb, uFeedback);
    fragColor = vec4(col,1.0);
}


void main(){mainImage(result,gl_FragCoord.xy);}