// Text morph: duas camadas de texto com blur cruzado; o filtro SVG de limiar (#tm-threshold)
// transforma o borrão em formas nítidas, dando a sensação de uma palavra "derreter" na outra.
import { reducedMotion } from './utils.js';

const registry = new WeakMap();

export function textMorph(el, text, { duration = 0.85 } = {}) {
  let inst = registry.get(el);
  if (!inst) {
    el.classList.add('tm');
    el.innerHTML = '<span class="tm__a"></span><span class="tm__b" aria-hidden="true"></span>';
    inst = { a: el.querySelector('.tm__a'), b: el.querySelector('.tm__b'), tween: null, text: '' };
    inst.a.textContent = text;
    inst.text = text;
    inst.b.style.opacity = '0';
    registry.set(el, inst);
    return;
  }
  if (inst.text === text) return;
  inst.tween?.kill();

  const from = inst.text;
  inst.text = text;
  if (reducedMotion() || !window.gsap) {
    inst.a.textContent = text;
    return;
  }

  inst.a.textContent = from;
  inst.b.textContent = text;
  el.setAttribute('aria-label', text);
  el.classList.add('is-morphing');

  const p = { f: 0 };
  const apply = () => {
    const f = Math.max(p.f, 0.0001);
    const g = Math.max(1 - p.f, 0.0001);
    inst.b.style.filter = `blur(${Math.min(8 / f - 8, 100)}px)`;
    inst.b.style.opacity = `${Math.pow(f, 0.4)}`;
    inst.a.style.filter = `blur(${Math.min(8 / g - 8, 100)}px)`;
    inst.a.style.opacity = `${Math.pow(g, 0.4)}`;
  };

  inst.tween = window.gsap.to(p, {
    f: 1,
    duration,
    ease: 'sine.inOut',
    onUpdate: apply,
    onComplete: () => {
      inst.a.textContent = text;
      inst.a.style.filter = '';
      inst.a.style.opacity = '1';
      inst.b.style.filter = '';
      inst.b.style.opacity = '0';
      inst.b.textContent = '';
      el.classList.remove('is-morphing');
      el.removeAttribute('aria-label');
    },
  });
}

// Alterna entre várias frases em loop (usado na saudação do Início).
export function morphCycle(el, texts, interval = 4200) {
  let i = 0;
  textMorph(el, texts[0]);
  if (texts.length < 2) return () => {};
  const id = setInterval(() => {
    if (!el.isConnected) return clearInterval(id);
    i = (i + 1) % texts.length;
    textMorph(el, texts[i]);
  }, interval);
  return () => clearInterval(id);
}

// Contador animado para valores (number ticker). Lembra o último valor por chave entre re-renderizações.
const lastValues = new Map();
export function countTo(el, value, format, { duration = 1, key = el.dataset.count } = {}) {
  const prev = key && lastValues.has(key) ? lastValues.get(key) : 0;
  if (key) lastValues.set(key, value);
  if (reducedMotion() || !window.gsap || prev === value) {
    el.textContent = format(value);
    return;
  }
  const o = { v: prev };
  window.gsap.to(o, { v: value, duration, ease: 'power3.out', onUpdate: () => (el.textContent = format(o.v)) });
}
