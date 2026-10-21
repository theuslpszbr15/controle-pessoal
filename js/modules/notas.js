import { state, commit } from '../store.js';
import { dayLabel, esc, money, relativeDay, sum, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { bindSeg, confirmSheet, emptyState, fields, invalid, openSheet, pop, segHTML, toast } from '../ui.js';
import { growBars } from './financas.js';

let aba = 'notas';
let busca = '';
let diaDiario = todayISO();

export const HUMORES = ['😞', '😕', '😐', '🙂', '😄'];
const CORES = [
  { value: 'accent', label: 'Tema' },
  { value: 'accent-2', label: 'Destaque' },
  { value: 'success', label: 'Verde' },
  { value: 'warning', label: 'Amarelo' },
  { value: 'danger', label: 'Vermelho' },
];
const corValida = (c) => (CORES.some((x) => x.value === c) ? c : 'accent');

export function openNote(nota = null) {
  const n = nota || { titulo: '', texto: '', fixada: false, cor: 'accent' };
  openSheet({
    title: nota ? 'Editar nota' : 'Nova nota',
    body: `${fields([
      { name: 'titulo', label: 'Título', value: n.titulo },
      { name: 'texto', label: 'Nota', type: 'textarea', value: n.texto },
      { name: 'cor', label: 'Cor', type: 'radio', value: corValida(n.cor), options: CORES },
    ])}
    <label class="row" style="cursor:pointer"><input type="checkbox" name="fixada" ${n.fixada ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"> Fixar no topo</label>`,
    extra: nota ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet('Excluir esta nota?', { okLabel: 'Excluir' }))) return;
        state.notas = state.notas.filter((x) => x.id !== nota.id);
        commit('notas');
      });
    },
    onSubmit(v, form) {
      if (!v.titulo && !v.texto) return invalid(form, 'texto', 'A nota está vazia.');
      const data = { titulo: v.titulo, texto: v.texto, cor: corValida(v.cor), fixada: v.fixada, atualizada: new Date().toISOString() };
      if (nota) Object.assign(nota, data);
      else state.notas.push({ id: uid(), ...data });
      commit('notas');
      toast('Nota salva', { icon: '🗒️' });
    },
  });
}

