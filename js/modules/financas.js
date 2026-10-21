import { state, commit, categoria, METODOS } from '../store.js';
import {
  addMonths, dayLabel, esc, groupBy, money, monthKey, monthLabel, monthShort, parseMoney, relativeDay, safeColor, sum, todayISO, uid,
} from '../utils.js';
import { icon } from '../icons.js';
import { bindSeg, closeSheet, emptyState, fields, invalid, openSheet, segHTML, toast } from '../ui.js';
import { countTo } from '../textmorph.js';
import { Bubbles } from '../fx/physics.js';

let mes = monthKey();
let filtro = '';
let tipoFiltro = 'todos';
let bubbles = null;

export const txDoMes = (key) => state.transacoes.filter((t) => t.data.startsWith(key));

export function resumoMes(key) {
  const tx = txDoMes(key);
  const rec = sum(tx.filter((t) => t.tipo === 'receita'), (t) => t.valor);
  const desp = sum(tx.filter((t) => t.tipo === 'despesa'), (t) => t.valor);
  return { rec, desp, saldo: rec - desp, tx };
}

export function gastosPorCategoria(key) {
  const tx = txDoMes(key).filter((t) => t.tipo === 'despesa');
  return [...groupBy(tx, (t) => t.categoria)]
    .map(([id, list]) => {
      const c = categoria(id);
      return { id, nome: c.nome, emoji: c.emoji, cor: safeColor(c.cor), valor: sum(list, (t) => t.valor) };
    })
    .sort((a, b) => b.valor - a.valor);
}

export function addTransaction(t) {
  const tx = { id: uid(), tipo: 'despesa', metodo: 'Pix', data: todayISO(), ...t };
  state.transacoes.push(tx);
  commit('transacoes');
  return tx;
}

const catOptions = (tipo) => state.categorias.filter((c) => c.tipo === tipo).map((c) => ({ value: c.id, label: `${c.emoji} ${c.nome}` }));

export function openTransaction({ tipo = 'despesa', tx = null } = {}) {
  const t = tx || { tipo, valor: '', descricao: '', categoria: tipo === 'receita' ? 'salario' : 'alimentacao', data: todayISO(), metodo: 'Pix' };
  openSheet({
    title: tx ? 'Editar lançamento' : t.tipo === 'receita' ? 'Nova receita' : 'Novo gasto',
    body: fields([
      { name: 'tipo', label: 'Tipo', type: 'radio', value: t.tipo, options: [{ value: 'despesa', label: '↓ Despesa' }, { value: 'receita', label: '↑ Receita' }] },
      { name: 'valor', label: 'Valor (R$)', type: 'money', value: t.valor, required: true },
      { name: 'descricao', label: 'Descrição', value: t.descricao, placeholder: 'Ex.: Almoço, Uber, Salário…' },
      [
        { name: 'categoria', label: 'Categoria', type: 'select', value: t.categoria, options: catOptions(t.tipo) },
        { name: 'metodo', label: 'Pagamento', type: 'select', value: t.metodo, options: METODOS.map((m) => ({ value: m, label: m })) },
      ],
      { name: 'data', label: 'Data', type: 'date', value: t.data, required: true },
    ]),
    extra: tx ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      const sel = panel.querySelector('select[name=categoria]');
      panel.querySelectorAll('input[name=tipo]').forEach((r) =>
        r.addEventListener('change', () => {
          sel.innerHTML = catOptions(r.value).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
        }),
      );
      panel.querySelector('[data-del]')?.addEventListener('click', () => removeTransaction(tx.id));
    },
    onSubmit(v, form) {
      const valor = parseMoney(v.valor);
      if (!(valor > 0)) return invalid(form, 'valor', 'Informe um valor maior que zero.');
      if (!v.data) return invalid(form, 'data', 'Informe a data.');
      const data = { tipo: v.tipo, valor, descricao: v.descricao || categoria(v.categoria).nome, categoria: v.categoria, metodo: v.metodo, data: v.data };
      if (tx) Object.assign(tx, data);
      else addTransaction(data);
      commit('transacoes');
      toast(tx ? 'Lançamento atualizado' : `${v.tipo === 'receita' ? 'Receita' : 'Gasto'} de ${money(valor)} salvo`, { icon: v.tipo === 'receita' ? '💰' : '🧾' });
      if (data.tipo === 'despesa') setTimeout(() => alertaOrcamento(data.categoria, data.data.slice(0, 7)), 600);
    },
  });
}

export function alertaOrcamento(catId, key) {
  const limite = state.orcamentos[catId];
  if (!limite) return;
  const gasto = sum(txDoMes(key).filter((t) => t.tipo === 'despesa' && t.categoria === catId), (t) => t.valor);
  const c = categoria(catId);
  if (gasto > limite) toast(`${c.nome}: orçamento estourado (${money(gasto)} de ${money(limite)})`, { icon: '🚨', timeout: 5000 });
  else if (gasto >= limite * 0.8) toast(`${c.nome}: ${Math.round((gasto / limite) * 100)}% do orçamento usado`, { icon: '⚠️', timeout: 5000 });
}

