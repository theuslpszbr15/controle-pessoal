import { state } from '../store.js';
import { esc, greeting, longDate, money, monthKey, relativeDay, sum, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { emptyState, pop } from '../ui.js';
import { countTo, morphCycle } from '../textmorph.js';
import { temaAtual } from '../themes.js';
import { openTransaction, resumoMes } from './financas.js';
import { bindTaskList, openTask, taskItem, tarefasHoje } from './tarefas.js';
import { toggleHabit } from './habitos.js';
import { proximasContas, togglePaga } from './contas.js';
import { bindEventList, eventItem, eventosDoDia, openEvent } from './agenda.js';
import { focoHoje } from './foco.js';
import { openNote } from './notas.js';

const verTodos = (href) => `<a href="#/${href}" class="btn btn--ghost btn--sm" style="margin:-6px -8px 0 0">Ver ${icon('right')}</a>`;

export default {
  id: 'inicio',
  title: 'Início',
  icon: 'home',
  render(view) {
    const hoje = todayISO();
    const nome = state.settings.nome;
    const { saldo } = resumoMes(monthKey());
    const gastoHoje = sum(state.transacoes.filter((t) => t.data === hoje && t.tipo === 'despesa'), (t) => t.valor);
    const tarefas = tarefasHoje().sort((a, b) => ({ alta: 0, media: 1, baixa: 2 })[a.prioridade] - ({ alta: 0, media: 1, baixa: 2 })[b.prioridade]);
    const contas = proximasContas(3);
    const eventos = eventosDoDia(hoje);
    const metas = state.metas.filter((m) => m.atual < m.alvo).slice(0, 2);
    const habitosFeitos = state.habitos.filter((h) => h.dias?.[hoje]).length;
    const tema = temaAtual();

    view.innerHTML = `
      <section class="card card--accent hero beam">
        <h2 class="hero__greet" data-greet></h2>
        <p class="hero__date">${esc(longDate())}</p>
        <div class="hero__stats">
          <div class="stat"><div class="stat__label">Saldo do mês</div><div class="stat__value ${saldo < 0 ? 'neg' : ''}" data-count="home-saldo"></div></div>
          <div class="stat"><div class="stat__label">Gasto hoje</div><div class="stat__value" data-count="home-hoje"></div></div>
        </div>
        <div class="quick">
          <button class="btn btn--primary btn--sm" data-q="gasto">${icon('down')} Gasto</button>
          <button class="btn btn--sm" data-q="receita">${icon('up')} Receita</button>
          <button class="btn btn--sm" data-q="tarefa">${icon('tasks')} Tarefa</button>
          <button class="btn btn--sm" data-q="evento">${icon('calendar')} Evento</button>
          <button class="btn btn--sm" data-q="nota">${icon('note')} Nota</button>
        </div>
      </section>

      <div class="grid grid--auto section">
        <section class="card">
          <div class="row row--between"><div class="card__title">${icon('tasks')} Tarefas de hoje</div>${verTodos('tarefas')}</div>
          ${tarefas.length ? `<ul class="list" data-tasks>${tarefas.slice(0, 5).map(taskItem).join('')}</ul>${tarefas.length > 5 ? `<p class="small muted" style="margin-top:8px">+${tarefas.length - 5} tarefas</p>` : ''}` : emptyState('☀️', 'Nada pendente para hoje')}
        </section>

        <section class="card">
          <div class="row row--between"><div class="card__title">${icon('repeat')} Hábitos · ${habitosFeitos}/${state.habitos.length}</div>${verTodos('habitos')}</div>
          ${state.habitos.length ? `<div class="habit-pills">${state.habitos.map((h) => `<button class="habit-pill ${h.dias?.[hoje] ? 'is-on' : ''}" data-habit="${esc(h.id)}" aria-pressed="${!!h.dias?.[hoje]}">${esc(h.emoji)} ${esc(h.nome)}</button>`).join('')}</div>` : emptyState('🌱', 'Nenhum hábito ainda')}
        </section>

        <section class="card">
          <div class="row row--between"><div class="card__title">${icon('receipt')} Próximas contas</div>${verTodos('contas')}</div>
          ${contas.length ? `<ul class="list">${contas.map(({ c, venc }) => `<li class="item" data-conta="${esc(c.id)}"><button class="check" data-pay aria-label="Marcar como paga">${icon('check')}</button><span class="item__icon">${esc(c.emoji)}</span><div class="item__body"><div class="item__title">${esc(c.nome)}</div><div class="item__sub ${venc < hoje ? 'neg' : ''}">${esc(venc < hoje ? 'Atrasada' : relativeDay(venc))}</div></div><strong class="num small">${money(c.valor)}</strong></li>`).join('')}</ul>` : emptyState('✅', 'Tudo pago este mês')}
        </section>

        <section class="card">
          <div class="row row--between"><div class="card__title">${icon('calendar')} Agenda de hoje</div>${verTodos('agenda')}</div>
          ${eventos.length ? `<ul class="list" data-evs>${eventos.map(eventItem).join('')}</ul>` : emptyState('🌤️', 'Sem compromissos')}
        </section>

        <section class="card">
          <div class="card__title">${icon('clock')} Foco</div>
          <div class="row row--between"><div class="stat"><div class="stat__value">${focoHoje()} min</div><div class="stat__label">focado hoje</div></div>
          <a class="btn btn--soft" href="#/foco">${icon('play')} Focar</a></div>
        </section>

        <section class="card">
          <div class="row row--between"><div class="card__title">${icon('target')} Metas</div>${verTodos('metas')}</div>
          ${metas.length ? metas.map((m) => `<div style="margin-bottom:10px"><div class="row row--between small"><strong>${esc(m.emoji)} ${esc(m.nome)}</strong><span class="num muted">${Math.round((m.atual / m.alvo) * 100)}%</span></div><div class="progress" style="margin-top:6px"><div class="progress__bar" data-w="${(m.atual / m.alvo) * 100}"></div></div></div>`).join('') : emptyState('🫙', 'Crie uma meta de economia')}
        </section>
      </div>`;

    countTo(view.querySelector('[data-count=home-saldo]'), saldo, money);
    countTo(view.querySelector('[data-count=home-hoje]'), gastoHoje, money);
    requestAnimationFrame(() => view.querySelectorAll('[data-w]').forEach((b) => (b.style.width = `${Math.min(100, b.dataset.w)}%`)));

    const frases = [
      nome ? `Olá, ${nome}!` : 'Olá!',
      `${greeting()}! ${tema.emoji}`,
      tema.frase,
      tarefas.length ? `${tarefas.length} ${tarefas.length === 1 ? 'tarefa' : 'tarefas'} para hoje` : 'Nenhuma tarefa para hoje',
    ];
    if (state.habitos.length) frases.push(habitosFeitos === state.habitos.length ? 'Hábitos do dia completos 🔥' : `${state.habitos.length - habitosFeitos} hábitos esperando você`);
    const stop = morphCycle(view.querySelector('[data-greet]'), frases);

    view.querySelectorAll('[data-q]').forEach((b) =>
      b.addEventListener('click', () => {
        const q = b.dataset.q;
        if (q === 'gasto') openTransaction({ tipo: 'despesa' });
        else if (q === 'receita') openTransaction({ tipo: 'receita' });
        else if (q === 'tarefa') openTask();
        else if (q === 'evento') openEvent(null, { data: hoje });
        else openNote();
      }),
    );
    const tl = view.querySelector('[data-tasks]');
    if (tl) bindTaskList(tl);
    const el = view.querySelector('[data-evs]');
    if (el) bindEventList(el);
    view.querySelectorAll('[data-habit]').forEach((b) =>
      b.addEventListener('click', () => {
        b.classList.toggle('is-on');
        pop(b);
        setTimeout(() => toggleHabit(state.habitos.find((h) => h.id === b.dataset.habit)), 220);
      }),
    );
    view.querySelectorAll('[data-conta] [data-pay]').forEach((b) =>
      b.addEventListener('click', () => {
        const li = b.closest('[data-conta]');
        b.classList.add('is-on');
        pop(b);
        setTimeout(() => togglePaga(state.contas.find((c) => c.id === li.dataset.conta), monthKey()), 380);
      }),
    );
    return stop;
  },
};