function renderNotas() {
  const q = busca.toLowerCase();
  const lista = state.notas
    .filter((n) => !q || `${n.titulo} ${n.texto}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.fixada) - Number(a.fixada) || (b.atualizada || '').localeCompare(a.atualizada || ''));
  return `
    <div class="row" style="margin-bottom:12px">
      <label class="search grow">${icon('search')}<span class="sr-only">Buscar notas</span><input class="input" type="search" placeholder="Buscar notas" value="${esc(busca)}" data-busca data-keep="notes-search"></label>
      <button class="btn btn--primary" data-new>${icon('plus')} Nota</button>
    </div>
    ${lista.length ? `<div class="notes">${lista
      .map((n) => `<article class="card card--tight note" data-note="${esc(n.id)}" style="--nc:var(--${corValida(n.cor)})" role="button" tabindex="0">
        ${n.fixada ? `<span class="note__pin">${icon('pin')}</span>` : ''}
        ${n.titulo ? `<h3>${esc(n.titulo)}</h3>` : ''}<p>${esc(n.texto)}</p>
        <div class="small muted" style="margin-top:8px">${esc(n.atualizada ? relativeDay(n.atualizada.slice(0, 10)) : '')}</div>
      </article>`)
      .join('')}</div>` : `<div class="card">${emptyState('🗒️', busca ? 'Nada encontrado' : 'Sem notas', busca ? '' : 'Ideias, senhas do wi-fi, listas rápidas…')}</div>`}`;
}

function renderDiario() {
  const e = state.diario[diaDiario] || { humor: 0, texto: '' };
  const entradas = Object.entries(state.diario).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  return `
    <section class="card card--accent">
      <div class="row row--between" style="margin-bottom:12px"><h2 style="font-size:1.25rem">Como foi seu dia?</h2>
        <input type="date" class="input" value="${esc(diaDiario)}" max="${todayISO()}" data-dia style="width:auto;min-height:38px;padding:6px 10px" aria-label="Dia"></div>
      <div class="moods" role="radiogroup" aria-label="Humor">${HUMORES.map((h, i) => `<button type="button" class="${e.humor === i + 1 ? 'is-on' : ''}" data-humor="${i + 1}" role="radio" aria-checked="${e.humor === i + 1}">${h}</button>`).join('')}</div>
      <textarea class="input" data-texto placeholder="Escreva sobre o seu dia…" style="margin-top:12px;min-height:120px" aria-label="Diário">${esc(e.texto)}</textarea>
      <button class="btn btn--primary btn--block" data-salvar style="margin-top:12px">Salvar no diário</button>
    </section>
    <section class="section">
      <div class="section__head"><h2>Entradas</h2></div>
      ${entradas.length ? `<ul class="list">${entradas
        .map(([d, x]) => `<li class="item" data-entry="${esc(d)}" role="button" tabindex="0"><span class="item__icon">${HUMORES[x.humor - 1] || '📓'}</span>
          <div class="item__body"><div class="item__title">${esc(relativeDay(d))} · ${esc(dayLabel(d))}</div><div class="item__sub">${esc(x.texto || 'Sem texto')}</div></div></li>`)
        .join('')}</ul>` : `<div class="card">${emptyState('📓', 'Diário vazio', 'Registre seu humor todo dia e descubra padrões.')}</div>`}
    </section>`;
}

function renderHumor() {
  const gastoDia = new Map();
  for (const t of state.transacoes) if (t.tipo === 'despesa') gastoDia.set(t.data, (gastoDia.get(t.data) || 0) + t.valor);
  const porHumor = HUMORES.map((emoji, i) => {
    const dias = Object.entries(state.diario).filter(([, x]) => x.humor === i + 1).map(([d]) => d);
    const media = dias.length ? sum(dias, (d) => gastoDia.get(d) || 0) / dias.length : 0;
    return { emoji, dias: dias.length, media };
  });
  const comDados = porHumor.filter((h) => h.dias);
  if (comDados.length < 2) {
    return `<div class="card">${emptyState('🔍', 'Poucos dados ainda', 'Registre seu humor no Diário por alguns dias (com gastos lançados) para ver a relação entre humor e gastos.')}</div>`;
  }
  const max = Math.max(1, ...porHumor.map((h) => h.media));
  const pior = [...comDados].sort((a, b) => b.media - a.media)[0];
  const melhor = [...comDados].sort((a, b) => a.media - b.media)[0];
  const diff = melhor.media ? Math.round(((pior.media - melhor.media) / melhor.media) * 100) : 0;
  return `
    <section class="card">
      <div class="card__title">Gasto médio por dia, por humor</div>
      <div class="bars" style="height:180px">${porHumor
        .map((h) => `<div class="bars__col" title="${h.dias} dias"><span class="small num muted">${h.dias ? esc(money(h.media).replace(',00', '')) : '–'}</span>
          <div class="bars__pair"><div class="bars__bar" style="width:min(36px,60%)" data-h="${(h.media / max) * 100}"></div></div><span style="font-size:1.4rem">${h.emoji}</span></div>`)
        .join('')}</div>
    </section>
    <section class="card card--accent section">
      <div class="card__title">Insight</div>
      <p>Nos dias ${pior.emoji} você gasta em média <strong>${money(pior.media)}</strong>${diff > 0 ? `, <strong>${diff}% a mais</strong> que nos dias ${melhor.emoji}` : ''}.</p>
    </section>`;
}

export default {
  id: 'notas',
  title: 'Notas',
  icon: 'note',
  render(view, ctx) {
    view.innerHTML = `
      <div style="margin-bottom:14px">${segHTML([{ value: 'notas', label: '🗒️ Notas' }, { value: 'diario', label: '📓 Diário' }, { value: 'humor', label: '🔍 Humor × Gastos' }], aba, 'aba')}</div>
      <div data-body>${aba === 'notas' ? renderNotas() : aba === 'diario' ? renderDiario() : renderHumor()}</div>`;

    bindSeg(view, 'aba', (v) => {
      aba = v;
      ctx.refresh(true);
    });
    growBars(view);
    const body = view.querySelector('[data-body]');

    body.querySelector('[data-busca]')?.addEventListener('input', (e) => {
      busca = e.target.value;
      ctx.refresh();
    });
    body.querySelector('[data-dia]')?.addEventListener('change', (e) => {
      if (e.target.value) diaDiario = e.target.value;
      ctx.refresh();
    });

    let humorSel = state.diario[diaDiario]?.humor || 0;
    body.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-new]')) return openNote();
      const n = t.closest('[data-note]');
      if (n) return openNote(state.notas.find((x) => x.id === n.dataset.note));
      const h = t.closest('[data-humor]');
      if (h) {
        humorSel = Number(h.dataset.humor);
        body.querySelectorAll('[data-humor]').forEach((b) => {
          b.classList.toggle('is-on', b === h);
          b.setAttribute('aria-checked', b === h);
        });
        pop(h);
        return;
      }
      if (t.closest('[data-salvar]')) {
        const texto = body.querySelector('[data-texto]').value.trim();
        if (!humorSel && !texto) return toast('Escolha um humor ou escreva algo', { icon: '📓' });
        state.diario[diaDiario] = { humor: humorSel, texto };
        commit('diario');
        return toast('Diário salvo', { icon: HUMORES[humorSel - 1] || '📓' });
      }
      const en = t.closest('[data-entry]');
      if (en) {
        diaDiario = en.dataset.entry;
        ctx.refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-note],[data-entry]')) e.target.click();
    });
  },
};
