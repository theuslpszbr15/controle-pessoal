import { state, commit } from '../store.js';
import { daysBetween, esc, money, monthKey, monthLabel, parseMoney, relativeDay, sum, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { bindSeg, confirmSheet, emptyState, fields, invalid, openSheet, segHTML, toast } from '../ui.js';
import { gastosPorCategoria } from './financas.js';

let aba = 'metas';
let selecionada = null;
let jar = null;
let jarGoal = null;
let jarFailed = false;

const pct = (m) => (m.alvo > 0 ? Math.min(1, m.atual / m.alvo) : 0);

async function getJar() {
  if (jar || jarFailed) return jar;
  try {
    const { Jar } = await import('../fx/jar.js');
    jar = new Jar();
  } catch (err) {
    console.warn('3D indisponível', err);
    jarFailed = true;
  }
  return jar;
}

export function openGoal(meta = null) {
  const m = meta || { nome: '', emoji: '🎯', alvo: '', atual: 0, prazo: '' };
  openSheet({
    title: meta ? 'Editar meta' : 'Nova meta',
    body: fields([
      [
        { name: 'emoji', label: 'Ícone', value: m.emoji, attrs: 'maxlength="4"' },
        { name: 'nome', label: 'Nome', value: m.nome, required: true, placeholder: 'Viagem, Reserva…' },
      ],
      [
        { name: 'alvo', label: 'Quanto quer juntar', type: 'money', value: m.alvo, required: true },
        { name: 'atual', label: 'Já tem guardado', type: 'money', value: m.atual },
      ],
      { name: 'prazo', label: 'Prazo (opcional)', type: 'date', value: m.prazo },
    ]),
    extra: meta ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir a meta "${meta.nome}"?`, { okLabel: 'Excluir' }))) return;
        state.metas = state.metas.filter((x) => x.id !== meta.id);
        commit('metas');
        toast('Meta excluída', { icon: '🗑️' });
      });
    },
    onSubmit(v, form) {
      const alvo = parseMoney(v.alvo);
      if (!v.nome) return invalid(form, 'nome', 'Dê um nome para a meta.');
      if (!(alvo > 0)) return invalid(form, 'alvo', 'Informe o valor da meta.');
      const data = { nome: v.nome, emoji: v.emoji || '🎯', alvo, atual: parseMoney(v.atual) || 0, prazo: v.prazo };
      if (meta) Object.assign(meta, data);
      else {
        const nova = { id: uid(), depositos: [], ...data };
        state.metas.push(nova);
        selecionada = nova.id;
      }
      commit('metas');
      toast(meta ? 'Meta atualizada' : 'Meta criada', { icon: data.emoji });
    },
  });
}

function openDeposit(meta, sinal = 1) {
  openSheet({
    title: sinal > 0 ? `Guardar em ${meta.nome}` : `Retirar de ${meta.nome}`,
    body: fields([{ name: 'valor', label: 'Valor (R$)', type: 'money', required: true }]),
    submitLabel: sinal > 0 ? 'Guardar' : 'Retirar',
    onSubmit(v, form) {
      const valor = parseMoney(v.valor);
      if (!(valor > 0)) return invalid(form, 'valor', 'Informe um valor.');
      meta.atual = Math.max(0, Math.round((meta.atual + valor * sinal) * 100) / 100);
      meta.depositos = [...(meta.depositos || []), { data: todayISO(), valor: valor * sinal }];
      commit('metas');
      if (sinal > 0 && meta.atual >= meta.alvo) toast(`Meta "${meta.nome}" concluída! 🎉`, { icon: '🏆', timeout: 5000 });
      else toast(sinal > 0 ? `${money(valor)} guardados` : `${money(valor)} retirados`, { icon: sinal > 0 ? '🪙' : '↩️' });
    },
  });
}

export function openBudget(cat) {
  openSheet({
    title: `Orçamento: ${cat.nome}`,
    body: `<p class="muted small" style="margin-bottom:12px">Limite mensal para ${esc(cat.emoji)} ${esc(cat.nome)}. Deixe vazio para remover.</p>${fields([
      { name: 'limite', label: 'Limite por mês (R$)', type: 'money', value: state.orcamentos[cat.id] || '' },
    ])}`,
    onSubmit(v) {
      const limite = parseMoney(v.limite);
      if (limite > 0) state.orcamentos[cat.id] = limite;
      else delete state.orcamentos[cat.id];
      commit('orcamentos');
      toast('Orçamento salvo', { icon: '📊' });
    },
  });
}

function prazoTexto(m) {
  if (!m.prazo) return '';
  const dias = daysBetween(todayISO(), m.prazo);
  if (dias < 0) return 'Prazo vencido';
  const meses = Math.max(1, Math.ceil(dias / 30));
  const falta = Math.max(0, m.alvo - m.atual);
  return `${relativeDay(m.prazo)} · ${money(falta / meses)}/mês`;
}

function renderMetas() {
  if (!state.metas.length) {
    return `<div class="card">${emptyState('🫙', 'Nenhuma meta ainda', 'Crie uma meta e veja o pote encher a cada depósito.')}
      <button class="btn btn--primary btn--block" data-new>${icon('plus')} Criar meta</button></div>`;
  }
  if (!state.metas.some((m) => m.id === selecionada)) selecionada = state.metas[0].id;
  const m = state.metas.find((x) => x.id === selecionada);
  const p = pct(m);
  const tresD = state.settings.tresD && !jarFailed;
  return `
    <div class="card card--accent">
      ${tresD ? `<div class="jar" data-jar><div class="jar__label"><strong class="display" style="font-size:1.2rem">${esc(m.emoji)} ${esc(m.nome)}</strong><div class="muted small num">${money(m.atual)} de ${money(m.alvo)}</div></div><div class="jar__pct num">${Math.round(p * 100)}%</div></div>`
        : `<div class="row row--between"><strong class="display" style="font-size:1.2rem">${esc(m.emoji)} ${esc(m.nome)}</strong><span class="display" style="font-size:1.8rem">${Math.round(p * 100)}%</span></div>
           <div class="muted small num" style="margin:4px 0 10px">${money(m.atual)} de ${money(m.alvo)}</div><div class="progress"><div class="progress__bar" style="width:${p * 100}%"></div></div>`}
      <div class="row" style="margin-top:12px">
        <button class="btn btn--primary grow" data-dep>${icon('plus')} Guardar</button>
        <button class="btn grow" data-ret>Retirar</button>
        <button class="icon-btn" data-edit aria-label="Editar meta">${icon('edit')}</button>
      </div>
    </div>
    <section class="section">
      <div class="section__head"><h2>Minhas metas</h2><button class="btn btn--soft btn--sm" data-new>${icon('plus')} Nova</button></div>
      <div class="grid grid--auto">
        ${state.metas
          .map((g) => {
            const gp = pct(g);
            return `<button class="card card--tight goal ${g.id === selecionada ? 'is-selected' : ''}" data-goal="${esc(g.id)}" style="text-align:left;font:inherit;color:inherit">
            <div class="row row--between"><strong>${esc(g.emoji)} ${esc(g.nome)}</strong><span class="chip ${gp >= 1 ? 'chip--success' : 'chip--accent'}">${Math.round(gp * 100)}%</span></div>
            <div class="muted small num" style="margin:6px 0 8px">${money(g.atual)} de ${money(g.alvo)}</div>
            <div class="progress"><div class="progress__bar" style="width:${gp * 100}%"></div></div>
            ${g.prazo ? `<div class="muted small" style="margin-top:8px">${esc(prazoTexto(g))}</div>` : ''}
          </button>`;
          })
          .join('')}
      </div>
    </section>`;
}

function renderOrcamento() {
  const key = monthKey();
  const gastos = new Map(gastosPorCategoria(key).map((g) => [g.id, g.valor]));
  const cats = state.categorias.filter((c) => c.tipo === 'despesa');
  const orcado = sum(Object.values(state.orcamentos));
  const gastoOrcado = sum(Object.keys(state.orcamentos), (id) => gastos.get(id) || 0);
  return `
    <div class="card card--accent">
      <div class="card__title">${esc(monthLabel(key))}</div>
      <div class="row row--between"><div class="stat"><div class="stat__label">Gasto nas categorias com limite</div><div class="stat__value num">${money(gastoOrcado)}</div></div>
      <div class="stat" style="text-align:right"><div class="stat__label">Orçado</div><div class="stat__value num">${money(orcado)}</div></div></div>
      <div class="progress ${gastoOrcado > orcado ? 'is-over' : gastoOrcado > orcado * 0.8 ? 'is-warn' : ''}" style="margin-top:10px"><div class="progress__bar" style="width:${orcado ? Math.min(100, (gastoOrcado / orcado) * 100) : 0}%"></div></div>
    </div>
    <p class="muted small" style="margin:14px 4px 8px">Toque numa categoria para definir o limite mensal. Você recebe um aviso ao passar de 80% e de 100%.</p>
    <ul class="list">
      ${cats
        .map((c) => {
          const lim = state.orcamentos[c.id];
          const g = gastos.get(c.id) || 0;
          const r = lim ? g / lim : 0;
          const cls = r > 1 ? 'is-over' : r >= 0.8 ? 'is-warn' : '';
          return `<li class="item" data-cat="${esc(c.id)}" role="button" tabindex="0">
          <span class="item__icon">${esc(c.emoji)}</span>
          <div class="item__body"><div class="row row--between"><span class="item__title">${esc(c.nome)}</span>
            <span class="small num ${r > 1 ? 'neg' : 'muted'}">${money(g)}${lim ? ` / ${money(lim)}` : ''}</span></div>
            ${lim ? `<div class="progress ${cls}" style="margin-top:8px"><div class="progress__bar" style="width:${Math.min(100, r * 100)}%"></div></div>` : '<div class="item__sub">Sem limite definido</div>'}
          </div></li>`;
        })
        .join('')}
    </ul>`;
}

export default {
  id: 'metas',
  title: 'Metas',
  icon: 'target',
  render(view, ctx) {
    view.innerHTML = `
      <div style="margin-bottom:14px">${segHTML([{ value: 'metas', label: '🫙 Metas' }, { value: 'orcamento', label: '📊 Orçamento' }], aba, 'aba')}</div>
      <div data-body>${aba === 'metas' ? renderMetas() : renderOrcamento()}</div>`;

    bindSeg(view, 'aba', (v) => {
      aba = v;
      ctx.refresh(true);
    });

    const body = view.querySelector('[data-body]');
    body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-new],[data-dep],[data-ret],[data-edit],[data-goal],[data-cat]');
      if (!t) return;
      const meta = state.metas.find((x) => x.id === selecionada);
      if (t.dataset.new !== undefined) openGoal();
      else if (t.dataset.dep !== undefined) openDeposit(meta, 1);
      else if (t.dataset.ret !== undefined) openDeposit(meta, -1);
      else if (t.dataset.edit !== undefined) openGoal(meta);
      else if (t.dataset.goal) {
        selecionada = t.dataset.goal;
        ctx.refresh();
      } else if (t.dataset.cat) openBudget(state.categorias.find((c) => c.id === t.dataset.cat));
    });
    body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-cat]')) e.target.click();
    });

    const box = view.querySelector('[data-jar]');
    if (box) {
      const meta = state.metas.find((x) => x.id === selecionada);
      getJar().then((j) => {
        if (!j || !box.isConnected) {
          if (!j) ctx.refresh();
          return;
        }
        j.mount(box);
        if (jarGoal !== meta.id) j.setProgress(0);
        jarGoal = meta.id;
        j.setProgress(pct(meta));
      });
    }
    return () => jar?.stop();
  },
  onTheme() {
    jar?.applyTheme();
  },
};
