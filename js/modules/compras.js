import { state, commit, METODOS } from '../store.js';
import { esc, money, parseMoney, sum, todayISO, uid } from '../utils.js';
import { icon } from '../icons.js';
import { closeSheet, confirmSheet, emptyState, fields, invalid, openSheet, pop, toast } from '../ui.js';
import { addTransaction } from './financas.js';

const totalItem = (i) => (Number(i.qtd) || 1) * (Number(i.preco) || 0);

function listaAtiva() {
  let l = state.listas.find((x) => x.id === state.settings.listaAtiva);
  if (!l && state.listas.length) {
    l = state.listas[0];
    state.settings.listaAtiva = l.id;
  }
  return l;
}

export function openList(lista = null) {
  const l = lista || { nome: '', emoji: '🛒' };
  openSheet({
    title: lista ? 'Editar lista' : 'Nova lista',
    body: fields([
      [
        { name: 'emoji', label: 'Ícone', value: l.emoji, attrs: 'maxlength="4"' },
        { name: 'nome', label: 'Nome', value: l.nome, required: true, placeholder: 'Mercado, Farmácia…' },
      ],
    ]),
    extra: lista ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!(await confirmSheet(`Excluir a lista "${lista.nome}"?`, { okLabel: 'Excluir' }))) return;
        state.listas = state.listas.filter((x) => x.id !== lista.id);
        state.settings.listaAtiva = null;
        commit('listas', 'settings');
      });
    },
    onSubmit(v, form) {
      if (!v.nome) return invalid(form, 'nome', 'Dê um nome para a lista.');
      if (lista) Object.assign(lista, { nome: v.nome, emoji: v.emoji || '🛒' });
      else {
        const nova = { id: uid(), nome: v.nome, emoji: v.emoji || '🛒', itens: [] };
        state.listas.push(nova);
        state.settings.listaAtiva = nova.id;
      }
      commit('listas', 'settings');
    },
  });
}

export function openItem(item = null, lista = listaAtiva()) {
  const it = item || { nome: '', qtd: 1, preco: '' };
  openSheet({
    title: item ? 'Editar item' : `Adicionar em ${lista?.nome || 'lista'}`,
    body: fields([
      { name: 'nome', label: 'Item', value: it.nome, required: true },
      [
        { name: 'qtd', label: 'Quantidade', type: 'number', value: it.qtd, attrs: 'min="0" step="any" inputmode="decimal"' },
        { name: 'preco', label: 'Preço unitário (R$)', type: 'money', value: it.preco },
      ],
    ]),
    extra: item ? `<button type="button" class="btn btn--danger" data-del>${icon('trash')}</button>` : '',
    onOpen(panel) {
      panel.querySelector('[data-del]')?.addEventListener('click', () => {
        lista.itens = lista.itens.filter((x) => x.id !== item.id);
        commit('listas');
        closeSheet();
      });
    },
    onSubmit(v, form) {
      if (!v.nome) return invalid(form, 'nome', 'Informe o item.');
      if (!lista) return false;
      const data = { nome: v.nome, qtd: Number(v.qtd) || 1, preco: parseMoney(v.preco) || 0 };
      if (item) Object.assign(item, data);
      else lista.itens.push({ id: uid(), feito: false, ...data });
      commit('listas');
    },
  });
}

function finalizar(lista) {
  const marcados = lista.itens.filter((i) => i.feito);
  if (!marcados.length) {
    toast('Marque os itens que você pegou primeiro', { icon: '🛒' });
    return;
  }
  openSheet({
    title: 'Finalizar compra',
    body: `<p class="muted small" style="margin-bottom:12px">${marcados.length} itens marcados. O valor vira um gasto em Finanças e a lista é reiniciada para a próxima compra.</p>${fields([
      { name: 'valor', label: 'Valor pago (R$)', type: 'money', value: sum(marcados, totalItem), required: true },
      [
        { name: 'categoria', label: 'Categoria', type: 'select', value: 'mercado', options: state.categorias.filter((c) => c.tipo === 'despesa').map((c) => ({ value: c.id, label: `${c.emoji} ${c.nome}` })) },
        { name: 'metodo', label: 'Pagamento', type: 'select', value: 'Débito', options: METODOS.map((m) => ({ value: m, label: m })) },
      ],
    ])}`,
    submitLabel: 'Lançar gasto',
    onSubmit(v, form) {
      const valor = parseMoney(v.valor);
      if (!(valor > 0)) return invalid(form, 'valor', 'Informe o valor pago.');
      addTransaction({ tipo: 'despesa', valor, descricao: `${lista.emoji} ${lista.nome}`, categoria: v.categoria, metodo: v.metodo, data: todayISO() });
      lista.itens.forEach((i) => (i.feito = false));
      commit('listas', 'transacoes');
      toast(`Compra de ${money(valor)} lançada em Finanças`, { icon: '🧾' });
    },
  });
}

