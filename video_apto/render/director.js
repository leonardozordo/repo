/* Diretor do vídeo: câmera em trajeto, render HDR com AO + acumulação (AA + motion blur),
   bloom, tone mapping ACES, vinheta e grão. Roda dentro da página do plantav2_claude. */
(function () {
'use strict';
const T = THREE, A = window.__plantav2, R = A.renderer, scene = A.scene;
const CFG = Object.assign({ w: 1920, h: 1080, fps: 30, dur: 15, sub: 8, fov: 56, exposure: 1.0, aoRadius: 0.32, aoStrength: 0.85, bloom: 0.045, envK: 1.0, hemi: 0.10, sun: 1.6, sky: 1.35, bld: 0.78, key: 0.25 }, window.__CFG || {});
const W = CFG.w, H = CFG.h;

/* ---------- estado da cena ---------- */
A.lowPower(0);
A.setMode('walk');
R.setPixelRatio(1);
R.setSize(W, H, false);
R.autoClear = true;

let sun = null, hemi = null, skySphere = null, buildings = null;
const cubeCams = [];
scene.traverse(function (o) {
  if (o.isDirectionalLight) sun = o;
  if (o.isHemisphereLight) hemi = o;
  if (o.isInstancedMesh) buildings = o;
  if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.radius === 190) skySphere = o;
  if (o.isCubeCamera || o.type === 'CubeCamera') cubeCams.push(o);
});

/* sombra do sol mais definida */
sun.shadow.mapSize.set(4096, 4096);
if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.015;
R.shadowMap.needsUpdate = true;

/* céu e prédios emitem mais que o interior (como numa foto real de interiores) */
skySphere.material.color.setRGB(CFG.sky * 0.86, CFG.sky * 0.95, CFG.sky * 1.08);
buildings.material.color.setScalar(CFG.bld);

const transparentObjs = [];
const materials = new Set();
scene.traverse(function (o) {
  if (!o.isMesh) return;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  ms.forEach(function (m) { materials.add(m); });
  if (ms.some(function (m) { return m.transparent; })) transparentObjs.push(o);
});
const baseEnvI = new Map();
materials.forEach(function (m) { if ('envMapIntensity' in m) baseEnvI.set(m, m.envMapIntensity); });
materials.forEach(function (m) { if (m.transparent && m.opacity < 0.3) { baseEnvI.set(m, 0.6); m.opacity = 0.12; } });
function setEnvK(k) { baseEnvI.forEach(function (v, m) { m.envMapIntensity = v * k; }); }

function applyLights() {
  hemi.intensity = CFG.hemi;
  sun.intensity = CFG.sun;
}
applyLights();

/* ---------- luz indireta: o ambiente é capturado de dentro do próprio apartamento (2 rebatidas) ---------- */
const envRT = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType, generateMipmaps: false });
const envCam = new T.CubeCamera(0.05, 400, envRT);
scene.add(envCam);
const pmrem = new T.PMREMGenerator(R);
let envTex = null;
function captureEnv() {
  envCam.position.set(1.85, 1.35, 3.9);
  for (let b = 0; b < 2; b++) {
    envCam.update(R, scene);
    const t = pmrem.fromCubemap(envRT.texture).texture;
    if (envTex) envTex.dispose();
    envTex = t;
    scene.environment = envTex;
    setEnvK(CFG.envK);
  }
}
function refreshMirrors() {
  cubeCams.forEach(function (cc) {
    const tex = cc.renderTarget.texture, hidden = [];
    scene.traverse(function (o) { if (o.isMesh && o.material && o.material.envMap === tex) { o.visible = false; hidden.push(o); } });
    cc.update(R, scene);
    hidden.forEach(function (o) { o.visible = true; });
  });
}

