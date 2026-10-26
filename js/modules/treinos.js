import { state, commit } from '../store.js';
import { addDays, dayLabel, esc, groupBy, monthKey, monthLabel, pad, parseISO, relativeDay, sum, toISO, todayISO, uid, weekdayShort } from '../utils.js';
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

// ---------- Rotina padrão (dias da semana, horário e duração) ----------
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export const rotina = () => ({ ativa: false, hora: '07:30', duracao: 60, dias: {}, ...state.settings.rotinaTreino });

export function planejado(iso) {
  const r = rotina();
  const tipo = r.ativa ? r.dias?.[parseISO(iso).getDay()] : '';
  return tipo ? { tipo, hora: r.hora, duracao: r.duracao } : null;
}

// Treino da rotina ainda não registrado (hoje ou dias futuros).
export const pendenteDoDia = (iso) => (iso < todayISO() || treinosDoDia(iso).length ? null : planejado(iso));

export function registrarPlanejado(iso = todayISO()) {
  const p = planejado(iso);
  if (!p) return openTreino(null, { data: iso });
  const novo = { id: uid(), data: iso, notas: '', ...p };
  state.treinos = [...(state.treinos || []), novo];
  commit('treinos');
  marcarHabito(iso);
  toast(`${p.tipo} · ${duracaoTexto(p.duracao)} registrado 💪`, {
    icon: emojiTreino(p.tipo),
    timeout: 5000,
    action: { label: 'Ajustar', onClick: () => openTreino(state.treinos.find((x) => x.id === novo.id)) },
  });
}

export function openRotina() {
  const r = rotina();
  const opcoes = [{ value: '', label: '😴 Descanso' }, ...[...TIPOS_TREINO.map((x) => x.nome), ...tiposPersonalizados(), 'Treino'].filter((v, i, a) => a.indexOf(v) === i).map((n) => ({ value: n, label: `${emojiTreino(n)} ${n}` }))];
  openSheet({
    title: 'Minha rotina de treino',
    body: `<p class="muted small" style="margin-bottom:12px">Defina seu horário e o treino de cada dia. A rotina aparece na Agenda e você registra com um toque em “Fui”.</p>
      <label class="auth__check" style="margin-bottom:6px"><input type="checkbox" name="ativa" ${r.ativa ? 'checked' : ''}> Usar rotina padrão</label>
      ${fields([
        [
          { name: 'hora', label: 'Horário', type: 'time', value: r.hora },
          { name: 'duracao', label: 'Duração (min)', type: 'number', value: r.duracao, attrs: 'min="10" max="720" step="5" inputmode="numeric"' },
        ],
        { name: 'todos', label: 'Aplicar a todos os dias', type: 'select', value: '-', options: [{ value: '-', label: 'Escolha para preencher tudo…' }, ...opcoes] },
        ...ORDEM_SEMANA.map((d) => ({ name: `dia${d}`, label: DIAS_SEMANA[d], type: 'select', value: r.dias?.[d] || '', options: opcoes })),
      ])}`,
    submitLabel: 'Salvar rotina',
    onOpen(panel) {
      const form = panel.querySelector('form');
      form.todos.addEventListener('change', () => {
        if (form.todos.value === '-') return;
        ORDEM_SEMANA.forEach((d) => (form[`dia${d}`].value = form.todos.value));
      });
    },
    onSubmit(v, form) {
      const duracao = Number(v.duracao);
      if (!(duracao >= 10 && duracao <= 720)) return invalid(form, 'duracao', 'Duração entre 10 e 720 minutos.');
      if (!v.hora) return invalid(form, 'hora', 'Informe o horário.');
      const dias = {};
      ORDEM_SEMANA.forEach((d) => {
        if (v[`dia${d}`]) dias[d] = v[`dia${d}`];
      });
      state.settings.rotinaTreino = { ativa: v.ativa, hora: v.hora, duracao, dias };
      commit('settings');
      toast(v.ativa ? 'Rotina salva — já aparece na Agenda' : 'Rotina desligada', { icon: '🗓️' });
    },
  });
}

export function openTreino(treino = null, preset = {}) {
  const agora = new Date();
  const r = rotina();
  const dataInicial = preset.data || todayISO();
  const plano = planejado(dataInicial);
  const t = treino || {
    tipo: plano?.tipo || '',
    data: dataInicial,
    hora: plano?.hora || (r.ativa ? r.hora : `${pad(agora.getHours())}:${pad(agora.getMinutes())}`),
    duracao: plano?.duracao || (r.ativa ? r.duracao : 60),
    notas: '',
    ...preset,
  };
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
      const form = panel.querySelector('form');
      let tipoEscolhido = !!treino;
      form.querySelectorAll('input[name=tipo]').forEach((el) => el.addEventListener('change', () => (tipoEscolhido = true)));
      // Ao trocar o dia, sugere o treino da rotina daquele dia
      form.data.addEventListener('change', () => {
        const p = planejado(form.data.value);
        if (!p || tipoEscolhido) return;
        const radio = [...form.querySelectorAll('input[name=tipo]')].find((el) => el.value === p.tipo);
        if (radio) radio.checked = true;
      });
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
    const fui = e.target.closest('[data-fui]');
    if (fui) return registrarPlanejado(fui.dataset.fui);
    const plan = e.target.closest('[data-plan]');
    if (plan) return openTreino(null, { data: plan.dataset.plan });
    const li = e.target.closest('[data-treino]');
    if (li) openTreino(state.treinos.find((x) => x.id === li.dataset.treino));
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-treino],[data-plan]')) e.target.click();
  });
}

