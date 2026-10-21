import { state, commit, categoria, METODOS } from '../store.js';
import { addMonths, daysBetween, daysInMonth, esc, money, monthKey, monthLabel, pad, parseMoney, sum, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { confirmSheet, emptyState, fields, invalid, openSheet, pop, toast } from '../ui.js';
import { addTransaction, monthNav } from './financas.js';
import { countTo } from '../textmorph.js';

let mes = monthKey();

export const vencimento = (c, key) => `${key}-${pad(Math.min(c.dia, daysInMonth(key)))}`;
const ativaNoMes = (c, key) => !c.inicio || c.inicio <= key;
export const contasDoMes = (key) => state.contas.filter((c) => ativaNoMes(c, key)).sort((a, b) => a.dia - b.dia);
export const estaPaga = (c, key) => !!c.pagamentos?.[key];

export function statusConta(c, key) {
  if (estaPaga(c, key)) return { label: 'Paga', cls: 'chip--success' };
  const d = daysBetween(todayISO(), vencimento(c, key));
  if (d < 0) return { label: `Atrasada ${-d}d`, cls: 'chip--danger' };
  if (d === 0) return { label: 'Vence hoje', cls: 'chip--warning' };
  if (d <= 3) return { label: `Vence em ${d}d`, cls: 'chip--warning' };
  return { label: `Dia ${c.dia}`, cls: '' };
}

export function proximasContas(n = 3) {
  const key = monthKey();
  return contasDoMes(key)
    .filter((c) => !estaPaga(c, key))
    .map((c) => ({ c, venc: vencimento(c, key) }))
    .sort((a, b) => a.venc.localeCompare(b.venc))
    .slice(0, n);
}

export function togglePaga(c, key) {
  c.pagamentos ||= {};
  if (estaPaga(c, key)) {
    const txId = c.pagamentos[key].txId;
    state.transacoes = state.transacoes.filter((t) => t.id !== txId);
    delete c.pagamentos[key];
    commit('contas', 'transacoes');
    toast(`${c.nome} marcada como pendente`, { icon: '↩️' });
    return false;
  }
  const hoje = todayISO();
  const tx = addTransaction({
    tipo: 'despesa', valor: c.valor, descricao: c.nome, categoria: c.categoria, metodo: c.metodo || 'Pix',
    data: hoje.startsWith(key) ? hoje : vencimento(c, key),
  });
  c.pagamentos[key] = { txId: tx.id, data: hoje };
  commit('contas', 'transacoes');
  toast(`${c.nome} paga · lançada em Finanças`, { icon: '✅' });
  return true;
}

export function openBill(conta = null) {
  const c = conta || { nome: '', emoji: '🧾', valor: '', dia: new Date().getDate(), categoria: 'contas', metodo: 'Pix' };
  openSheet({
    title: conta ? 'Editar conta' : 'Nova conta fixa',
    body: fields([
      [
        { name: 'emoji', label: 'Ícone', value: c.emoji, attrs: 'maxlength="4"' },
        { name: 'nome', label: 'Nome', value: c.nome, required: true, placeholder: 'Aluguel, Netflix…' },
      ],
      [
        { name: 'valor', label: 'Valor (R$)', type: 'money', value: c.valor, required: true },
        { name: 'dia', label: 'Dia do vencimento', type: 'number', value: c.dia, attrs: 'min="1" max="31" inputmode="numeric"' },
      ],
      [
        { name: 'categoria', label: 'Categoria', type: 'select', value: c.categoria, options: state.categorias.filter((x) => x.tipo === 'despesa').map((x) => ({ value: x.id, label: `${x.emoji} ${x.nome}` })) },
        { name: 'metodo', label: 'Pagamento', type: 'select', value: c.metodo, options: METODOS.map((m) => ({ value: m, label: m })) },
      ],
    ]),
    extra: conta ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir "${conta.nome}"? Os pagamentos já lançados continuam em Finanças.`, { okLabel: 'Excluir' }))) return;
        state.contas = state.contas.filter((x) => x.id !== conta.id);
        commit('contas');
      });
    },
    onSubmit(v, form) {
      const valor = parseMoney(v.valor);
      const dia = Number(v.dia);
      if (!v.nome) return invalid(form, 'nome', 'Informe o nome da conta.');
      if (!(valor > 0)) return invalid(form, 'valor', 'Informe o valor.');
      if (!(dia >= 1 && dia <= 31)) return invalid(form, 'dia', 'O dia deve ser entre 1 e 31.');
      const data = { nome: v.nome, emoji: v.emoji || '🧾', valor, dia, categoria: v.categoria, metodo: v.metodo };
      if (conta) Object.assign(conta, data);
      else state.contas.push({ id: uid(), inicio: monthKey(), pagamentos: {}, ...data });
      commit('contas');
      toast(conta ? 'Conta atualizada' : 'Conta adicionada', { icon: data.emoji });
    },
  });
}

export default {
  id: 'contas',
  title: 'Contas',
  icon: 'receipt',
  render(view, ctx) {
    const lista = contasDoMes(mes);
    const total = sum(lista, (c) => c.valor);
    const pago = sum(lista.filter((c) => estaPaga(c, mes)), (c) => c.valor);
    const assin = state.contas.filter((c) => c.categoria === 'assinaturas');
    const assinMes = sum(assin, (c) => c.valor);

    view.innerHTML = `
      ${monthNav(monthLabel(mes))}
      <section class="card card--accent">
        <div class="summary">
          <div class="stat stat--big"><div class="stat__label">Pendente</div><div class="stat__value" data-count="ct-pend"></div></div>
          <div class="stat"><div class="stat__label">Total do mês</div><div class="stat__value" data-count="ct-total"></div></div>
          <div class="stat"><div class="stat__label">Pago</div><div class="stat__value pos" data-count="ct-pago"></div></div>
        </div>
        <div class="progress" style="margin-top:12px"><div class="progress__bar" style="width:${total ? (pago / total) * 100 : 0}%"></div></div>
        ${assin.length ? `<div class="chips" style="margin-top:12px"><span class="chip chip--accent">📺 Assinaturas: ${money(assinMes)}/mês · ${money(assinMes * 12)}/ano</span></div>` : ''}
      </section>
      <section class="section">
        <div class="section__head"><h2>Vencimentos</h2><button class="btn btn--soft btn--sm" data-new>${icon('plus')} Nova conta</button></div>
        ${lista.length ? `<ul class="list">${lista
          .map((c) => {
            const st = statusConta(c, mes);
            const paga = estaPaga(c, mes);
            return `<li class="item ${paga ? 'is-done' : ''}" data-id="${esc(c.id)}">
              <button class="check ${paga ? 'is-on' : ''}" data-pay aria-label="${paga ? 'Desmarcar pagamento' : 'Marcar como paga'}">${icon('check')}</button>
              <span class="item__icon">${esc(c.emoji)}</span>
              <div class="item__body" data-edit role="button" tabindex="0"><div class="item__title">${esc(c.nome)}</div><div class="item__sub">Todo dia ${c.dia} · ${esc(categoria(c.categoria).nome)}</div></div>
              <div class="item__end" style="flex-direction:column;align-items:flex-end"><strong class="num">${money(c.valor)}</strong><span class="chip ${st.cls}">${esc(st.label)}</span></div>
            </li>`;
          })
          .join('')}</ul>` : `<div class="card">${emptyState('🧾', 'Nenhuma conta fixa', 'Cadastre aluguel, internet, assinaturas… e marque como paga com um toque.')}</div>`}
      </section>`;

    countTo(view.querySelector('[data-count=ct-total]'), total, money);
    countTo(view.querySelector('[data-count=ct-pago]'), pago, money);
    countTo(view.querySelector('[data-count=ct-pend]'), total - pago, money);

    view.querySelectorAll('[data-mes]').forEach((b) =>
      b.addEventListener('click', () => {
        mes = addMonths(mes, Number(b.dataset.mes));
        ctx.refresh(true);
      }),
    );
    view.querySelector('[data-new]').addEventListener('click', () => openBill());
    view.querySelector('.list')?.addEventListener('click', (e) => {
      const li = e.target.closest('[data-id]');
      if (!li) return;
      const c = state.contas.find((x) => x.id === li.dataset.id);
      if (e.target.closest('[data-pay]')) {
        const chk = li.querySelector('.check');
        chk.classList.toggle('is-on');
        pop(chk);
        setTimeout(() => togglePaga(c, mes), 380);
      } else if (e.target.closest('[data-edit]')) openBill(c);
    });
  },
};