/* ---------- alvos de render ---------- */
const rtOpt = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true };
const beautyRT = new T.WebGLRenderTarget(W, H, rtOpt);
const depthTex = new T.DepthTexture(W, H); depthTex.type = T.UnsignedIntType;
const normalRT = new T.WebGLRenderTarget(W, H, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthTexture: depthTex });
const aoRT = new T.WebGLRenderTarget(W, H, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
const aoBlurRT = aoRT.clone();
const accRT = new T.WebGLRenderTarget(W, H, { type: T.FloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
const outRT = new T.WebGLRenderTarget(W, H, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false });
const bloomRTs = [];
for (let i = 0, w = W >> 1, h = H >> 1; i < 6; i++, w >>= 1, h >>= 1) bloomRTs.push(new T.WebGLRenderTarget(Math.max(w, 1), Math.max(h, 1), { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false }));

const lumRTs = [];
for (let i = 0, w = W >> 2, h = H >> 2; w >= 24; i++, w >>= 1, h >>= 1) lumRTs.push(new T.WebGLRenderTarget(w, h, { type: T.FloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false }));
const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
quad.frustumCulled = false;
const quadScene = new T.Scene(); quadScene.add(quad);
function pass(mat, target) { quad.material = mat; R.setRenderTarget(target); R.render(quadScene, quadCam); }
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function sm(uniforms, fs, extra) { return new T.ShaderMaterial(Object.assign({ uniforms: uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }, extra || {})); }

/* ---------- AO em espaço de tela ---------- */
const KS = 24, kernel = [];
(function () {
  let s = 7;
  function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
  for (let i = 0; i < KS; i++) {
    const v = new T.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd()).normalize();
    let sc = i / KS; sc = 0.1 + 0.9 * sc * sc;
    kernel.push(v.multiplyScalar(sc * (0.6 + 0.4 * rnd())));
  }
})();
const aoMat = sm({
  tDepth: { value: depthTex }, tNormal: { value: normalRT.texture },
  proj: { value: new T.Matrix4() }, invProj: { value: new T.Matrix4() },
  kernel: { value: kernel }, radius: { value: CFG.aoRadius }, seed: { value: 0 }
}, [
  '#define KS ' + KS,
  'uniform sampler2D tDepth; uniform sampler2D tNormal; uniform mat4 proj; uniform mat4 invProj; uniform vec3 kernel[KS]; uniform float radius; uniform float seed;',
  'varying vec2 vUv;',
  'vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = invProj * c; return v.xyz / v.w; }',
  'void main(){',
  '  float d = texture2D(tDepth, vUv).x; if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }',
  '  vec3 P = vpos(vUv); vec3 N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);',
  '  vec2 ip = mod(floor(gl_FragCoord.xy), 4.0); float a = ((ip.x + ip.y * 4.0) / 16.0) * 6.2831853 + seed;',
  '  vec3 rv = vec3(cos(a), sin(a), 0.0); vec3 Tg = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, Tg); mat3 TBN = mat3(Tg, B, N);',
  '  float occ = 0.0; float rad = radius;',
  '  for (int i = 0; i < KS; i++) {',
  '    vec3 s = P + TBN * kernel[i] * rad; vec4 o = proj * vec4(s, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;',
  '    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;',
  '    float sz = vpos(suv).z; float range = smoothstep(0.0, 1.0, rad / abs(P.z - sz));',
  '    occ += (sz >= s.z + 0.012 ? 1.0 : 0.0) * range;',
  '  }',
  '  float ao = 1.0 - occ / float(KS);',
  '  gl_FragColor = vec4(vec3(ao), 1.0);',
  '}'
].join('\n'));
const aoBlurMat = sm({ tAO: { value: aoRT.texture }, tDepth: { value: depthTex }, res: { value: new T.Vector2(W, H) }, near: { value: 0.05 }, far: { value: 400 } }, [
  'uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 res; uniform float near; uniform float far; varying vec2 vUv;',
  'float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }',
  'void main(){',
  '  float z0 = lin(texture2D(tDepth, vUv).x); float s = 0.0, wsum = 0.0;',
  '  for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) {',
  '    vec2 uv = vUv + (vec2(float(x), float(y)) + 0.5) / res;',
  '    float z = lin(texture2D(tDepth, uv).x); float w = exp(-abs(z - z0) / (0.04 * z0 + 0.01));',
  '    s += texture2D(tAO, uv).r * w; wsum += w;',
  '  }',
  '  gl_FragColor = vec4(vec3(s / max(wsum, 1e-4)), 1.0);',
  '}'
].join('\n'));

/* beleza × AO, acumulada (cada sub-quadro pesa 1/N) */
const accMat = sm({ tBeauty: { value: beautyRT.texture }, tAO: { value: aoBlurRT.texture }, strength: { value: CFG.aoStrength }, weight: { value: 1 } }, [
  'uniform sampler2D tBeauty; uniform sampler2D tAO; uniform float strength; uniform float weight; varying vec2 vUv;',
  'void main(){ vec3 c = texture2D(tBeauty, vUv).rgb; float ao = texture2D(tAO, vUv).r; ao = mix(1.0, pow(ao, 1.25), strength);',
  '  gl_FragColor = vec4(c * ao * weight, 1.0); }'
].join('\n'), { blending: T.NoBlending });
const accAddMat = accMat.clone(); accAddMat.uniforms = accMat.uniforms;
accAddMat.blending = T.CustomBlending; accAddMat.blendEquation = T.AddEquation; accAddMat.blendSrc = T.OneFactor; accAddMat.blendDst = T.OneFactor;

/* ---------- bloom (cadeia de mips) ---------- */
const downMat = sm({ tSrc: { value: null }, texel: { value: new T.Vector2() }, prefilter: { value: 0 } }, [
  'uniform sampler2D tSrc; uniform vec2 texel; uniform float prefilter; varying vec2 vUv;',
  'void main(){',
  '  vec3 a = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb; vec3 b = texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;',
  '  vec3 c = texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb; vec3 d = texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;',
  '  vec3 e = texture2D(tSrc, vUv).rgb;',
  '  vec3 col = (a + b + c + d) * 0.125 + e * 0.5;',
  '  if (prefilter > 0.5) { float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col *= smoothstep(0.9, 2.2, l); col = min(col, vec3(30.0)); }',
  '  gl_FragColor = vec4(col, 1.0); }'
].join('\n'), { blending: T.NoBlending });
const upMat = sm({ tSrc: { value: null }, texel: { value: new T.Vector2() } }, [
  'uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;',
  'void main(){',
  '  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;',
  '  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 2.0 + texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)).rgb * 2.0;',
  '  s += texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb * 2.0 + texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)).rgb * 2.0;',
  '  s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;',
  '  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;',
  '  gl_FragColor = vec4(s / 16.0, 1.0); }'
].join('\n'), { blending: T.AdditiveBlending, transparent: true });
function bloom() {
  let src = accRT;
  for (let i = 0; i < bloomRTs.length; i++) {
    downMat.uniforms.tSrc.value = src.texture;
    downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
    downMat.uniforms.prefilter.value = i === 0 ? 1 : 0;
    pass(downMat, bloomRTs[i]); src = bloomRTs[i];
  }
  R.autoClear = false;
  for (let i = bloomRTs.length - 1; i > 0; i--) {
    upMat.uniforms.tSrc.value = bloomRTs[i].texture;
    upMat.uniforms.texel.value.set(1 / bloomRTs[i].width, 1 / bloomRTs[i].height);
    pass(upMat, bloomRTs[i - 1]);
  }
  R.autoClear = true;
}

let adapt = null, lastF = -10, lumBuf = null;
function measureExposure(f) {
  let src = accRT;
  lumRTs.forEach(function (rt) {
    downMat.uniforms.tSrc.value = src.texture; downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height); downMat.uniforms.prefilter.value = 0;
    pass(downMat, rt); src = rt;
  });
  const rt = lumRTs[lumRTs.length - 1];
  if (!lumBuf) lumBuf = new Float32Array(rt.width * rt.height * 4);
  R.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, lumBuf);
  let sum = 0, wsum = 0;
  for (let y = 0; y < rt.height; y++) for (let x = 0; x < rt.width; x++) {
    const i = (y * rt.width + x) * 4, L = 0.2126 * lumBuf[i] + 0.7152 * lumBuf[i + 1] + 0.0722 * lumBuf[i + 2];
    const dx = (x + 0.5) / rt.width - 0.5, dy = (y + 0.5) / rt.height - 0.5, w = Math.exp(-(dx * dx + dy * dy) * 6);
    sum += Math.log(Math.max(L, 1e-4)) * w; wsum += w;
  }
  const avg = Math.exp(sum / wsum); window.__DIR.lastAvg = avg.toFixed(3);
  const target = Math.min(1.3, Math.max(0.75, Math.pow(CFG.key / avg, 0.5)));
  if (adapt === null || f !== lastF + 1) adapt = target; else adapt += (target - adapt) * 0.07;
  lastF = f;
  return adapt;
}