export default {
  id: 'compras',
  title: 'Compras',
  icon: 'cart',
  render(view, ctx) {
    const lista = listaAtiva();
    if (!lista) {
      view.innerHTML = `<div class="card">${emptyState('🛒', 'Nenhuma lista de compras', 'Crie listas reutilizáveis: mercado, farmácia, casa…')}
        <button class="btn btn--primary btn--block" data-first>${icon('plus')} Criar lista "Mercado"</button></div>`;
      view.querySelector('[data-first]').addEventListener('click', () => {
        const nova = { id: uid(), nome: 'Mercado', emoji: '🛒', itens: [] };
        state.listas.push(nova);
        state.settings.listaAtiva = nova.id;
        commit('listas', 'settings');
      });
      return;
    }
    const pend = lista.itens.filter((i) => !i.feito);
    const feitos = lista.itens.filter((i) => i.feito);
    const estimado = sum(lista.itens, totalItem);
    const carrinho = sum(feitos, totalItem);
    const item = (i) => `<li class="item ${i.feito ? 'is-done' : ''}" data-item="${esc(i.id)}">
      <button class="check ${i.feito ? 'is-on' : ''}" data-chk aria-label="${i.feito ? 'Desmarcar' : 'Marcar'}">${icon('check')}</button>
      <div class="item__body" data-edit role="button" tabindex="0"><div class="item__title">${esc(i.nome)}</div><div class="item__sub num">${i.qtd} × ${money(i.preco)}</div></div>
      <strong class="num small">${i.preco ? money(totalItem(i)) : ''}</strong>
    </li>`;

    view.innerHTML = `
      <div class="row" style="margin-bottom:12px;overflow-x:auto;padding-bottom:4px">
        ${state.listas.map((l) => `<button class="btn btn--sm ${l.id === lista.id ? 'btn--soft' : ''}" data-lista="${esc(l.id)}">${esc(l.emoji)} ${esc(l.nome)}</button>`).join('')}
        <button class="btn btn--ghost btn--sm" data-newlist>${icon('plus')} Lista</button>
      </div>
      <section class="card card--accent">
        <div class="row row--between">
          <div class="stat"><div class="stat__label">No carrinho</div><div class="stat__value num">${money(carrinho)}</div></div>
          <div class="stat" style="text-align:right"><div class="stat__label">Estimado</div><div class="stat__value num">${money(estimado)}</div></div>
        </div>
        <div class="progress" style="margin-top:12px"><div class="progress__bar" style="width:${lista.itens.length ? (feitos.length / lista.itens.length) * 100 : 0}%"></div></div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn--primary grow" data-finish>${icon('check')} Finalizar compra</button>
          <button class="icon-btn" data-editlist aria-label="Editar lista">${icon('edit')}</button>
        </div>
      </section>
      <form class="card card--tight row section" data-add>
        <input class="input grow" name="nome" placeholder="Adicionar item…" aria-label="Item" autocomplete="off" data-keep="shop-add" style="border:0;background:transparent">
        <input class="input" name="preco" placeholder="R$" inputmode="decimal" aria-label="Preço" style="width:84px">
        <button class="icon-btn" type="submit" aria-label="Adicionar">${icon('plus')}</button>
      </form>
      <div class="section" data-items>
        ${lista.itens.length ? '' : `<div class="card">${emptyState('📝', 'Lista vazia', 'Adicione itens acima.')}</div>`}
        ${pend.length ? `<ul class="list">${pend.map(item).join('')}</ul>` : ''}
        ${feitos.length ? `<div class="day-label">No carrinho (${feitos.length})</div><ul class="list">${feitos.map(item).join('')}</ul>` : ''}
      </div>`;

    view.querySelectorAll('[data-lista]').forEach((b) =>
      b.addEventListener('click', () => {
        state.settings.listaAtiva = b.dataset.lista;
        commit('settings');
        ctx.refresh(true);
      }),
    );
    view.querySelector('[data-newlist]').addEventListener('click', () => openList());
    view.querySelector('[data-editlist]').addEventListener('click', () => openList(lista));
    view.querySelector('[data-finish]').addEventListener('click', () => finalizar(lista));
    view.querySelector('[data-add]').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = e.target.nome.value.trim();
      if (!nome) return;
      lista.itens.push({ id: uid(), nome, qtd: 1, preco: parseMoney(e.target.preco.value) || 0, feito: false });
      commit('listas');
    });
    view.querySelector('[data-items]').addEventListener('click', (e) => {
      const li = e.target.closest('[data-item]');
      if (!li) return;
      const it = lista.itens.find((x) => x.id === li.dataset.item);
      if (e.target.closest('[data-chk]')) {
        const chk = li.querySelector('.check');
        chk.classList.toggle('is-on');
        pop(chk);
        setTimeout(() => {
          it.feito = !it.feito;
          commit('listas');
        }, 260);
      } else if (e.target.closest('[data-edit]')) openItem(it, lista);
    });
  },
};
