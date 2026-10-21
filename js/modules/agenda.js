import { state, commit } from '../store.js';
import { addDays, addMonths, esc, longDate, money, monthKey, monthLabel, parseISO, toISO, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { confirmSheet, emptyState, fields, invalid, openSheet, toast } from '../ui.js';
import { monthNav } from './financas.js';
import { contasDoMes, estaPaga, vencimento } from './contas.js';
import { bindTaskList, taskItem } from './tarefas.js';

let mes = monthKey();
let dia = todayISO();

export const eventosDoDia = (iso) => state.eventos.filter((e) => e.data === iso).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

export function openEvent(evento = null, preset = {}) {
  const ev = evento || { titulo: '', data: dia, hora: '', local: '', notas: '', ...preset };
  openSheet({
    title: evento ? 'Editar compromisso' : 'Novo compromisso',
    body: fields([
      { name: 'titulo', label: 'Compromisso', value: ev.titulo, required: true, placeholder: 'Dentista, reunião…' },
      [
        { name: 'data', label: 'Data', type: 'date', value: ev.data, required: true },
        { name: 'hora', label: 'Hora', type: 'time', value: ev.hora },
      ],
      { name: 'local', label: 'Local', value: ev.local },
      { name: 'notas', label: 'Notas', type: 'textarea', value: ev.notas },
    ]),
    extra: evento ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir "${evento.titulo}"?`, { okLabel: 'Excluir' }))) return;
        state.eventos = state.eventos.filter((x) => x.id !== evento.id);
        commit('eventos');
      });
    },
    onSubmit(v, form) {
      if (!v.titulo) return invalid(form, 'titulo', 'Dê um nome ao compromisso.');
      if (!v.data) return invalid(form, 'data', 'Escolha a data.');
      const data = { titulo: v.titulo, data: v.data, hora: v.hora, local: v.local, notas: v.notas };
      if (evento) Object.assign(evento, data);
      else state.eventos.push({ id: uid(), ...data });
      commit('eventos');
      toast(evento ? 'Compromisso atualizado' : 'Compromisso agendado', { icon: '📅' });
    },
  });
}

export const eventItem = (e) => `<li class="item" data-ev="${esc(e.id)}" role="button" tabindex="0">
  <span class="item__icon" style="background:var(--accent-2-soft)">📅</span>
  <div class="item__body"><div class="item__title">${esc(e.titulo)}</div><div class="item__sub">${esc([e.hora, e.local].filter(Boolean).join(' · ') || 'Dia todo')}</div></div>
</li>`;

export function bindEventList(root) {
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-ev]');
    if (li) openEvent(state.eventos.find((x) => x.id === li.dataset.ev));
  });
}

function marcadores(key) {
  const m = new Map();
  const add = (iso, tipo) => {
    if (!iso?.startsWith(key)) return;
    if (!m.has(iso)) m.set(iso, new Set());
    m.get(iso).add(tipo);
  };
  state.tarefas.filter((t) => !t.feito).forEach((t) => add(t.prazo, 'tarefa'));
  state.eventos.forEach((e) => add(e.data, 'evento'));
  contasDoMes(key).forEach((c) => add(vencimento(c, key), 'conta'));
  return m;
}

export default {
  id: 'agenda',
  title: 'Agenda',
  icon: 'calendar',
  render(view, ctx) {
    const primeiro = parseISO(`${mes}-01`);
    const inicio = addDays(primeiro, -primeiro.getDay());
    const marks = marcadores(mes);
    const hoje = todayISO();
    let celulas = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(inicio, i);
      const iso = toISO(d);
      if (i >= 35 && !iso.startsWith(mes)) break;
      const tipos = marks.get(iso) || new Set();
      celulas += `<button class="cal__day ${iso.startsWith(mes) ? '' : 'is-out'} ${iso === hoje ? 'is-today' : ''} ${iso === dia ? 'is-selected' : ''}" data-dia="${iso}" aria-label="${esc(longDate(d))}">
        ${d.getDate()}<span class="cal__dots">${[...tipos].map((t) => `<i class="d-${t}"></i>`).join('')}</span></button>`;
    }

    const evs = eventosDoDia(dia);
    const tarefas = state.tarefas.filter((t) => !t.feito && t.prazo === dia);
    const key = dia.slice(0, 7);
    const contas = contasDoMes(key).filter((c) => vencimento(c, key) === dia);
    const vazio = !evs.length && !tarefas.length && !contas.length;

    view.innerHTML = `
      ${monthNav(monthLabel(mes))}
      <section class="card cal">
        <div class="cal__head">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal__grid">${celulas}</div>
        <div class="legend-inline"><span><i class="dot"></i>Tarefas</span><span><i class="dot" style="background:var(--accent-2)"></i>Compromissos</span><span><i class="dot" style="background:var(--warning)"></i>Contas</span></div>
      </section>
      <section class="section">
        <div class="section__head"><h2 style="font-size:1.1rem">${esc(longDate(parseISO(dia)))}</h2><button class="btn btn--soft btn--sm" data-new>${icon('plus')} Compromisso</button></div>
        ${vazio ? `<div class="card">${emptyState('🌤️', 'Nada neste dia')}</div>` : ''}
        ${evs.length ? `<ul class="list" data-evs>${evs.map(eventItem).join('')}</ul>` : ''}
        ${tarefas.length ? `<div class="day-label">Tarefas</div><ul class="list" data-tasks>${tarefas.map(taskItem).join('')}</ul>` : ''}
        ${contas.length ? `<div class="day-label">Contas</div><ul class="list">${contas
          .map((c) => `<li class="item ${estaPaga(c, key) ? 'is-done' : ''}"><span class="item__icon">${esc(c.emoji)}</span><div class="item__body"><div class="item__title">${esc(c.nome)}</div><div class="item__sub">${estaPaga(c, key) ? 'Paga' : 'A pagar'}</div></div><strong class="num">${money(c.valor)}</strong></li>`)
          .join('')}</ul>` : ''}
      </section>`;

    view.querySelectorAll('[data-mes]').forEach((b) =>
      b.addEventListener('click', () => {
        mes = addMonths(mes, Number(b.dataset.mes));
        ctx.refresh(true);
      }),
    );
    view.querySelector('.cal__grid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dia]');
      if (!b) return;
      dia = b.dataset.dia;
      if (!dia.startsWith(mes)) mes = dia.slice(0, 7);
      ctx.refresh();
    });
    view.querySelector('[data-new]').addEventListener('click', () => openEvent(null, { data: dia }));
    const evList = view.querySelector('[data-evs]');
    if (evList) bindEventList(evList);
    const tList = view.querySelector('[data-tasks]');
    if (tList) bindTaskList(tList);
  },
};