/* ---------- final: lente, ACES, sRGB, vinheta, grão ---------- */
const finalMat = sm({ tHDR: { value: accRT.texture }, tBloom: { value: bloomRTs[0].texture }, bloomK: { value: CFG.bloom }, exposure: { value: CFG.exposure }, time: { value: 0 }, res: { value: new T.Vector2(W, H) } }, [
  'uniform sampler2D tHDR; uniform sampler2D tBloom; uniform float bloomK; uniform float exposure; uniform float time; uniform vec2 res; varying vec2 vUv;',
  'vec3 vidFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
  'vec3 vidAces(vec3 color){',
  '  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));',
  '  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));',
  '  color *= exposure / 0.6; color = IN * color; color = vidFit(color); color = OUT * color; return clamp(color, 0.0, 1.0); }',
  'vec3 vidSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }',
  'float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
  'void main(){',
  '  vec2 c = vUv - 0.5; float r2 = dot(c * vec2(res.x / res.y, 1.0), c * vec2(res.x / res.y, 1.0));',
  '  vec2 ca = c * 0.0012 * r2;',
  '  vec3 col; col.r = texture2D(tHDR, vUv - ca).r; col.g = texture2D(tHDR, vUv).g; col.b = texture2D(tHDR, vUv + ca).b;',
  '  vec3 bl = texture2D(tBloom, vUv).rgb / 6.0;',
  '  col = col + bl * bloomK;',
  '  col *= mix(1.0, 0.72, smoothstep(0.05, 1.05, r2));',
  '  col *= vec3(1.02, 1.0, 0.975);',
  '  col = vidSRGB(vidAces(col));',
  '  float g = hash(gl_FragCoord.xy + fract(time * 13.37) * 512.0) + hash(gl_FragCoord.xy * 1.37 + fract(time * 7.13) * 311.0) - 1.0;',
  '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
  '  col += g * mix(0.022, 0.010, lum);',
  '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
  '}'
].join('\n'), { blending: T.NoBlending });

