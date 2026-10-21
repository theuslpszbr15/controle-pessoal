import { state, commit } from '../store.js';
import { addDays, esc, pad, sum, toISO, todayISO, weekdayShort } from '../utils.js';
import { icon } from '../icons.js';
import { bindSeg, fields, invalid, openSheet, segHTML, toast } from '../ui.js';
import { textMorph } from '../textmorph.js';
import { shared } from '../shared.js';
import { growBars } from './financas.js';

const FASES = { foco: 'Foco', pausa: 'Pausa curta', longa: 'Pausa longa' };
const SONS = [
  { value: 'nenhum', label: '🔇 Silêncio' },
  { value: 'chuva', label: '🌧️ Chuva' },
  { value: 'marrom', label: '🟤 Ruído marrom' },
  { value: 'ondas', label: '🌊 Ondas' },
];

const timer = { fase: 'foco', rodando: false, fimEm: 0, restante: 0, total: 0, ciclos: 0, iniciado: false };
let interval = 0;
let audio = null;

const duracao = (fase) => (Number(state.settings.foco[fase]) || 25) * 60;

function prepararFase(fase) {
  timer.fase = fase;
  timer.total = duracao(fase);
  timer.restante = timer.total;
  timer.rodando = false;
  timer.iniciado = true;
}

export const focoHoje = () => sum(state.focoSessoes.filter((s) => s.data === todayISO()), (s) => s.minutos);
export const timerRodando = () => timer.rodando;

function fmt(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

function iniciar() {
  if (!timer.iniciado) prepararFase('foco');
  timer.rodando = true;
  timer.fimEm = Date.now() + timer.restante * 1000;
  clearInterval(interval);
  interval = setInterval(tick, 250);
  document.body.classList.toggle('is-focusing', timer.fase === 'foco');
  shared.bg?.setEnergy(timer.fase === 'foco' ? 1 : 0.4);
  somLigar();
  atualizarView();
}

function pausar() {
  timer.restante = Math.max(0, (timer.fimEm - Date.now()) / 1000);
  timer.rodando = false;
  clearInterval(interval);
  document.body.classList.remove('is-focusing');
  shared.bg?.setEnergy(0);
  somDesligar();
  atualizarView();
}

function reiniciar() {
  pausar();
  prepararFase(timer.fase);
  atualizarView();
}

function tick() {
  timer.restante = Math.max(0, (timer.fimEm - Date.now()) / 1000);
  if (timer.restante <= 0) return concluirFase();
  atualizarView(false);
}

function concluirFase() {
  const fase = timer.fase;
  pausar();
  chime();
  navigator.vibrate?.([200, 100, 200]);
  if (fase === 'foco') {
    timer.ciclos++;
    state.focoSessoes.push({ data: todayISO(), minutos: Math.round(timer.total / 60), fim: new Date().toISOString() });
    commit('focoSessoes');
    toast('Sessão de foco concluída! Hora da pausa.', { icon: '🍅', timeout: 6000 });
    prepararFase(timer.ciclos % 4 === 0 ? 'longa' : 'pausa');
  } else {
    toast('Pausa encerrada. Bora focar?', { icon: '⏰', timeout: 6000 });
    prepararFase('foco');
  }
  atualizarView();
}

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.8);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.9);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* sem áudio */
  }
}