function removeTransaction(id) {
  const i = state.transacoes.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [removed] = state.transacoes.splice(i, 1);
  commit('transacoes');
  closeSheet();
  toast('Lançamento excluído', {
    icon: '🗑️',
    action: {
      label: 'Desfazer',
      onClick: () => {
        state.transacoes.splice(i, 0, removed);
        commit('transacoes');
      },
    },
  });
}

export function txItem(t) {
  const c = categoria(t.categoria);
  const cor = safeColor(c.cor);
  const sinal = t.tipo === 'receita' ? '+' : '−';
  return `<li class="item" data-tx="${esc(t.id)}" data-search="${esc(`${t.descricao} ${c.nome} ${t.metodo}`.toLowerCase())}" role="button" tabindex="0">
    <span class="item__icon" style="background:${cor}2e">${esc(c.emoji)}</span>
    <div class="item__body"><div class="item__title">${esc(t.descricao)}</div><div class="item__sub">${esc(c.nome)} · ${esc(t.metodo)}</div></div>
    <div class="item__end num ${t.tipo === 'receita' ? 'pos' : ''}" style="font-weight:800">${sinal} ${money(t.valor)}</div>
  </li>`;
}

export function bindTxList(root) {
  root.addEventListener('click', (e) => {
    const li = e.target.closest('[data-tx]');
    if (!li) return;
    const tx = state.transacoes.find((t) => t.id === li.dataset.tx);
    if (tx) openTransaction({ tx });
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-tx]')) e.target.click();
  });
}

function donut(cats, total) {
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = cats
    .map((c) => {
      const len = (c.valor / total) * C;
      const seg = `<circle cx="70" cy="70" r="${R}" stroke="${c.cor}" stroke-dasharray="${Math.max(len - 2, 0.1)} ${C}" stroke-dashoffset="${-acc}"/>`;
      acc += len;
      return seg;
    })
    .join('');
  return `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Gastos por categoria">
    <circle cx="70" cy="70" r="${R}" stroke="var(--surface-3)"/>
    <g transform="rotate(-90 70 70)">${arcs}</g>
    <text x="70" y="66" text-anchor="middle" fill="var(--muted)" font-size="10" font-weight="700">TOTAL</text>
    <text x="70" y="84" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="800" font-family="var(--font-display)">${esc(money(total).replace(',00', ''))}</text>
  </svg>`;
}

function bars6(key) {
  const meses = Array.from({ length: 6 }, (_, i) => addMonths(key, i - 5));
  const dados = meses.map((m) => ({ m, ...resumoMes(m) }));
  const max = Math.max(1, ...dados.flatMap((d) => [d.rec, d.desp]));
  return `<div class="bars">${dados
    .map(
      (d) => `<div class="bars__col" title="${esc(monthLabel(d.m))}: receitas ${money(d.rec)}, despesas ${money(d.desp)}">
      <div class="bars__pair"><div class="bars__bar bars__bar--in" data-h="${(d.rec / max) * 100}"></div><div class="bars__bar bars__bar--out" data-h="${(d.desp / max) * 100}"></div></div>
      <span class="bars__label">${esc(monthShort(d.m))}</span></div>`,
    )
    .join('')}</div>
    <div class="legend-inline"><span><i class="dot" style="background:var(--success)"></i>Receitas</span><span><i class="dot" style="background:var(--accent-2)"></i>Despesas</span></div>`;
}

export function growBars(root) {
  root.querySelectorAll('[data-h]').forEach((b) => {
    const h = `${Math.max(2, Number(b.dataset.h))}%`;
    if (window.gsap) window.gsap.fromTo(b, { height: '2%' }, { height: h, duration: 0.9, ease: 'power3.out', delay: 0.1 });
    else b.style.height = h;
  });
}

export function monthNav(label) {
  return `<div class="month-nav">
    <button class="icon-btn" data-mes="-1" aria-label="Mês anterior">${icon('left')}</button>
    <span class="month-nav__label">${esc(label)}</span>
    <button class="icon-btn" data-mes="1" aria-label="Próximo mês">${icon('right')}</button>
  </div>`;
}