/* ---------- câmera e trajeto ---------- */
const cam = new T.PerspectiveCamera(CFG.fov, W / H, 0.05, 400);
const normalMat = new T.MeshNormalMaterial(); normalMat.blending = T.NoBlending;

/* chaves: t (s), x, z, olhar (yaw), inclinação (pitch), altura */
const PI = Math.PI;
const KEYS = window.__KEYS || [
  { t: 0.0, x: 2.50, z: 0.22, yaw: PI - 0.05, pitch: -0.06, eye: 1.52 },
  { t: 2.4, x: 2.38, z: 1.50, yaw: 2.55, pitch: -0.15, eye: 1.52 },
  { t: 5.0, x: 2.36, z: 2.90, yaw: PI + 0.51, pitch: -0.12, eye: 1.52 },
  { t: 7.6, x: 2.25, z: 4.50, yaw: PI - 0.05, pitch: -0.07, eye: 1.52 },
  { t: 10.6, x: 1.65, z: 4.92, yaw: 1.85, pitch: -0.09, eye: 1.52 },
  { t: 15.0, x: 1.22, z: 4.93, yaw: 0.85, pitch: -0.11, eye: 1.52 }
];
/* posição: Catmull-Rom centrípeta com velocidade suave (início e fim desaceleram) */
const ctrl = KEYS.map(function (k) { return new T.Vector3(k.x, k.eye, k.z); });
const curve = new T.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
const DUR = CFG.dur;
const LENS = curve.getLengths(2000), LTOT = LENS[LENS.length - 1];
const KS_T = KEYS.map(function (k) { return k.t; });
const KS_S = KEYS.map(function (k, i) { return LENS[Math.round(i / (KEYS.length - 1) * 2000)] / LTOT; });
const KS_D = (function () { /* derivadas monotônicas (Fritsch–Carlson), paradas suaves no início e no fim */
  const n = KS_T.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((KS_S[i + 1] - KS_S[i]) / (KS_T[i + 1] - KS_T[i]));
  m.push(0);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]));
  m.push(0);
  return m;
})();
function easeS(t) {
  let i = 0; while (i < KS_T.length - 2 && t > KS_T[i + 1]) i++;
  const h = KS_T[i + 1] - KS_T[i], u = Math.min(1, Math.max(0, (t - KS_T[i]) / h)), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * KS_S[i] + (u3 - 2 * u2 + u) * h * KS_D[i] + (-2 * u3 + 3 * u2) * KS_S[i + 1] + (u3 - u2) * h * KS_D[i + 1];
}
/* olhar: Catmull-Rom por tempo em cada canal */
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
function channel(name, t) {
  const k = KEYS; let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const u = Math.min(1, Math.max(0, (t - k[i].t) / (k[i + 1].t - k[i].t)));
  const s = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
  const p0 = k[Math.max(0, i - 1)][name], p1 = k[i][name], p2 = k[i + 1][name], p3 = k[Math.min(k.length - 1, i + 2)][name];
  return cr(p0, p1, p2, p3, s);
}
/* tremor de gimbal: ruído suave, bem sutil */
function nz(t, f, ph) { return Math.sin(t * f + ph) * 0.5 + Math.sin(t * f * 2.13 + ph * 1.7) * 0.3 + Math.sin(t * f * 4.71 + ph * 0.3) * 0.2; }
const _p = new T.Vector3();
function placeCamera(t) {
  t = Math.min(DUR, Math.max(0, t));
  curve.getPointAt(Math.min(1, Math.max(0, easeS(t))), _p);
  const yaw = channel('yaw', t) + nz(t, 0.9, 1.3) * 0.004;
  const pitch = channel('pitch', t) + nz(t, 1.1, 0.4) * 0.003;
  const roll = nz(t, 0.7, 2.2) * 0.0035;
  const bob = Math.sin(t * 2 * PI * 1.75) * 0.0035;
  cam.position.set(_p.x, _p.y + bob, _p.z);
  const cp = Math.cos(pitch);
  cam.up.set(0, 1, 0);
  cam.lookAt(_p.x + Math.sin(yaw) * cp, _p.y + bob + Math.sin(pitch), _p.z - Math.cos(yaw) * cp);
  cam.rotateZ(roll);
  cam.updateMatrixWorld(true);
  const zz = Math.min(1, Math.max(0, (_p.z - 4.9) / 1.0)); autoExp = 1 - 0.36 * zz * zz * (3 - 2 * zz);
}
let autoExp = 1;

