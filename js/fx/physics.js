// Bolhas de categorias com física (Matter.js): o tamanho de cada bolha é proporcional ao gasto.
import { cssVar, reducedMotion } from '../utils.js';

export class Bubbles {
  constructor({ onTap } = {}) {
    this.onTap = onTap;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.signature = '';
    this.raf = 0;
    this.w = 0;
    this.h = 0;
    this.tick = this.tick.bind(this);
  }

  mount(container, data) {
    const M = window.Matter;
    if (!M) return;
    this.container = container;
    container.prepend(this.canvas);
    if (!this.engine) this.setupEngine();
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    const sig = JSON.stringify(data.map((d) => [d.id, Math.round(d.value)]));
    if (sig !== this.signature) {
      this.signature = sig;
      this.data = data;
      this.buildBodies();
    }
    this.start();
  }

  setupEngine() {
    const { Engine, Mouse, MouseConstraint, Events, Composite } = window.Matter;
    this.engine = Engine.create();
    this.engine.gravity.y = 0;
    this.mouse = Mouse.create(this.canvas);
    for (const ev of ['mousewheel', 'DOMMouseScroll', 'wheel']) this.canvas.removeEventListener(ev, this.mouse.mousewheel);
    this.mc = MouseConstraint.create(this.engine, { mouse: this.mouse, constraint: { stiffness: 0.18, damping: 0.1, render: { visible: false } } });
    Composite.add(this.engine.world, this.mc);
    Events.on(this.mc, 'startdrag', (e) => {
      this.dragStart = { body: e.body, t: performance.now(), x: e.body.position.x, y: e.body.position.y };
    });
    Events.on(this.mc, 'enddrag', (e) => {
      const s = this.dragStart;
      if (s && s.body === e.body && performance.now() - s.t < 260 && Math.hypot(e.body.position.x - s.x, e.body.position.y - s.y) < 12) {
        this.onTap?.(e.body.meta);
      }
      this.dragStart = null;
    });
    Events.on(this.engine, 'beforeUpdate', () => {
      const cx = this.w / 2;
      const cy = this.h / 2;
      for (const b of this.bodies || []) {
        const k = 0.0000045 * b.mass;
        window.Matter.Body.applyForce(b, b.position, { x: (cx - b.position.x) * k, y: (cy - b.position.y) * k });
      }
    });
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const changed = Math.abs(r.width - this.w) > 1 || Math.abs(r.height - this.h) > 1;
    this.w = r.width;
    this.h = r.height;
    this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.mouse.pixelRatio = dpr;
    if (changed) this.buildWalls();
  }

  buildWalls() {
    const { Bodies, Composite } = window.Matter;
    if (this.walls) Composite.remove(this.engine.world, this.walls);
    const t = 200;
    const { w, h } = this;
    const opts = { isStatic: true };
    this.walls = [
      Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, opts),
      Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, opts),
      Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, opts),
      Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, opts),
    ];
    Composite.add(this.engine.world, this.walls);
  }

  buildBodies() {
    const { Bodies, Composite, Body } = window.Matter;
    if (this.bodies) Composite.remove(this.engine.world, this.bodies);
    const total = this.data.reduce((s, d) => s + d.value, 0) || 1;
    const area = this.w * this.h * 0.42;
    const maxR = Math.min(this.w, this.h) * 0.3;
    this.bodies = this.data.map((d, i) => {
      const r = Math.max(20, Math.min(maxR, Math.sqrt(((d.value / total) * area) / Math.PI)));
      const ang = i * 2.4;
      const dist = 20 + i * 14;
      const b = Bodies.circle(this.w / 2 + Math.cos(ang) * dist, this.h / 2 + Math.sin(ang) * dist * 0.6, r, {
        restitution: 0.55,
        frictionAir: 0.06,
        friction: 0.02,
      });
      b.meta = { ...d, pct: d.value / total };
      b.r = r;
      b.grow = reducedMotion() ? 1 : 0;
      Body.setVelocity(b, { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 });
      return b;
    });
    Composite.add(this.engine.world, this.bodies);
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  tick() {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.canvas.isConnected) return this.stop();
    window.Matter.Engine.update(this.engine, 1000 / 60);
    this.draw();
  }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const textColor = '#fff';
    const font = cssVar('--font-display') || 'serif';
    for (const b of this.bodies || []) {
      b.grow = Math.min(1, b.grow + 0.045);
      const e = 1 - Math.pow(1 - b.grow, 3);
      const r = b.r * e;
      const { x, y } = b.position;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, shade(b.meta.color, 0.18));
      g.addColorStop(1, b.meta.color);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(r * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
      ctx.fillText(b.meta.emoji, x, y - (r > 34 ? r * 0.16 : 0));
      if (r > 34) {
        ctx.fillStyle = textColor;
        ctx.font = `700 ${Math.max(11, Math.round(r * 0.26))}px ${font}`;
        ctx.fillText(`${Math.round(b.meta.pct * 100)}%`, x, y + r * 0.42);
      }
    }
  }

  destroy() {
    this.stop();
    this.ro?.disconnect();
    this.canvas.remove();
  }
}

function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// Efeito de "queda": o título de uma tarefa concluída cai pela tela com física.
let fall = null;

export function dropText(rect, text) {
  const M = window.Matter;
  if (!M || reducedMotion()) return;
  const canvas = document.getElementById('fall-canvas');
  if (!fall) {
    const engine = M.Engine.create();
    engine.gravity.y = 1.1;
    fall = { engine, canvas, ctx: canvas.getContext('2d'), items: [], raf: 0 };
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  const w = Math.min(rect.width, 320);
  const h = Math.max(36, Math.min(rect.height, 56));
  const body = M.Bodies.rectangle(rect.left + w / 2, rect.top + rect.height / 2, w, h, { frictionAir: 0.01 });
  M.Body.setVelocity(body, { x: (Math.random() - 0.3) * 4, y: -6 });
  M.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12);
  body.kind = 'label';
  body.w = w;
  body.h = h;
  body.text = text;
  const colors = [cssVar('--accent'), cssVar('--accent-2'), cssVar('--success')];
  const bits = Array.from({ length: 14 }, (_, i) => {
    const b = M.Bodies.circle(rect.left + 30 + Math.random() * w * 0.8, rect.top + rect.height / 2, 3 + Math.random() * 4, { frictionAir: 0.02 });
    M.Body.setVelocity(b, { x: (Math.random() - 0.5) * 10, y: -6 - Math.random() * 8 });
    b.kind = 'bit';
    b.color = colors[i % colors.length];
    return b;
  });
  M.Composite.add(fall.engine.world, [body, ...bits]);
  fall.items.push(body, ...bits);

  if (!fall.raf) {
    const step = () => {
      const { ctx, engine } = fall;
      M.Engine.update(engine, 1000 / 60);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const surface = cssVar('--surface-solid');
      const text = cssVar('--text');
      const accent = cssVar('--accent');
      const font = cssVar('--font-display');
      fall.items = fall.items.filter((b) => {
        if (b.position.y > window.innerHeight + 200) {
          M.Composite.remove(engine.world, b);
          return false;
        }
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        if (b.kind === 'label') {
          ctx.fillStyle = surface;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 14);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = text;
          ctx.font = `600 15px ${font}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`✓ ${b.text}`.slice(0, 34), 0, 1, b.w - 20);
        } else {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(0, 0, b.circleRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });
      if (fall.items.length) fall.raf = requestAnimationFrame(step);
      else {
        fall.raf = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    fall.raf = requestAnimationFrame(step);
  }
}
