// Fundo animado do app: WebGPU quando disponível, WebGL2 como reserva e gradiente CSS como último recurso.
// As cores vêm das variáveis CSS do tema (--fx-*), então cada tema tem seu próprio "clima".
import { cssVar, hexToRgb, reducedMotion } from '../utils.js';

const GLSL_COMMON = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}`;

const GLSL_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const GLSL_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uMode;
uniform float uEnergy;
uniform vec3 uBg;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
out vec4 outColor;
${GLSL_COMMON}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime * (0.035 + 0.09 * uEnergy);
  vec3 col = uBg;
  if (uMode < 0.5) {
    vec2 q = vec2(fbm(p * 1.1 + vec2(t, -t)), fbm(p * 1.1 + vec2(-t * 0.8, t * 0.6) + 4.7));
    float n = fbm(p * 1.4 + q * 1.8 + t * 0.5);
    col = mix(col, uC1, smoothstep(0.30, 0.80, n));
    col = mix(col, uC2, smoothstep(0.45, 0.85, q.x) * 0.8);
    col = mix(col, uC3, smoothstep(0.50, 0.90, q.y) * 0.7);
  } else if (uMode < 1.5) {
    float h = fbm(p * 1.3 + vec2(t * 0.5, -t * 0.3));
    float k = h * 14.0;
    float w = fwidth(k);
    float d = min(fract(k), 1.0 - fract(k));
    float line = 1.0 - smoothstep(0.0, w * 1.4, d);
    col = mix(col, uC1, smoothstep(0.2, 0.9, h) * 0.85);
    col = mix(col, uC2, line * 0.9);
  } else {
    float y = frag.y / uRes.y;
    float aa = 1.5 / uRes.y;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float off = 0.82 - fi * 0.16
        + 0.03 * sin(p.x * (2.0 + fi * 0.6) + t * 7.0 * (1.0 + fi * 0.25) + fi * 1.7)
        + 0.05 * (fbm(vec2(p.x * 1.4 + fi * 3.1, t * 1.5 + fi)) - 0.5);
      float m = 1.0 - smoothstep(off - aa, off + aa, y);
      vec3 c = mix(uC1, uC2, fi / 4.0);
      c = mix(c, uC3, step(3.5, fi) * 0.6);
      col = mix(col, c, m * 0.5);
    }
  }
  col *= 1.0 + 0.06 * uEnergy * sin(uTime * 1.6);
  float vig = smoothstep(0.35, 1.25, length(p));
  col = mix(col, col * 0.86, vig);
  col += (hash(frag + fract(uTime * 7.0) * 100.0) - 0.5) * 0.022;
  outColor = vec4(col, 1.0);
}`;

const WGSL = /* wgsl */ `
struct U {
  res: vec2f, time: f32, mode: f32,
  bg: vec4f, c1: vec4f, c2: vec4f, c3: vec4f,
  energy: f32, p0: f32, p1: f32, p2: f32,
};
@group(0) @binding(0) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[i], 0.0, 1.0);
}

fn hash(p0: vec2f) -> f32 {
  var p = fract(p0 * vec2f(123.34, 456.21));
  p = p + vec2f(dot(p, p + vec2f(45.32)));
  return fract(p.x * p.y);
}
fn noise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let w = f * f * (3.0 - 2.0 * f);
  let a = hash(i); let b = hash(i + vec2f(1.0, 0.0)); let c = hash(i + vec2f(0.0, 1.0)); let d = hash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
fn fbm(p0: vec2f) -> f32 {
  var v = 0.0; var a = 0.5; var p = p0;
  for (var i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2f(1.7, 9.2); a *= 0.5; }
  return v;
}

@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let frag = vec2f(fc.x, u.res.y - fc.y);
  let p = (frag - 0.5 * u.res) / min(u.res.x, u.res.y);
  let t = u.time * (0.035 + 0.09 * u.energy);
  var col = u.bg.rgb;
  let h = fbm(p * 1.3 + vec2f(t * 0.5, -t * 0.3));
  let k = h * 14.0;
  let w = fwidth(k);
  if (u.mode < 0.5) {
    let q = vec2f(fbm(p * 1.1 + vec2f(t, -t)), fbm(p * 1.1 + vec2f(-t * 0.8, t * 0.6) + 4.7));
    let n = fbm(p * 1.4 + q * 1.8 + t * 0.5);
    col = mix(col, u.c1.rgb, smoothstep(0.30, 0.80, n));
    col = mix(col, u.c2.rgb, smoothstep(0.45, 0.85, q.x) * 0.8);
    col = mix(col, u.c3.rgb, smoothstep(0.50, 0.90, q.y) * 0.7);
  } else if (u.mode < 1.5) {
    let d = min(fract(k), 1.0 - fract(k));
    let line = 1.0 - smoothstep(0.0, w * 1.4, d);
    col = mix(col, u.c1.rgb, smoothstep(0.2, 0.9, h) * 0.85);
    col = mix(col, u.c2.rgb, line * 0.9);
  } else {
    let y = frag.y / u.res.y;
    let aa = 1.5 / u.res.y;
    for (var i = 0; i < 5; i++) {
      let fi = f32(i);
      let off = 0.82 - fi * 0.16
        + 0.03 * sin(p.x * (2.0 + fi * 0.6) + t * 7.0 * (1.0 + fi * 0.25) + fi * 1.7)
        + 0.05 * (fbm(vec2f(p.x * 1.4 + fi * 3.1, t * 1.5 + fi)) - 0.5);
      let m = 1.0 - smoothstep(off - aa, off + aa, y);
      var c = mix(u.c1.rgb, u.c2.rgb, fi / 4.0);
      c = mix(c, u.c3.rgb, step(3.5, fi) * 0.6);
      col = mix(col, c, m * 0.5);
    }
  }
  col = col * (1.0 + 0.06 * u.energy * sin(u.time * 1.6));
  let vig = smoothstep(0.35, 1.25, length(p));
  col = mix(col, col * 0.86, vig);
  col = col + vec3f((hash(frag + fract(u.time * 7.0) * 100.0) - 0.5) * 0.022);
  return vec4f(col, 1.0);
}`;