function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

function renderSub(t, si, n) {
  placeCamera(t);
  const jx = n > 1 ? halton(si + 1, 2) - 0.5 : 0, jy = n > 1 ? halton(si + 1, 3) - 0.5 : 0;
  cam.setViewOffset(W, H, jx, jy, W, H);
  cam.updateProjectionMatrix();
  /* beleza HDR */
  R.setRenderTarget(beautyRT); R.clear(); R.render(scene, cam);
  /* normais + profundidade (sem vidro, cortina translúcida e céu) */
  const vis = transparentObjs.map(function (o) { const v = o.visible; o.visible = false; return v; });
  const skyVis = skySphere.parent.visible; skySphere.parent.visible = false;
  const bg = scene.background; scene.background = null;
  scene.overrideMaterial = normalMat;
  R.setClearColor(0x7777ff, 1);
  R.setRenderTarget(normalRT); R.clear(); R.render(scene, cam);
  scene.overrideMaterial = null; scene.background = bg;
  skySphere.parent.visible = skyVis;
  transparentObjs.forEach(function (o, i) { o.visible = vis[i]; });
  R.setClearColor(0x000000, 1);
  /* AO */
  aoMat.uniforms.proj.value.copy(cam.projectionMatrix);
  aoMat.uniforms.invProj.value.copy(cam.projectionMatrixInverse);
  aoMat.uniforms.seed.value = si * 0.618;
  pass(aoMat, aoRT);
  pass(aoBlurMat, aoBlurRT);
  /* acumula */
  accMat.uniforms.weight.value = 1 / n;
  if (si === 0) pass(accMat, accRT);
  else { R.autoClear = false; pass(accAddMat, accRT); R.autoClear = true; }
}

