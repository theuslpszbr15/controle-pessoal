import { state, commit } from '../store.js';
import { addDays, esc, relativeDay, toISO, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { bindSeg, confirmSheet, emptyState, fields, invalid, openSheet, pop, segHTML, toast } from '../ui.js';
import { textMorph } from '../textmorph.js';
import { dropText } from '../fx/physics.js';

let aba = 'hoje';
let tagAtiva = null;

const PRIORIDADES = [
  { value: 'alta', label: '🔴 Alta' },
  { value: 'media', label: '🟡 Média' },
  { value: 'baixa', label: '🟢 Baixa' },
];
const pesoPrioridade = { alta: 0, media: 1, baixa: 2 };

export const tarefasHoje = () => {
  const hoje = todayISO();
  return state.tarefas.filter((t) => !t.feito && t.prazo && t.prazo <= hoje);
};

const ordenar = (a, b) =>
  (a.prazo || '9999').localeCompare(b.prazo || '9999') || pesoPrioridade[a.prioridade] - pesoPrioridade[b.prioridade];

function filtrar() {
  const hoje = todayISO();
  let lista = state.tarefas;
  if (aba === 'hoje') lista = lista.filter((t) => !t.feito && t.prazo && t.prazo <= hoje);
  else if (aba === 'proximas') lista = lista.filter((t) => !t.feito && t.prazo > hoje);
  else if (aba === 'todas') lista = lista.filter((t) => !t.feito);
  else lista = lista.filter((t) => t.feito).sort((a, b) => (b.concluidaEm || '').localeCompare(a.concluidaEm || ''));
  if (tagAtiva) lista = lista.filter((t) => t.tags?.includes(tagAtiva));
  return aba === 'concluidas' ? lista : [...lista].sort(ordenar);
}

// "Comprar pão #casa !" -> título, tags e prioridade alta
export function parseQuick(text) {
  const tags = [...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1].toLowerCase());
  const alta = /(^|\s)!(\s|$)/.test(text);
  const titulo = text.replace(/#[\p{L}\p{N}_-]+/gu, '').replace(/(^|\s)!(\s|$)/, ' ').replace(/\s+/g, ' ').trim();
  return { titulo, tags, prioridade: alta ? 'alta' : 'media' };
}

export function addTask(data) {
  const t = { id: uid(), titulo: '', notas: '', prioridade: 'media', prazo: '', tags: [], sub: [], feito: false, criadaEm: new Date().toISOString(), ...data };
  state.tarefas.push(t);
  commit('tarefas');
  return t;
}

export function completeTask(id, itemEl) {
  const t = state.tarefas.find((x) => x.id === id);
  if (!t) return;
  const chk = itemEl?.querySelector('.check');
  if (chk?.dataset.busy) return;
  if (chk) {
    chk.dataset.busy = '1';
    chk.classList.toggle('is-on', !t.feito);
    pop(chk);
  }
  const concluir = !t.feito;
  if (concluir && itemEl) {
    const title = itemEl.querySelector('.item__title');
    if (title) textMorph(title, 'Feito!', { duration: 0.5 });
    if (state.settings.fisica) dropText(itemEl.getBoundingClientRect(), t.titulo);
  }
  setTimeout(() => {
    t.feito = concluir;
    t.concluidaEm = concluir ? new Date().toISOString() : null;
    commit('tarefas');
    if (concluir) {
      toast('Tarefa concluída', {
        icon: '🎉',
        action: { label: 'Desfazer', onClick: () => { t.feito = false; t.concluidaEm = null; commit('tarefas'); } },
      });
    }
  }, concluir ? 650 : 250);
}

export function taskItem(t) {
  const hoje = todayISO();
  const atrasada = !t.feito && t.prazo && t.prazo < hoje;
  const subFeitas = (t.sub || []).filter((s) => s.feito).length;
  const meta = [
    t.prazo ? `<span class="${atrasada ? 'neg' : ''}">${esc(atrasada ? `Atrasada · ${relativeDay(t.prazo)}` : relativeDay(t.prazo))}</span>` : '',
    t.sub?.length ? `<span>☑ ${subFeitas}/${t.sub.length}</span>` : '',
    ...(t.tags || []).map((g) => `<span>#${esc(g)}</span>`),
  ].filter(Boolean);
  return `<li class="item ${t.feito ? 'is-done' : ''}" data-task="${esc(t.id)}">
    <button class="check ${t.feito ? 'is-on' : ''}" data-done aria-label="${t.feito ? 'Reabrir tarefa' : 'Concluir tarefa'}">${icon('check')}</button>
    <div class="item__body" data-open role="button" tabindex="0">
      <div class="item__title">${esc(t.titulo)}</div>
      ${meta.length ? `<div class="item__sub row" style="gap:8px">${meta.join('')}</div>` : ''}
    </div>
    <span class="dot priority--${esc(t.prioridade)}" title="Prioridade ${esc(t.prioridade)}"></span>
  </li>`;
}

export function bindTaskList(root) {
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-task]');
    if (!li) return;
    if (e.target.closest('[data-done]')) completeTask(li.dataset.task, li);
    else if (e.target.closest('[data-open]')) openTask(state.tarefas.find((t) => t.id === li.dataset.task));
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-open]')) e.target.click();
  });
}