// Item "planejado" da rotina (pontilhado), com botão "Fui" quando é hoje.
export function planoItem(iso) {
  const p = pendenteDoDia(iso);
  if (!p) return '';
  return `<li class="item item--plan" data-plan="${esc(iso)}" role="button" tabindex="0">
    <span class="item__icon">${esc(emojiTreino(p.tipo))}</span>
    <div class="item__body"><div class="item__title">${esc(p.tipo)}</div><div class="item__sub">Planejado · ${esc(p.hora)} · ${esc(duracaoTexto(p.duracao))}</div></div>
    ${iso === todayISO() ? `<button class="btn btn--primary btn--sm" data-fui="${esc(iso)}">${icon('check')} Fui</button>` : ''}
  </li>`;
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
    const r = rotina();
    const hoje = todayISO();
    const planoHoje = pendenteDoDia(hoje);
    const feitosHoje = treinosDoDia(hoje);

    view.innerHTML = `
      ${planoHoje || feitosHoje.length ? `<section class="card ${planoHoje ? 'beam' : ''}" data-hoje>
        <div class="card__title">${icon('dumbbell')} Hoje</div>
        ${planoHoje
          ? `<div class="row row--between row--wrap"><div><strong class="display" style="font-size:1.25rem">${esc(emojiTreino(planoHoje.tipo))} ${esc(planoHoje.tipo)}</strong><div class="small muted">${esc(planoHoje.hora)} · ${esc(duracaoTexto(planoHoje.duracao))}</div></div>
            <div class="row"><button class="btn btn--primary" data-fui="${hoje}">${icon('check')} Fui</button><button class="btn" data-plan="${hoje}">Mudou algo</button></div></div>`
          : `<p>✅ ${feitosHoje.map((t) => `${esc(t.tipo)} (${esc(duracaoTexto(t.duracao))})`).join(', ')} — treino de hoje feito!</p>`}
      </section>` : ''}

      <section class="card card--accent ${planoHoje || feitosHoje.length ? 'section' : ''}">
        <div class="summary">
          <div class="stat stat--big"><div class="stat__label">Esta semana</div><div class="stat__value">${semana.qtd} ${semana.qtd === 1 ? 'dia' : 'dias'} · ${duracaoTexto(semana.minutos)}</div></div>
          <div class="stat"><div class="stat__label">Treinos no mês</div><div class="stat__value">${doMes.length}</div></div>
          <div class="stat"><div class="stat__label">Horas no mês</div><div class="stat__value">${duracaoTexto(sum(doMes, (t) => t.duracao))}</div></div>
        </div>
        ${ultimo ? `<p class="small muted" style="margin-top:10px">Último: ${esc(emojiTreino(ultimo.tipo))} ${esc(ultimo.tipo)} · ${esc(relativeDay(ultimo.data))}</p>` : ''}
        <button class="btn btn--primary btn--block" data-new style="margin-top:14px">${icon('plus')} Registrar treino</button>
      </section>

      <section class="card section">
        <div class="row row--between"><div class="card__title">🗓️ Minha rotina</div><button class="btn btn--soft btn--sm" data-rotina>${r.ativa ? 'Editar' : 'Configurar'}</button></div>
        ${r.ativa
          ? `<p class="small muted" style="margin-bottom:10px">Todo treino às <strong>${esc(r.hora)}</strong> · ${esc(duracaoTexto(r.duracao))}</p>
            <div class="chips">${ORDEM_SEMANA.map((d) => `<span class="chip ${r.dias[d] ? 'chip--success' : ''}">${DIAS_SEMANA[d].slice(0, 3)} ${r.dias[d] ? `${esc(emojiTreino(r.dias[d]))} ${esc(r.dias[d])}` : '😴'}</span>`).join('')}</div>`
          : '<p class="small muted">Deixe padronizado: escolha o horário (ex.: 07:30) e o treino de cada dia. A rotina aparece na Agenda e você registra só tocando em “Fui”.</p>'}
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
    view.querySelector('[data-rotina]').addEventListener('click', openRotina);
    const cardHoje = view.querySelector('[data-hoje]');
    if (cardHoje) bindTreinoList(cardHoje);
    bindTreinoList(view.querySelector('[data-list]'));
  },
};