export class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.backend = 'css';
    this.animate = true;
    this.colors = { bg: [0, 0, 0], c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0] };
    this.mode = 0;
    this.energy = 0;
    this.time = Math.random() * 100;
    this.last = 0;
    this.raf = 0;
    this.loop = this.loop.bind(this);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    window.addEventListener('resize', () => this.resize());
  }

  async init() {
    try {
      if (navigator.gpu && (await this.initWebGPU())) this.backend = 'webgpu';
    } catch (err) {
      console.warn('WebGPU indisponível, usando WebGL2.', err);
    }
    if (this.backend === 'css') {
      if (this.gpu) this.replaceCanvas();
      if (this.initWebGL2()) this.backend = 'webgl2';
    }
    document.documentElement.dataset.renderer = this.backend;
    if (this.backend === 'css') return this.backend;
    this.readTheme(false);
    this.resize();
    this.canvas.classList.add('is-on');
    this.start();
    return this.backend;
  }

  replaceCanvas() {
    const fresh = this.canvas.cloneNode();
    this.canvas.replaceWith(fresh);
    this.canvas = fresh;
    this.gpu = null;
  }

  async initWebGPU() {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    const ctx = this.canvas.getContext('webgpu');
    if (!ctx) return false;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    const module = device.createShaderModule({ code: WGSL });
    const info = await module.getCompilationInfo();
    if (info.messages.some((m) => m.type === 'error')) {
      console.warn('WGSL:', info.messages.map((m) => m.message).join('\n'));
      this.gpu = { device };
      return false;
    }
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const ubo = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }] });
    this.gpu = { device, ctx, pipeline, ubo, bind, data: new Float32Array(24) };
    device.lost.then(() => {
      this.backend = 'css';
      this.canvas.classList.remove('is-on');
    });
    return true;
  }

  initWebGL2() {
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, GLSL_VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, GLSL_FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = {};
      for (const n of ['uRes', 'uTime', 'uMode', 'uEnergy', 'uBg', 'uC1', 'uC2', 'uC3']) u[n] = gl.getUniformLocation(prog, n);
      this.gl = { gl, u };
      return true;
    } catch (err) {
      console.warn('WebGL2 indisponível.', err);
      return false;
    }
  }

  // Lê as cores do tema atual; com animate=true faz a transição suave entre temas.
  readTheme(animate = true) {
    const next = {
      bg: hexToRgb(cssVar('--fx-bg')),
      c1: hexToRgb(cssVar('--fx-1')),
      c2: hexToRgb(cssVar('--fx-2')),
      c3: hexToRgb(cssVar('--fx-3')),
    };
    this.mode = Number(cssVar('--fx-mode')) || 0;
    this.resize();
    if (animate && window.gsap && !reducedMotion()) {
      const from = structuredClone(this.colors);
      const prog = { p: 0 };
      this.themeTween?.kill();
      this.themeTween = window.gsap.to(prog, {
        p: 1,
        duration: 0.9,
        ease: 'power2.inOut',
        onUpdate: () => {
          for (const k of Object.keys(next)) this.colors[k] = from[k].map((v, i) => v + (next[k][i] - v) * prog.p);
          this.kick();
        },
      });
    } else {
      for (const k of Object.keys(next)) this.colors[k] = next[k];
    }
    this.draw();
  }

  setEnergy(v) {
    if (window.gsap) window.gsap.to(this, { energy: v, duration: 1.2, ease: 'power2.out', onUpdate: () => this.kick() });
    else this.energy = v;
  }

  setAnimate(on) {
    this.animate = on;
    if (on) this.start();
    else this.draw();
  }

  resize() {
    if (this.backend === 'css') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = dpr * (this.mode === 1 ? 0.9 : 0.5);
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.draw();
  }

  start() {
    if (this.backend === 'css' || this.raf || document.hidden) return;
    if (!this.animate || reducedMotion()) {
      this.draw();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // Redesenha um quadro quando a animação está parada (ex.: troca de tema).
  kick() {
    if (!this.raf) this.draw();
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = now - this.last;
    if (dt < 1000 / 30) return;
    this.last = now;
    this.time += Math.min(dt, 100) / 1000;
    this.draw();
    if (!this.animate || reducedMotion()) this.stop();
  }

  draw() {
    const { bg, c1, c2, c3 } = this.colors;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.backend === 'webgpu' && this.gpu?.ctx) {
      const { device, ctx, pipeline, ubo, bind, data } = this.gpu;
      data.set([w, h, this.time, this.mode, ...bg, 1, ...c1, 1, ...c2, 1, ...c3, 1, this.energy, 0, 0, 0]);
      device.queue.writeBuffer(ubo, 0, data);
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
    } else if (this.backend === 'webgl2' && this.gl) {
      const { gl, u } = this.gl;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uMode, this.mode);
      gl.uniform1f(u.uEnergy, this.energy);
      gl.uniform3fv(u.uBg, bg);
      gl.uniform3fv(u.uC1, c1);
      gl.uniform3fv(u.uC2, c2);
      gl.uniform3fv(u.uC3, c3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
}