export function openTask(tarefa = null, preset = {}) {
  const t = tarefa || { titulo: '', notas: '', prioridade: 'media', prazo: todayISO(), tags: [], sub: [], ...preset };
  let sub = structuredClone(t.sub || []);
  openSheet({
    title: tarefa ? 'Editar tarefa' : 'Nova tarefa',
    body: `${fields([
      { name: 'titulo', label: 'O que precisa ser feito?', value: t.titulo, required: true },
      { name: 'prioridade', label: 'Prioridade', type: 'radio', value: t.prioridade, options: PRIORIDADES },
      [
        { name: 'prazo', label: 'Prazo', type: 'date', value: t.prazo },
        { name: 'tags', label: 'Tags (separe por vírgula)', value: (t.tags || []).join(', '), placeholder: 'casa, trabalho' },
      ],
      { name: 'notas', label: 'Notas', type: 'textarea', value: t.notas },
    ])}
    <div class="field"><span>Subtarefas</span><div class="subtasks" data-sub></div>
      <div class="row"><input class="input" data-subnew placeholder="Adicionar subtarefa" aria-label="Nova subtarefa"><button type="button" class="icon-btn" data-subadd aria-label="Adicionar">${icon('plus')}</button></div>
    </div>`,
    extra: tarefa ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      const box = panel.querySelector('[data-sub]');
      const input = panel.querySelector('[data-subnew]');
      const draw = () => {
        box.innerHTML = sub
          .map((s, i) => `<div class="subtasks__row"><button type="button" class="check check--sm ${s.feito ? 'is-on' : ''}" data-i="${i}" aria-label="Alternar">${icon('check')}</button>
            <span class="grow ${s.feito ? 'muted' : ''}" style="${s.feito ? 'text-decoration:line-through' : ''}">${esc(s.titulo)}</span>
            <button type="button" class="icon-btn icon-btn--plain" data-rm="${i}" aria-label="Remover">${icon('x')}</button></div>`)
          .join('');
      };
      const add = () => {
        const v = input.value.trim();
        if (!v) return;
        sub.push({ id: uid(), titulo: v, feito: false });
        input.value = '';
        draw();
        input.focus();
      };
      draw();
      box.addEventListener('click', (e) => {
        const c = e.target.closest('[data-i]');
        const r = e.target.closest('[data-rm]');
        if (c) sub[c.dataset.i].feito = !sub[c.dataset.i].feito;
        if (r) sub.splice(Number(r.dataset.rm), 1);
        if (c || r) draw();
      });
      panel.querySelector('[data-subadd]').addEventListener('click', add);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir "${tarefa.titulo}"?`, { okLabel: 'Excluir' }))) return;
        state.tarefas = state.tarefas.filter((x) => x.id !== tarefa.id);
        commit('tarefas');
        toast('Tarefa excluída', { icon: '🗑️' });
      });
    },
    onSubmit(v, form) {
      if (!v.titulo) return invalid(form, 'titulo', 'Escreva o título da tarefa.');
      const data = {
        titulo: v.titulo,
        notas: v.notas,
        prioridade: v.prioridade || 'media',
        prazo: v.prazo,
        tags: v.tags.split(',').map((s) => s.trim().replace(/^#/, '').toLowerCase()).filter(Boolean),
        sub,
      };
      if (tarefa) {
        Object.assign(tarefa, data);
        commit('tarefas');
      } else addTask(data);
      toast(tarefa ? 'Tarefa atualizada' : 'Tarefa criada', { icon: '📝' });
    },
  });
}

export default {
  id: 'tarefas',
  title: 'Tarefas',
  icon: 'tasks',
  render(view, ctx) {
    const lista = filtrar();
    const tags = [...new Set(state.tarefas.filter((t) => !t.feito).flatMap((t) => t.tags || []))].sort();
    if (tagAtiva && !tags.includes(tagAtiva)) tagAtiva = null;
    const hoje = todayISO();
    const contagem = {
      hoje: state.tarefas.filter((t) => !t.feito && t.prazo && t.prazo <= hoje).length,
      proximas: state.tarefas.filter((t) => !t.feito && t.prazo > hoje).length,
      todas: state.tarefas.filter((t) => !t.feito).length,
    };
    const vazio = {
      hoje: ['☀️', 'Dia livre!', 'Nada vencendo hoje. Adicione algo acima.'],
      proximas: ['🗓️', 'Nada agendado', 'Tarefas com prazo futuro aparecem aqui.'],
      todas: ['✨', 'Tudo em dia', 'Nenhuma tarefa pendente.'],
      concluidas: ['🏁', 'Nada concluído ainda', 'Conclua uma tarefa para vê-la aqui.'],
    }[aba];

    view.innerHTML = `
      <form class="card card--tight row" data-quick>
        <input class="input grow" name="q" placeholder="Nova tarefa…" aria-label="Nova tarefa" autocomplete="off" data-keep="task-quick" style="border:0;background:transparent;box-shadow:none">
        <button class="btn btn--primary btn--sm" type="submit">${icon('plus')} Adicionar</button>
      </form>
      <p class="small muted" style="margin:6px 4px 14px">Dica: <strong>#casa</strong> vira tag e <strong>!</strong> marca como urgente.</p>
      ${segHTML([
        { value: 'hoje', label: `Hoje ${contagem.hoje || ''}` },
        { value: 'proximas', label: `Próximas ${contagem.proximas || ''}` },
        { value: 'todas', label: `Pendentes ${contagem.todas || ''}` },
        { value: 'concluidas', label: 'Feitas' },
      ], aba, 'aba')}
      ${tags.length ? `<div class="chips" style="margin-top:12px">${tags.map((g) => `<button class="chip ${g === tagAtiva ? 'chip--accent' : ''}" data-tag="${esc(g)}" style="border:0;cursor:pointer">#${esc(g)}</button>`).join('')}</div>` : ''}
      <div class="section" data-list>
        ${lista.length ? `<ul class="list">${lista.map(taskItem).join('')}</ul>` : `<div class="card">${emptyState(...vazio)}</div>`}
      </div>
      <button class="btn btn--ghost btn--block" data-full style="margin-top:12px">${icon('edit')} Criar com detalhes</button>`;

    bindSeg(view, 'aba', (v) => {
      aba = v;
      ctx.refresh(true);
    });
    view.querySelector('[data-quick]').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (!q) return;
      const p = parseQuick(q);
      if (!p.titulo) return;
      addTask({ ...p, prazo: aba === 'proximas' ? toISO(addDays(new Date(), 1)) : todayISO() });
      toast('Tarefa adicionada', { icon: '📝' });
    });
    view.querySelectorAll('[data-tag]').forEach((b) =>
      b.addEventListener('click', () => {
        tagAtiva = tagAtiva === b.dataset.tag ? null : b.dataset.tag;
        ctx.refresh();
      }),
    );
    view.querySelector('[data-full]').addEventListener('click', () => openTask());
    bindTaskList(view.querySelector('[data-list]'));
  },
};
