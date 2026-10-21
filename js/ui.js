import { esc, moneyInput, reducedMotion } from './utils.js';
import { icon } from './icons.js';

const gsap = () => window.gsap;
const motion = () => !reducedMotion() && !!window.gsap;

// ---------- Bottom sheet ----------
const dialog = () => document.getElementById('sheet');
let closing = false;

export function openSheet({ title, body, onSubmit, submitLabel = 'Salvar', extra = '', onOpen, wide = false }) {
  const dlg = dialog();
  window.gsap?.killTweensOf(dlg);
  if (dlg.open) dlg.close();
  const inner = onSubmit
    ? `<form class="form" novalidate>${body}<div class="sheet__actions">${extra}<button type="submit" class="btn btn--primary">${esc(submitLabel)}</button></div></form>`
    : body;
  dlg.innerHTML = `<div class="sheet__inner"><div class="sheet__grab"></div>
    <div class="sheet__head"><h2>${esc(title)}</h2><button type="button" class="icon-btn icon-btn--plain" data-close aria-label="Fechar">${icon('x')}</button></div>
    ${inner}</div>`;
  dlg.style.width = wide ? 'min(760px, 100%)' : '';
  dlg.showModal();
  closing = false;

  const panel = dlg.querySelector('.sheet__inner');
  if (motion()) gsap().fromTo(dlg, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out' });

  const form = dlg.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = readForm(form);
      const ok = await onSubmit(values, form);
      if (ok !== false) closeSheet();
    });
    const first = form.querySelector('input:not([type=hidden]):not([type=radio]), textarea');
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  }
  dlg.querySelector('[data-close]').addEventListener('click', closeSheet);
  onOpen?.(panel, dlg);
  return panel;
}

export function closeSheet() {
  const dlg = dialog();
  if (!dlg.open || closing) return;
  closing = true;
  const done = () => {
    dlg.close();
    dlg.innerHTML = '';
    closing = false;
  };
  if (motion()) gsap().to(dlg, { y: 60, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: done });
  else done();
}

export function initSheet() {
  const dlg = dialog();
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeSheet();
  });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSheet();
  });
}

export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'submit') continue;
    if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else if (el.type === 'checkbox') {
      out[el.name] = el.checked;
    } else {
      out[el.name] = el.value.trim();
    }
  }
  return out;
}

// ---------- Campos de formulário ----------
function fieldHTML(f) {
  const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  const v = f.value ?? '';
  let control = '';
  switch (f.type) {
    case 'hidden':
      return `<input type="hidden" name="${f.name}" value="${esc(v)}">`;
    case 'money':
      control = `<input id="${id}" name="${f.name}" type="text" inputmode="decimal" autocomplete="off" ${req} placeholder="0,00" value="${esc(moneyInput(v))}">`;
      break;
    case 'textarea':
      control = `<textarea id="${id}" name="${f.name}" ${req} ${ph}>${esc(v)}</textarea>`;
      break;
    case 'select':
      control = `<select id="${id}" name="${f.name}" ${req}>${f.options
        .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`)
        .join('')}</select>`;
      break;
    case 'radio':
      return `<div class="field"><span>${esc(f.label)}</span><div class="radio-chips">${f.options
        .map((o, i) => {
          const rid = `${id}-${i}`;
          return `<input type="radio" id="${rid}" name="${f.name}" value="${esc(o.value)}" ${String(o.value) === String(v) ? 'checked' : ''}><label for="${rid}">${esc(o.label)}</label>`;
        })
        .join('')}</div></div>`;
    default:
      control = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" ${req} ${ph} value="${esc(v)}" ${f.attrs || ''}>`;
  }
  return `<label class="field" for="${id}"><span>${esc(f.label)}</span>${control}</label>`;
}

export function fields(defs) {
  return defs.map((d) => (Array.isArray(d) ? `<div class="field-row">${d.map(fieldHTML).join('')}</div>` : fieldHTML(d))).join('');
}

export function invalid(form, name, message) {
  const el = form.elements[name];
  toast(message, { icon: '⚠️' });
  if (el?.focus) el.focus();
  if (el && motion()) gsap().fromTo(el, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
  return false;
}

// ---------- Confirmação ----------
export function confirmSheet(message, { okLabel = 'Confirmar', danger = true, title = 'Tem certeza?' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="muted" style="margin-bottom:18px">${esc(message)}</p>
        <div class="sheet__actions"><button type="button" class="btn" data-no>Cancelar</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${esc(okLabel)}</button></div>`,
      onOpen(panel, dlg) {
        const finish = (v) => {
          if (answered) return;
          answered = true;
          resolve(v);
          closeSheet();
        };
        panel.querySelector('[data-yes]').addEventListener('click', () => finish(true));
        panel.querySelector('[data-no]').addEventListener('click', () => finish(false));
        dlg.addEventListener('close', () => finish(false), { once: true });
      },
    });
  });
}

// ---------- Toasts ----------
export function toast(message, { icon: emoji = '✓', action, timeout = 3200 } = {}) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast__icon">${esc(emoji)}</span><span>${esc(message)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn btn--soft btn--sm';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      action.onClick();
      remove();
    });
    el.append(b);
  }
  box.append(el);
  if (motion()) gsap().fromTo(el, { y: -24, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' });
  function remove() {
    if (!el.isConnected) return;
    if (motion()) gsap().to(el, { y: -16, opacity: 0, duration: 0.25, onComplete: () => el.remove() });
    else el.remove();
  }
  setTimeout(remove, timeout);
}

// ---------- Segmented control ----------
export function segHTML(options, active, name = 'seg') {
  return `<div class="seg" role="tablist" data-seg="${name}"><span class="seg__pill"></span>${options
    .map((o) => `<button type="button" role="tab" class="seg__btn ${o.value === active ? 'is-active' : ''}" aria-selected="${o.value === active}" data-val="${esc(o.value)}">${esc(o.label)}</button>`)
    .join('')}</div>`;
}

export function bindSeg(root, name, onChange) {
  const seg = root.querySelector(`[data-seg="${name}"]`);
  if (!seg) return;
  const pill = seg.querySelector('.seg__pill');
  const place = (btn, animate) => {
    const props = { x: btn.offsetLeft, width: btn.offsetWidth };
    if (animate && motion()) gsap().to(pill, { ...props, duration: 0.45, ease: 'power3.out' });
    else Object.assign(pill.style, { transform: `translateX(${props.x}px)`, width: `${props.width}px` });
  };
  requestAnimationFrame(() => {
    const active = seg.querySelector('.is-active');
    if (active) place(active, false);
  });
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg__btn');
    if (!btn || btn.classList.contains('is-active')) return;
    seg.querySelectorAll('.seg__btn').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn);
    });
    place(btn, true);
    onChange(btn.dataset.val);
  });
}

// ---------- Efeitos de entrada ----------
export function animateIn(root) {
  if (!motion()) return;
  const items = root.querySelectorAll(':scope > *, .grid > .card, .list > .item');
  gsap().fromTo(
    items,
    { y: 16, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: { each: 0.035, amount: 0.4 }, clearProps: 'transform,opacity' },
  );
}

export function pop(el) {
  if (motion() && el) gsap().fromTo(el, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
}

// Spotlight dos cards: segue o ponteiro
export function initSpotlight() {
  document.addEventListener(
    'pointermove',
    (e) => {
      const card = e.target.closest?.('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

export function emptyState(emoji, title, text = '') {
  return `<div class="empty"><span class="empty__emoji">${emoji}</span><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
}
