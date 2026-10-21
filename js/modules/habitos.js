import { state, commit } from '../store.js';
import { addDays, esc, safeColor, toISO, todayISO, uid, weekdayShort, dayLabel } from '../utils.js';
import { icon } from '../icons.js';
import { confirmSheet, emptyState, fields, invalid, openSheet, pop, toast } from '../ui.js';

let filtroHeat = 'todos';

const SUGESTOES = [
  ['💧', 'Beber água', '#6ea7c6'],
  ['🏋️', 'Academia', '#c98a6b'],
  ['📖', 'Ler 10 páginas', '#a68cc4'],
  ['💊', 'Tomar remédio', '#d08f97'],
  ['🧘', 'Meditar', '#8fa97f'],
  ['🚶', 'Caminhar', '#b49a74'],
];

export function streak(h) {
  let d = new Date();
  if (!h.dias?.[toISO(d)]) d = addDays(d, -1);
  let n = 0;
  while (h.dias?.[toISO(d)]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function toggleHabit(h, iso = todayISO()) {
  h.dias ||= {};
  if (h.dias[iso]) delete h.dias[iso];
  else h.dias[iso] = true;
  commit('habitos');
  if (h.dias[iso] && iso === todayISO()) {
    const s = streak(h);
    if (s > 1 && [3, 7, 14, 21, 30, 50, 100, 365].includes(s)) toast(`${s} dias seguidos de ${h.nome}!`, { icon: '🔥' });
  }
}

export function openHabit(habito = null) {
  const h = habito || { nome: '', emoji: '✨', cor: '#8fa97f' };
  openSheet({
    title: habito ? 'Editar hábito' : 'Novo hábito',
    body: `${fields([
      [
        { name: 'emoji', label: 'Ícone', value: h.emoji, attrs: 'maxlength="4"' },
        { name: 'nome', label: 'Hábito', value: h.nome, required: true, placeholder: 'Beber água…' },
      ],
      { name: 'cor', label: 'Cor', type: 'color', value: safeColor(h.cor, '#8fa97f') },
    ])}
    ${habito ? '' : `<div class="field"><span>Sugestões</span><div class="chips">${SUGESTOES.map(([e, n, c]) => `<button type="button" class="chip" data-sug="${esc(e)}|${esc(n)}|${c}" style="border:0;cursor:pointer">${e} ${esc(n)}</button>`).join('')}</div></div>`}`,
    extra: habito ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelectorAll('[data-sug]').forEach((b) =>
        b.addEventListener('click', () => {
          const [e, n, c] = b.dataset.sug.split('|');
          const f = panel.querySelector('form');
          f.emoji.value = e;
          f.nome.value = n;
          f.cor.value = c;
        }),
      );
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir "${habito.nome}" e todo o histórico?`, { okLabel: 'Excluir' }))) return;
        state.habitos = state.habitos.filter((x) => x.id !== habito.id);
        commit('habitos');
      });
    },
    onSubmit(v, form) {
      if (!v.nome) return invalid(form, 'nome', 'Dê um nome ao hábito.');
      const data = { nome: v.nome, emoji: v.emoji || '✨', cor: safeColor(v.cor, '#8fa97f') };
      if (habito) Object.assign(habito, data);
      else state.habitos.push({ id: uid(), dias: {}, criadoEm: todayISO(), ...data });
      commit('habitos');
      toast(habito ? 'Hábito atualizado' : 'Hábito criado', { icon: data.emoji });
    },
  });
}

function heatmap() {
  const hoje = new Date();
  const inicio = addDays(hoje, -(52 * 7 + hoje.getDay()));
  const habitos = filtroHeat === 'todos' ? state.habitos : state.habitos.filter((h) => h.id === filtroHeat);
  const total = Math.max(1, habitos.length);
  let cells = '';
  for (let d = new Date(inicio); d <= hoje; d = addDays(d, 1)) {
    const iso = toISO(d);
    const feitos = habitos.filter((h) => h.dias?.[iso]).length;
    const nivel = feitos ? Math.max(1, Math.ceil((feitos / total) * 4)) : 0;
    cells += `<i class="heatmap__cell" data-l="${nivel}" title="${esc(dayLabel(iso))}: ${feitos}/${habitos.length}"></i>`;
  }
  return `<div class="heatmap" data-heat>${cells}</div>`;
}

export default {
  id: 'habitos',
  title: 'Hábitos',
  icon: 'repeat',
  render(view, ctx) {
    const hoje = todayISO();
    const feitosHoje = state.habitos.filter((h) => h.dias?.[hoje]).length;
    const semana = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));

    view.innerHTML = state.habitos.length
      ? `
      <section class="card card--accent">
        <div class="row row--between"><div class="stat"><div class="stat__label">Hoje</div><div class="stat__value">${feitosHoje} de ${state.habitos.length}</div></div>
        <button class="btn btn--soft btn--sm" data-new>${icon('plus')} Hábito</button></div>
        <div class="progress" style="margin-top:12px"><div class="progress__bar" style="width:${(feitosHoje / state.habitos.length) * 100}%;background:var(--success)"></div></div>
      </section>
      <div class="grid grid--auto section">
        ${state.habitos
          .map((h) => {
            const s = streak(h);
            return `<div class="card" data-habit="${esc(h.id)}" style="--hc:${safeColor(h.cor)}">
            <div class="row"><span class="item__icon" style="background:${safeColor(h.cor)}2e">${esc(h.emoji)}</span>
              <div class="grow"><strong>${esc(h.nome)}</strong><div class="small muted">${Object.keys(h.dias || {}).length} dias no total</div></div>
              ${s ? `<span class="streak">${icon('flame')}${s}</span>` : ''}
              <button class="icon-btn icon-btn--plain" data-edit aria-label="Editar">${icon('edit')}</button></div>
            <div class="week">${semana
              .map((d) => {
                const iso = toISO(d);
                const on = h.dias?.[iso];
                return `<button class="week__day ${on ? 'is-on' : ''} ${iso === hoje ? 'is-today' : ''}" data-day="${iso}" aria-pressed="${!!on}" aria-label="${esc(dayLabel(iso))}">
                <span class="week__dot">${on ? icon('check') : ''}</span>${esc(iso === hoje ? 'hoje' : weekdayShort(d))}</button>`;
              })
              .join('')}</div>
          </div>`;
          })
          .join('')}
      </div>
      <section class="section card">
        <div class="section__head"><h2>Seu ano</h2></div>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${filtroHeat === 'todos' ? 'chip--accent' : ''}" data-heatf="todos" style="border:0;cursor:pointer">Todos</button>
          ${state.habitos.map((h) => `<button class="chip ${filtroHeat === h.id ? 'chip--accent' : ''}" data-heatf="${esc(h.id)}" style="border:0;cursor:pointer">${esc(h.emoji)} ${esc(h.nome)}</button>`).join('')}
        </div>
        ${heatmap()}
      </section>`
      : `<div class="card">${emptyState('🌱', 'Comece um hábito', 'Pequenas ações diárias. Marque cada dia e acompanhe sua sequência.')}
          <div class="chips" style="justify-content:center;margin-bottom:14px">${SUGESTOES.map(([e, n, c]) => `<button class="chip chip--accent" data-quick="${esc(e)}|${esc(n)}|${c}" style="border:0;cursor:pointer;padding:8px 12px">${e} ${esc(n)}</button>`).join('')}</div>
          <button class="btn btn--primary btn--block" data-new>${icon('plus')} Criar hábito</button></div>`;

    const heat = view.querySelector('[data-heat]');
    if (heat) heat.scrollLeft = heat.scrollWidth;

    view.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-new]')) return openHabit();
      const q = t.closest('[data-quick]');
      if (q) {
        const [emoji, nome, cor] = q.dataset.quick.split('|');
        state.habitos.push({ id: uid(), nome, emoji, cor, dias: {}, criadoEm: todayISO() });
        commit('habitos');
        return;
      }
      const f = t.closest('[data-heatf]');
      if (f) {
        filtroHeat = f.dataset.heatf;
        return ctx.refresh();
      }
      const card = t.closest('[data-habit]');
      if (!card) return;
      const h = state.habitos.find((x) => x.id === card.dataset.habit);
      if (t.closest('[data-edit]')) return openHabit(h);
      const day = t.closest('[data-day]');
      if (day) {
        day.classList.toggle('is-on');
        pop(day.querySelector('.week__dot'));
        setTimeout(() => toggleHabit(h, day.dataset.day), 200);
      }
    });
  },
};
