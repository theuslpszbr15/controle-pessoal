import { commit, dadosLocaisAntigos, flushNow, load, state, subscribe } from './store.js';
import { aguardarSessao, boasVindas, sair, telaLogin, usuarioAtual } from './auth.js';
import { icon } from './icons.js';
import { textMorph } from './textmorph.js';
import { animateIn, closeSheet, initSheet, initSpotlight, openSheet, toast } from './ui.js';
import { TEMAS, applyTheme, temaAtual } from './themes.js';
import { shared } from './shared.js';
import { Background } from './fx/background.js';
import { esc } from './utils.js';

import inicio from './modules/inicio.js';
import financas, { openTransaction } from './modules/financas.js';
import metas, { openGoal } from './modules/metas.js';
import contas, { openBill } from './modules/contas.js';
import tarefas, { openTask } from './modules/tarefas.js';
import habitos, { openHabit } from './modules/habitos.js';
import agenda, { openEvent } from './modules/agenda.js';
import compras, { openItem } from './modules/compras.js';
import notas, { openNote } from './modules/notas.js';
import foco from './modules/foco.js';
import ajustes, { verifyPin } from './modules/ajustes.js';

const MODULES = [inicio, financas, metas, contas, tarefas, habitos, agenda, compras, notas, foco, ajustes];
const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
const TABS = ['inicio', 'financas', 'tarefas'];

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
let current = null;
let cleanup = null;
let pending = null;

const ctx = {
  refresh: (animate = false) => schedule(animate),
  go: (id) => {
    location.hash = `#/${id}`;
  },
};

function schedule(animate) {
  if (pending) {
    pending.animate ||= animate;
    return;
  }
  pending = { animate };
  requestAnimationFrame(() => {
    const { animate: a } = pending;
    pending = null;
    render(a);
  });
}

