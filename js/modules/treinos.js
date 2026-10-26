import { state, commit } from '../store.js';
import { addDays, dayLabel, esc, groupBy, monthKey, monthLabel, pad, relativeDay, sum, toISO, todayISO, uid, weekdayShort } from '../utils.js';
import { icon } from '../icons.js';
import { confirmSheet, emptyState, fields, invalid, openSheet, toast } from '../ui.js';
import { growBars } from './financas.js';

export const TIPOS_TREINO = [
  { nome: 'Peito e tríceps', emoji: '💪' },
  { nome: 'Costas e bíceps', emoji: '🏋️' },
  { nome: 'Pernas', emoji: '🦵' },
  { nome: 'Ombros e abdômen', emoji: '🔥' },
  { nome: 'Full body', emoji: '⚡' },
  { nome: 'Cardio', emoji: '🏃' },
];

export const emojiTreino = (tipo) => TIPOS_TREINO.find((t) => t.nome === tipo)?.emoji || '🏋️';

export function duracaoTexto(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}`;
}

export const treinosDoDia = (iso) => (state.treinos || []).filter((t) => t.data === iso).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

// Tipos já usados que não estão na lista padrão viram atalhos no formulário.
const tiposPersonalizados = () => [...new Set((state.treinos || []).map((t) => t.tipo).filter((t) => !TIPOS_TREINO.some((p) => p.nome === t)))].slice(0, 6);

// Se existir um hábito de academia/treino, ele é marcado junto.
function marcarHabito(iso) {
  const h = state.habitos.find((x) => /academia|treino|muscula|gym/i.test(x.nome));
  if (!h || h.dias?.[iso]) return;
  h.dias = { ...h.dias, [iso]: true };
  commit('habitos');
}

export function openTreino(treino = null, preset = {}) {
  const agora = new Date();
  const t = treino || { tipo: '', data: todayISO(), hora: `${pad(agora.getHours())}:${pad(agora.getMinutes())}`, duracao: 60, notas: '', ...preset };
  const opcoes = [...TIPOS_TREINO.map((x) => x.nome), ...tiposPersonalizados()];
  const tipoConhecido = opcoes.includes(t.tipo);
  openSheet({
    title: treino ? 'Editar treino' : 'Registrar treino',
    body: fields([
      {
        name: 'tipo', label: 'Qual treino?', type: 'radio', value: tipoConhecido ? t.tipo : t.tipo ? 'Outro' : opcoes[0],
        options: [...opcoes.map((n) => ({ value: n, label: `${emojiTreino(n)} ${n}` })), { value: 'Outro', label: '✍️ Outro' }],
      },
      { name: 'outro', label: 'Nome do treino (se escolheu "Outro")', value: tipoConhecido ? '' : t.tipo, placeholder: 'Ex.: Glúteos, Natação, Luta…' },
      [
        { name: 'data', label: 'Dia', type: 'date', value: t.data, required: true },
        { name: 'hora', label: 'Chegou às', type: 'time', value: t.hora },
      ],
      [
        { name: 'horas', label: 'Horas', type: 'number', value: Math.floor(t.duracao / 60), attrs: 'min="0" max="12" inputmode="numeric"' },
        { name: 'minutos', label: 'Minutos', type: 'number', value: t.duracao % 60, attrs: 'min="0" max="59" step="5" inputmode="numeric"' },
      ],
      { name: 'notas', label: 'Anotações (exercícios, cargas, como foi)', type: 'textarea', value: t.notas, placeholder: 'Supino 4x10 com 30kg…' },
    ]),
    extra: treino ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet('Excluir este treino?', { okLabel: 'Excluir' }))) return;
        state.treinos = state.treinos.filter((x) => x.id !== treino.id);
        commit('treinos');
        toast('Treino excluído', { icon: '🗑️' });
      });
    },
    onSubmit(v, form) {
      const tipo = v.tipo === 'Outro' ? v.outro.trim() : v.tipo;
      if (!tipo) return invalid(form, 'outro', 'Escreva o nome do treino.');
      if (!v.data) return invalid(form, 'data', 'Escolha o dia.');
      const duracao = (Number(v.horas) || 0) * 60 + (Number(v.minutos) || 0);
      if (duracao <= 0 || duracao > 12 * 60) return invalid(form, 'horas', 'Informe quanto tempo você ficou.');
      const data = { tipo, data: v.data, hora: v.hora, duracao, notas: v.notas };
      if (treino) Object.assign(treino, data);
      else state.treinos = [...(state.treinos || []), { id: uid(), ...data }];
      commit('treinos');
      marcarHabito(v.data);
      toast(treino ? 'Treino atualizado' : `${tipo} · ${duracaoTexto(duracao)} registrado 💪`, { icon: emojiTreino(tipo) });
    },
  });
}

export const treinoItem = (t) => `<li class="item" data-treino="${esc(t.id)}" role="button" tabindex="0">
  <span class="item__icon" style="background:var(--success-soft)">${esc(emojiTreino(t.tipo))}</span>
  <div class="item__body"><div class="item__title">${esc(t.tipo)}</div><div class="item__sub">${esc([t.hora, duracaoTexto(t.duracao), t.notas].filter(Boolean).join(' · '))}</div></div>