const shutter = 0.5; /* 180° */
let pixBuf = null;
function renderFrame(f, n) {
  n = n || CFG.sub;
  const t0 = f / CFG.fps;
  for (let s = 0; s < n; s++) {
    const t = n > 1 ? t0 + ((s + 0.5) / n - 0.5) * (shutter / CFG.fps) : t0;
    renderSub(t, s, n);
  }
  bloom();
  finalMat.uniforms.time.value = f / CFG.fps;
  placeCamera(t0); const ex = CFG.expCurve ? CFG.expCurve[Math.min(f, CFG.expCurve.length - 1)] : measureExposure(f); window.__DIR.lastExp = ex; finalMat.uniforms.exposure.value = CFG.exposure * ex;
  pass(finalMat, outRT);
  if (!pixBuf) pixBuf = new Uint8Array(W * H * 4);
  R.readRenderTargetPixels(outRT, 0, 0, W, H, pixBuf);
  return pixBuf;
}
function b64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

window.__DIR = {
  CFG: CFG, cam: cam, KEYS: KEYS,
  prepare: function () { R.shadowMap.needsUpdate = true; placeCamera(0); R.setRenderTarget(beautyRT); R.render(scene, cam); captureEnv(); refreshMirrors(); R.shadowMap.needsUpdate = false; return { sun: !!sun, sky: !!skySphere, mirrors: cubeCams.length, transp: transparentObjs.length }; },
  frame: function (f, n) { return b64(renderFrame(f, n)); },
  frameTimed: function (f, n) { const t = performance.now(); const px = renderFrame(f, n); return { ms: performance.now() - t, sample: px[0] }; },
  setExposure: function (e) { finalMat.uniforms.exposure.value = e; },
  set: function (o) { Object.assign(CFG, o); applyLights(); skySphere.material.color.setScalar(CFG.sky); buildings.material.color.setScalar(CFG.bld); aoMat.uniforms.radius.value = CFG.aoRadius; accMat.uniforms.strength.value = CFG.aoStrength; finalMat.uniforms.bloomK.value = CFG.bloom; finalMat.uniforms.exposure.value = CFG.exposure; cam.fov = CFG.fov; cam.updateProjectionMatrix(); },
  recapture: function () { R.shadowMap.needsUpdate = true; R.setRenderTarget(beautyRT); R.render(scene, cam); captureEnv(); refreshMirrors(); }
};
})();