function render(animate) {
  if (!current) return;
  const active = document.activeElement;
  const keep = active?.dataset?.keep;
  const caret = keep && 'selectionStart' in active ? active.selectionStart : null;
  try {
    cleanup?.();
  } catch (err) {
    console.error(err);
  }
  const page = document.createElement('div');
  page.className = 'page';
  viewEl.replaceChildren(page);
  const r = current.render(page, ctx);
  cleanup = typeof r === 'function' ? r : null;
  if (keep) {
    const el = page.querySelector(`[data-keep="${keep}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret !== null && el.setSelectionRange && el.type !== 'number') {
        try {
          el.setSelectionRange(caret, caret);
        } catch {
          /* tipos sem seleção */
        }
      }
    }
  }
  if (animate) animateIn(page);
}

function route() {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0] || 'inicio';
  const mod = byId[id] || inicio;
  const changed = mod !== current;
  current = mod;
  textMorph(titleEl, mod.title);
  document.title = mod.id === 'inicio' ? 'Controle Pessoal' : `${mod.title} · Controle Pessoal`;
  updateNav();
  closeSheet();
  if (changed) window.scrollTo({ top: 0 });
  render(true);
}

// ---------- Navegação ----------
function buildNav() {
  document.getElementById('sidebar-links').innerHTML = MODULES.map(
    (m) => `<a class="sidebar__link" href="#/${m.id}" data-nav="${m.id}">${icon(m.icon)}<span>${esc(m.title)}</span></a>`,
  ).join('');

  const tab = (m) => `<a class="tabbar__item" href="#/${m.id}" data-nav="${m.id}">${icon(m.icon)}<span>${esc(m.title)}</span></a>`;
  document.getElementById('tabbar').innerHTML = `<span class="tabbar__pill"></span>
    ${tab(inicio)}${tab(financas)}
    <div class="tabbar__fab-slot"><button class="fab" data-fab aria-label="Adicionar">${icon('plus')}</button></div>
    ${tab(tarefas)}
    <button class="tabbar__item" data-menu>${icon('grid')}<span>Mais</span></button>`;

  document.querySelectorAll('[data-fab]').forEach((b) => b.addEventListener('click', openQuickAdd));
  document.querySelector('[data-menu]').addEventListener('click', openMenu);
  document.getElementById('theme-btn').addEventListener('click', openThemes);
  window.addEventListener('resize', () => updateNav(false));
}

function updateNav(animate = true) {
  if (!current) return;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === current.id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const menuBtn = document.querySelector('[data-menu]');
  menuBtn.classList.toggle('is-active', !TABS.includes(current.id));
  const target = TABS.includes(current.id) ? document.querySelector(`.tabbar [data-nav="${current.id}"]`) : menuBtn;
  const pill = document.querySelector('.tabbar__pill');
  if (!target || !pill || !target.offsetWidth) return;
  const w = Math.min(target.offsetWidth - 12, 76);
  const x = target.offsetLeft + (target.offsetWidth - w) / 2;
  if (animate && window.gsap) window.gsap.to(pill, { x, width: w, duration: 0.5, ease: 'power3.out' });
  else Object.assign(pill.style, { width: `${w}px`, transform: `translateX(${x}px)` });
}

function openMenu() {
  openSheet({
    title: 'Tudo',
    body: `<nav class="menu-grid">${MODULES.map((m) => `<a href="#/${m.id}" class="${m.id === current?.id ? 'is-active' : ''}">${icon(m.icon)}${esc(m.title)}</a>`).join('')}</nav>`,
    onOpen(panel) {
      panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeSheet));
    },
  });
}

function openQuickAdd() {
  const acoes = [
    ['gasto', '🧾', 'Gasto', () => openTransaction({ tipo: 'despesa' })],
    ['receita', '💰', 'Receita', () => openTransaction({ tipo: 'receita' })],
    ['tarefa', '📝', 'Tarefa', () => openTask()],
    ['evento', '📅', 'Compromisso', () => openEvent()],
    ['nota', '🗒️', 'Nota', () => openNote()],
    ['item', '🛒', 'Item de compra', () => openItem()],
    ['conta', '💡', 'Conta fixa', () => openBill()],
    ['habito', '🌱', 'Hábito', () => openHabit()],
    ['meta', '🫙', 'Meta', () => openGoal()],
  ];
  openSheet({
    title: 'Adicionar',
    body: `<div class="menu-grid">${acoes.map(([k, e, l]) => `<a href="#" data-acao="${k}"><span style="font-size:1.6rem">${e}</span>${esc(l)}</a>`).join('')}</div>`,
    onOpen(panel) {
      panel.addEventListener('click', (ev) => {
        const a = ev.target.closest('[data-acao]');
        if (!a) return;
        ev.preventDefault();
        const acao = acoes.find((x) => x[0] === a.dataset.acao);
        if (acao[0] === 'item' && !state.listas.length) {
          closeSheet();
          ctx.go('compras');
          return;
        }
        acao[3]();
      });
    },
  });
}

function openThemes() {
  openSheet({
    title: 'Escolha um tema',
    wide: true,
    body: `<div class="themes">${TEMAS.map((t) => `<button class="theme-card ${t.id === state.settings.tema ? 'is-active' : ''}" data-theme="${t.id}" data-tema="${t.id}">
      <div class="theme-card__preview"><i style="background:var(--accent)"></i><i style="background:var(--accent-2)"></i></div>
      <strong>${t.emoji} ${esc(t.nome)}</strong><small>${esc(t.desc)}</small></button>`).join('')}</div>`,
    onOpen(panel) {
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tema]');
        if (!b) return;
        state.settings.tema = b.dataset.tema;
        commit('settings');
        applyTheme(b.dataset.tema);
        panel.querySelectorAll('[data-tema]').forEach((x) => x.classList.toggle('is-active', x === b));
      });
    },
  });
}

// ---------- Bloqueio por PIN ----------
let hiddenAt = 0;
let locking = null;

function lock() {
  if (!state.settings.pinHash) return Promise.resolve();
  if (locking) return locking;
  buildLock();
  const el = document.getElementById('lock');
  el.hidden = false;
  closeSheet();
  let pin = '';
  const dots = el.querySelector('.lock__dots');
  const draw = () => {
    dots.innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'is-on' : ''}"></i>`).join('');
  };
  draw();
  return (locking = new Promise((resolve) => {
    let checking = false;
    const press = async (k) => {
      if (checking) return;
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 8) pin += k;
      draw();
      if (pin.length >= 4) {
        checking = true;
        const ok = await verifyPin(pin);
        checking = false;
        if (ok) {
          finish();
        } else if (pin.length === 8) {
          if (window.gsap) window.gsap.fromTo(dots, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
          pin = '';
          draw();
        }
      }
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-k]');
      if (b) press(b.dataset.k);
    };
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    function finish() {
      el.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      if (window.gsap) window.gsap.to(el, { opacity: 0, duration: 0.3, onComplete: () => { el.hidden = true; el.style.opacity = ''; } });
      else el.hidden = true;
      locking = null;
      resolve();
    }
    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  }));
}

