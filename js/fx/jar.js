// Pote de moedas 3D (Three.js): enche conforme o progresso da meta selecionada.
import * as THREE from '../../vendor/three.module.min.js';
import { cssVar, reducedMotion } from '../utils.js';

const MAX_COINS = 216;
const PER_LAYER = 8;
const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class Jar {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 2.3, 7.4);
    this.camera.lookAt(0, 1.6, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const profile = [
      [0, 0], [0.92, 0], [1.02, 0.06], [1.08, 0.3], [1.1, 1.6], [1.06, 1.95], [0.86, 2.2], [0.76, 2.3], [0.76, 2.46],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const glassGeo = new THREE.LatheGeometry(profile, 64);
    this.glass = new THREE.Mesh(
      glassGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }),
    );
    this.glass.renderOrder = 2;
    this.group.add(this.glass);

    this.rimMat = new THREE.MeshStandardMaterial({ color: 0xa48bd9, roughness: 0.4, metalness: 0.3 });
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 16, 64), this.rimMat);
    lid.rotation.x = Math.PI / 2;
    lid.position.y = 2.46;
    this.group.add(lid);
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 12, 64), this.rimMat);
    base.rotation.x = Math.PI / 2;
    base.position.y = 0.04;
    this.group.add(base);

    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 32);
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xe0b95f, roughness: 0.38, metalness: 0.35, emissive: 0x2a1c05 });
    this.coins = new THREE.InstancedMesh(coinGeo, this.coinMat, MAX_COINS);
    this.coins.count = 0;
    this.group.add(this.coins);

    // Posição final de cada moeda (pilha determinística)
    this.slots = Array.from({ length: MAX_COINS }, (_, i) => {
      const layer = Math.floor(i / PER_LAYER);
      const a = i * 2.39996 + layer * 0.5;
      const rr = 0.12 + rand(i) * 0.55;
      return {
        x: Math.cos(a) * rr,
        z: Math.sin(a) * rr,
        y: 0.08 + layer * 0.078 + rand(i + 7) * 0.03,
        rx: (rand(i + 3) - 0.5) * 0.5,
        rz: (rand(i + 5) - 0.5) * 0.5,
        cur: 0,
      };
    });
    this.dummy = new THREE.Object3D();
    this.shown = 0;
    this.raf = 0;
    this.loop = this.loop.bind(this);
  }

  mount(container) {
    this.container = container;
    container.prepend(this.renderer.domElement);
    this.ro?.disconnect();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.applyTheme();
    this.start();
  }

  applyTheme() {
    this.rimMat.color.set(cssVar('--accent') || '#a48bd9');
  }

  resize() {
    const r = this.container.getBoundingClientRect();
    if (!r.width) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }

  setProgress(p) {
    const target = Math.round(Math.max(0, Math.min(1, p)) * MAX_COINS);
    const from = this.shown;
    this.shown = target;
    const animate = !reducedMotion() && window.gsap && target > from;
    for (let i = 0; i < MAX_COINS; i++) {
      const s = this.slots[i];
      window.gsap?.killTweensOf(s);
      if (i >= target) s.cur = 0;
      else if (i < from || !animate || i < target - 48) s.cur = 1;
      else {
        s.cur = 0;
        window.gsap.to(s, { cur: 1, duration: 0.9, ease: 'bounce.out', delay: (i - Math.max(from, target - 48)) * 0.025 });
      }
    }
    this.coins.count = target;
  }

  updateCoins() {
    const d = this.dummy;
    for (let i = 0; i < this.coins.count; i++) {
      const s = this.slots[i];
      const fallY = 3.4 + (i % 5) * 0.2;
      d.position.set(s.x, fallY + (s.y - fallY) * s.cur, s.z);
      d.rotation.set(s.rx + (1 - s.cur) * 2.5, i * 0.7, s.rz);
      d.updateMatrix();
      this.coins.setMatrixAt(i, d.matrix);
    }
    this.coins.instanceMatrix.needsUpdate = true;
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  loop(t) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.renderer.domElement.isConnected) return this.stop();
    if (!reducedMotion()) this.group.rotation.y = Math.sin(t / 3000) * 0.5;
    this.updateCoins();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.stop();
    this.ro?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