export default {
  id: 'financas',
  title: 'Finanças',
  icon: 'wallet',
  render(view, ctx) {
    const { rec, desp, saldo, tx } = resumoMes(mes);
    const cats = gastosPorCategoria(mes);
    const lista = tx
      .filter((t) => tipoFiltro === 'todos' || t.tipo === tipoFiltro)
      .sort((a, b) => b.data.localeCompare(a.data) || 0);
    const grupos = [...groupBy(lista, (t) => t.data)];
    const fisica = state.settings.fisica && window.Matter;

    view.innerHTML = `
      ${monthNav(monthLabel(mes))}
      <section class="card card--accent summary">
        <div class="stat stat--big"><div class="stat__label">Saldo do mês</div><div class="stat__value ${saldo < 0 ? 'neg' : ''}" data-count="fin-saldo"></div></div>
        <div class="stat"><div class="stat__label">${icon('up')} Receitas</div><div class="stat__value pos" data-count="fin-rec"></div></div>
        <div class="stat"><div class="stat__label">${icon('down')} Despesas</div><div class="stat__value" data-count="fin-desp"></div></div>
      </section>

      <div class="grid grid--wide section">
        <div class="card">
          <div class="card__title">Para onde foi o dinheiro</div>
          ${cats.length && fisica ? `<div class="bubbles"><span class="bubbles__hint">Arraste as bolhas · toque para ver o total</span></div>` : ''}
          ${!cats.length ? emptyState('🫧', 'Sem gastos neste mês', 'Toque em + para lançar o primeiro.') : ''}
          ${cats.length && !fisica ? `<div class="donut-wrap">${donut(cats, desp)}<ul class="legend list">${legend(cats, desp)}</ul></div>` : ''}
        </div>
        <div class="card">
          ${cats.length && fisica ? `<div class="card__title">Por categoria</div><div class="donut-wrap">${donut(cats, desp)}<ul class="legend list">${legend(cats, desp)}</ul></div><div class="divider"></div>` : ''}
          <div class="card__title">Últimos 6 meses</div>
          ${bars6(mes)}
        </div>
      </div>

      <section class="section">
        <div class="section__head"><h2>Lançamentos</h2><button class="btn btn--soft btn--sm" data-add>${icon('plus')} Lançar</button></div>
        <div class="row row--wrap" style="margin-bottom:10px">
          ${segHTML([{ value: 'todos', label: 'Todos' }, { value: 'despesa', label: 'Despesas' }, { value: 'receita', label: 'Receitas' }], tipoFiltro, 'tipo')}
          <label class="search grow" style="min-width:180px">${icon('search')}<span class="sr-only">Buscar</span><input class="input" type="search" placeholder="Buscar lançamento" value="${esc(filtro)}" data-keep="fin-busca"></label>
        </div>
        <div data-list>
          ${grupos.length ? grupos.map(([d, items]) => `<div class="day-label">${esc(relativeDay(d) === dayLabel(d) ? dayLabel(d) : `${relativeDay(d)} · ${dayLabel(d)}`)}</div><ul class="list">${items.map(txItem).join('')}</ul>`).join('') : emptyState('🧾', 'Nenhum lançamento', 'Seus gastos e receitas aparecem aqui.')}
        </div>
      </section>`;

    countTo(view.querySelector('[data-count=fin-saldo]'), saldo, money);
    countTo(view.querySelector('[data-count=fin-rec]'), rec, money);
    countTo(view.querySelector('[data-count=fin-desp]'), desp, money);
    growBars(view);

    view.querySelectorAll('[data-mes]').forEach((b) =>
      b.addEventListener('click', () => {
        mes = addMonths(mes, Number(b.dataset.mes));
        ctx.refresh(true);
      }),
    );
    view.querySelector('[data-add]').addEventListener('click', () => openTransaction());
    bindSeg(view, 'tipo', (v) => {
      tipoFiltro = v;
      ctx.refresh();
    });
    const busca = view.querySelector('input[type=search]');
    const aplicarBusca = () => {
      filtro = busca.value;
      const q = filtro.toLowerCase().trim();
      view.querySelectorAll('[data-list] .item').forEach((li) => (li.hidden = q && !li.dataset.search.includes(q)));
    };
    busca.addEventListener('input', aplicarBusca);
    if (filtro) aplicarBusca();
    bindTxList(view.querySelector('[data-list]'));

    const box = view.querySelector('.bubbles');
    if (box) {
      bubbles ||= new Bubbles({ onTap: (m) => toast(`${m.nome}: ${money(m.value)} (${Math.round(m.pct * 100)}%)`, { icon: m.emoji }) });
      bubbles.mount(box, cats.map((c) => ({ id: c.id, nome: c.nome, emoji: c.emoji, color: c.cor, value: c.valor })));
    }
    return () => bubbles?.stop();
  },
};

function legend(cats, total) {
  return cats
    .slice(0, 6)
    .map((c) => `<li><i class="dot" style="background:${c.cor}"></i><span>${esc(c.emoji)} ${esc(c.nome)}</span><strong class="num">${Math.round((c.valor / total) * 100)}%</strong></li>`)
    .join('');
}