</li>`;

export function bindTreinoList(root) {
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-treino]');
    if (li) openTreino(state.treinos.find((x) => x.id === li.dataset.treino));
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-treino]')) e.target.click();
  });
}

export function resumoSemana() {
  const hoje = new Date();
  const inicio = toISO(addDays(hoje, -((hoje.getDay() + 6) % 7)));
  const semana = (state.treinos || []).filter((t) => t.data >= inicio && t.data <= todayISO());
  return { qtd: new Set(semana.map((t) => t.data)).size, minutos: sum(semana, (t) => t.duracao) };
}

export default {
  id: 'treinos',
  title: 'Treinos',
  icon: 'dumbbell',
  render(view) {
    const lista = [...(state.treinos || [])].sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || ''));
    const semana = resumoSemana();
    const mes = monthKey();
    const doMes = lista.filter((t) => t.data.startsWith(mes));
    const ultimo = lista[0];
    const dias = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
    const mins = dias.map((d) => sum(treinosDoDia(toISO(d)), (t) => t.duracao));
    const max = Math.max(60, ...mins);
    const porTipo = [...groupBy(doMes, (t) => t.tipo)].sort((a, b) => b[1].length - a[1].length);
    const porMes = [...groupBy(lista, (t) => t.data.slice(0, 7))];

    view.innerHTML = `
      <section class="card card--accent">
        <div class="summary">
          <div class="stat stat--big"><div class="stat__label">Esta semana</div><div class="stat__value">${semana.qtd} ${semana.qtd === 1 ? 'dia' : 'dias'} · ${duracaoTexto(semana.minutos)}</div></div>
          <div class="stat"><div class="stat__label">Treinos no mês</div><div class="stat__value">${doMes.length}</div></div>
          <div class="stat"><div class="stat__label">Horas no mês</div><div class="stat__value">${duracaoTexto(sum(doMes, (t) => t.duracao))}</div></div>
        </div>
        ${ultimo ? `<p class="small muted" style="margin-top:10px">Último: ${esc(emojiTreino(ultimo.tipo))} ${esc(ultimo.tipo)} · ${esc(relativeDay(ultimo.data))}</p>` : ''}
        <button class="btn btn--primary btn--block" data-new style="margin-top:14px">${icon('plus')} Registrar treino</button>
      </section>

      <div class="grid grid--wide section">
        <section class="card">
          <div class="card__title">Últimos 7 dias</div>
          <div class="bars">${dias
            .map((d, i) => `<div class="bars__col"><span class="small num muted">${mins[i] ? esc(duracaoTexto(mins[i])) : ''}</span><div class="bars__pair"><div class="bars__bar bars__bar--in" style="width:min(26px,60%)" data-h="${(mins[i] / max) * 100}"></div></div><span class="bars__label">${esc(weekdayShort(d))}</span></div>`)
            .join('')}</div>
        </section>
        <section class="card">
          <div class="card__title">Treinos em ${esc(monthLabel(mes))}</div>
          ${porTipo.length ? `<div class="chips">${porTipo.map(([tipo, l]) => `<span class="chip chip--success">${esc(emojiTreino(tipo))} ${esc(tipo)} · ${l.length}x</span>`).join('')}</div>` : '<p class="muted small">Nenhum treino neste mês ainda.</p>'}
        </section>
      </div>

      <section class="section" data-list>
        <div class="section__head"><h2>Histórico</h2></div>
        ${lista.length ? porMes.map(([m, itens]) => `<div class="day-label">${esc(monthLabel(m))} · ${itens.length} ${itens.length === 1 ? 'treino' : 'treinos'}</div>
          <ul class="list">${itens.map((t) => treinoItem({ ...t, hora: `${dayLabel(t.data)}${t.hora ? ` · ${t.hora}` : ''}` })).join('')}</ul>`).join('')
          : `<div class="card">${emptyState('🏋️', 'Nenhum treino registrado', 'Toque em "Registrar treino" quando sair da academia.')}</div>`}
      </section>`;

    growBars(view);
    view.querySelector('[data-new]').addEventListener('click', () => openTreino());
    bindTreinoList(view.querySelector('[data-list]'));
  },
};