function buildLock() {
  const el = document.getElementById('lock');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  el.innerHTML = `<span style="font-size:2.4rem">${temaAtual().emoji}</span><h2>Digite seu PIN</h2><div class="lock__dots"></div>
    <div class="lock__pad">${keys.map((k) => (k ? `<button data-k="${k}" aria-label="${k === 'del' ? 'Apagar' : k}">${k === 'del' ? '⌫' : k}</button>` : '<span></span>')).join('')}</div>
    <button class="btn btn--ghost btn--sm" data-esqueci>Esqueci o PIN (entrar com a senha)</button>`;
  el.querySelector('[data-esqueci]').addEventListener('click', async () => {
    await sair();
    location.reload();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (state.settings.pinHash && hiddenAt && Date.now() - hiddenAt > 60000) lock();
});

// ---------- Service worker (offline + atualização automática) ----------
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const tinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting) reg.waiting.postMessage('skipWaiting');
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (reloaded || !tinhaControle) return;
    reloaded = true;
    await flushNow();
    location.reload();
  });
}

// ---------- Inicialização ----------
async function boot() {
  applyTheme(localStorage.getItem('cp:tema') || 'ametista', false);
  shared.router = { onTheme: () => MODULES.forEach((m) => m.onTheme?.()) };
  const bg = new Background(document.getElementById('bg-canvas'));
  shared.bg = bg;
  bg.init();
  registerSW();

  let user = await aguardarSessao();
  const viaSessao = !!user;
  let nomeLogin = user?.displayName;
  if (!user) ({ user, nome: nomeLogin } = await telaLogin());

  const carga = await load(user.uid);
  if (carga.vazio && !carga.doCache) {
    const antigos = await dadosLocaisAntigos(usuarioAtual().usuario);
    if (antigos) {
      Object.assign(state, antigos);
      commit(...Object.keys(antigos));
      toast('Seus dados deste aparelho foram enviados para a nuvem', { icon: '☁️', timeout: 5000 });
    }
  }
  if (!state.settings.nome) {
    state.settings.nome = nomeLogin || usuarioAtual().nome;
    commit('settings');
  }
  applyTheme(state.settings.tema, !viaSessao);
  bg.setAnimate(state.settings.fundoAnimado);
  const unlocked = viaSessao ? lock() : Promise.resolve();

  if (!viaSessao) await boasVindas(state.settings.nome);
  document.body.classList.remove('is-auth');

  initSheet();
  initSpotlight();
  buildNav();
  subscribe((keys, origem) => {
    if (origem === 'nuvem' && keys.includes('settings')) applyTheme(state.settings.tema);
    schedule(false);
  });
  window.addEventListener('hashchange', route);
  route();
  document.getElementById('today').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());

  await unlocked;
  const acao = new URLSearchParams(location.search).get('acao');
  if (acao) {
    history.replaceState(null, '', location.pathname + location.hash);
    if (acao === 'gasto') openTransaction({ tipo: 'despesa' });
    else if (acao === 'tarefa') openTask();
    else if (acao === 'nota') openNote();
  }
}

boot();