// Sons ambiente gerados com Web Audio (sem arquivos)
function somLigar() {
  somDesligar();
  const tipo = state.settings.foco.som;
  if (!tipo || tipo === 'nenhum') return;
  const ctx = new AudioContext();
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (tipo === 'chuva') d[i] = white * 0.5;
    else {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo === 'chuva' ? 'bandpass' : 'lowpass';
  filtro.frequency.value = tipo === 'chuva' ? 1400 : 600;
  filtro.Q.value = tipo === 'chuva' ? 0.6 : 0.7;
  const gain = ctx.createGain();
  gain.gain.value = tipo === 'chuva' ? 0.35 : 0.5;
  src.connect(filtro).connect(gain).connect(ctx.destination);
  if (tipo === 'ondas') {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
  }
  src.start();
  audio = ctx;
}

function somDesligar() {
  audio?.close();
  audio = null;
}

function atualizarView(full = true) {
  const root = document.querySelector('[data-timer]');
  if (!root) return;
  const time = root.querySelector('[data-time]');
  time.textContent = fmt(timer.restante);
  const prog = root.querySelector('.prog');
  const C = 2 * Math.PI * 130;
  const p = timer.total ? 1 - timer.restante / timer.total : 0;
  prog.style.strokeDasharray = `${C}`;
  prog.style.strokeDashoffset = `${C * (1 - p)}`;
  document.title = timer.rodando ? `${fmt(timer.restante)} · ${FASES[timer.fase]}` : 'Controle Pessoal';
  if (!full) return;
  textMorph(root.querySelector('[data-fase]'), FASES[timer.fase]);
  const play = root.querySelector('[data-play]');
  play.innerHTML = timer.rodando ? `${icon('pause')} Pausar` : `${icon('play')} ${timer.restante < timer.total ? 'Continuar' : 'Começar'}`;
}

function openConfig() {
  const f = state.settings.foco;
  openSheet({
    title: 'Durações (minutos)',
    body: fields([
      [
        { name: 'foco', label: 'Foco', type: 'number', value: f.foco, attrs: 'min="1" max="180" inputmode="numeric"' },
        { name: 'pausa', label: 'Pausa curta', type: 'number', value: f.pausa, attrs: 'min="1" max="60" inputmode="numeric"' },
      ],
      { name: 'longa', label: 'Pausa longa (a cada 4 ciclos)', type: 'number', value: f.longa, attrs: 'min="1" max="90" inputmode="numeric"' },
    ]),
    onSubmit(v, form) {
      for (const k of ['foco', 'pausa', 'longa']) {
        const n = Number(v[k]);
        if (!(n >= 1 && n <= 180)) return invalid(form, k, 'Use valores entre 1 e 180 minutos.');
        f[k] = n;
      }
      commit('settings');
      if (!timer.rodando) prepararFase(timer.fase);
      toast('Durações salvas', { icon: '⏱️' });
    },
  });
}

export default {
  id: 'foco',
  title: 'Foco',
  icon: 'clock',
  render(view) {
    if (!timer.iniciado) prepararFase('foco');
    const dias = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
    const mins = dias.map((d) => sum(state.focoSessoes.filter((s) => s.data === toISO(d)), (s) => s.minutos));
    const max = Math.max(25, ...mins);
    const sessoesHoje = state.focoSessoes.filter((s) => s.data === todayISO()).length;

    view.innerHTML = `
      <section class="card card--accent beam" data-timer>
        <div style="text-align:center">${segHTML(Object.entries(FASES).map(([value, label]) => ({ value, label })), timer.fase, 'fase')}</div>
        <div class="timer">
          <div class="timer__ring">
            <svg viewBox="0 0 280 280"><circle class="track" cx="140" cy="140" r="130"/><circle class="prog" cx="140" cy="140" r="130"/></svg>
            <div class="timer__center"><span class="muted small" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase" data-fase></span>
              <span class="timer__time" data-time>00:00</span><span class="small muted">Ciclo ${(timer.ciclos % 4) + 1} de 4</span></div>
          </div>
        </div>
        <div class="timer__controls">
          <button class="btn btn--primary" data-play style="min-width:150px"></button>
          <button class="icon-btn" data-reset aria-label="Reiniciar">${icon('reset')}</button>
          <button class="icon-btn" data-config aria-label="Durações">${icon('sliders')}</button>
        </div>
        <div class="chips" style="justify-content:center;margin-top:14px">${SONS.map((s) => `<button class="chip ${state.settings.foco.som === s.value ? 'chip--accent' : ''}" data-som="${s.value}" style="border:0;cursor:pointer;padding:6px 12px">${esc(s.label)}</button>`).join('')}</div>
      </section>
      <div class="grid grid--2 section">
        <div class="card"><div class="stat"><div class="stat__label">Foco hoje</div><div class="stat__value">${focoHoje()} min</div></div></div>
        <div class="card"><div class="stat"><div class="stat__label">Sessões hoje</div><div class="stat__value">${sessoesHoje} 🍅</div></div></div>
      </div>
      <section class="card section">
        <div class="card__title">Últimos 7 dias (minutos)</div>
        <div class="bars">${dias
          .map((d, i) => `<div class="bars__col"><span class="small num muted">${mins[i] || ''}</span><div class="bars__pair"><div class="bars__bar" style="width:min(26px,60%)" data-h="${(mins[i] / max) * 100}"></div></div><span class="bars__label">${esc(weekdayShort(d))}</span></div>`)
          .join('')}</div>
      </section>`;

    const prog = view.querySelector('.prog');
    prog.style.transition = 'stroke-dashoffset .3s linear';
    textMorph(view.querySelector('[data-fase]'), FASES[timer.fase]);
    atualizarView();
    growBars(view);

    bindSeg(view, 'fase', (v) => {
      pausar();
      prepararFase(v);
      atualizarView();
    });
    view.querySelector('[data-play]').addEventListener('click', () => (timer.rodando ? pausar() : iniciar()));
    view.querySelector('[data-reset]').addEventListener('click', reiniciar);
    view.querySelector('[data-config]').addEventListener('click', openConfig);
    view.querySelectorAll('[data-som]').forEach((b) =>
      b.addEventListener('click', () => {
        state.settings.foco.som = b.dataset.som;
        commit('settings');
        view.querySelectorAll('[data-som]').forEach((x) => x.classList.toggle('chip--accent', x === b));
        if (timer.rodando) somLigar();
      }),
    );
  },
};
