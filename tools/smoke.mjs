// Teste de fumaça: abre o app no Chrome headless, popula dados de exemplo, visita todas as telas,
// troca de temas e salva capturas em screens/. Falha se houver erros de JavaScript.
// Uso: CHROME_PATH=... [PUPPETEER_CORE=...] node tools/smoke.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const pptrPath = process.env.PUPPETEER_CORE;
const puppeteer = pptrPath ? createRequire(join(pptrPath, '..', 'noop.js'))('puppeteer-core') : (await import('puppeteer-core')).default;

const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
mkdirSync('screens', { recursive: true });

const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-unsafe-webgpu'],
});
const errors = [];
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  // 400 esperado no teste de senha errada
  if (m.type() === 'error' && !m.text().includes('status of 400')) errors.push(`console: ${m.text()}`);
});
page.on('requestfailed', (r) => {
  if (!r.url().includes('fonts.g') && !r.url().includes('googleapis.com')) errors.push(`requestfailed: ${r.url()}`);
});

const desktop = process.argv.includes('--desktop');
await page.setViewport(desktop ? { width: 1366, height: 860, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'networkidle0' });
const suffixAuth = process.argv.includes('--desktop') ? '-desktop' : '';
// Usuário temporário na nuvem (apagado no final do teste)
const USER = `smoke${Date.now().toString(36)}`;
const SENHA = 'segredo123';
await page.waitForSelector('#auth form');
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `screens/auth-cadastro${suffixAuth}.png` });
await page.type('#auth [name=nome]', 'Matheus');
await page.type('#auth [name=usuario]', USER);
await page.type('#auth [name=senha]', SENHA);
await page.type('#auth [name=senha2]', SENHA);
await page.click('#auth [data-submit]');
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: `screens/boas-vindas${suffixAuth}.png` });
await page.waitForSelector('.page', { timeout: 20000 });

// Dados de exemplo usando os próprios módulos do app
await page.evaluate(async () => {
  const { state, commit } = await import('/js/store.js');
  const { toISO, addDays, monthKey } = await import('/js/utils.js');
  const d = (n) => toISO(addDays(new Date(), n));
  const id = () => crypto.randomUUID();
  state.settings.nome = 'Matheus';
  const tx = [
    ['receita', 6200, 'Salário', 'salario', 'Transferência', -18],
    ['despesa', 1800, 'Aluguel', 'moradia', 'Pix', -15],
    ['despesa', 642.3, 'Mercado do mês', 'mercado', 'Débito', -10],
    ['despesa', 89.9, 'Pizza', 'alimentacao', 'Crédito', -3],
    ['despesa', 45, 'Almoço', 'alimentacao', 'Pix', 0],
    ['despesa', 120, 'Uber', 'transporte', 'Crédito', -2],
    ['despesa', 55.9, 'Netflix', 'assinaturas', 'Crédito', -8],
    ['despesa', 210, 'Farmácia', 'saude', 'Débito', -6],
    ['despesa', 160, 'Cinema e jantar', 'lazer', 'Crédito', -1],
    ['despesa', 98, 'Ração', 'pets', 'Pix', -4],
    ['receita', 900, 'Freela site', 'freela', 'Pix', -5],
  ];
  state.transacoes = tx.map(([tipo, valor, descricao, categoria, metodo, n]) => ({ id: id(), tipo, valor, descricao, categoria, metodo, data: d(n) }));
  for (let m = 1; m <= 5; m++) {
    const dt = addDays(new Date(), -30 * m);
    state.transacoes.push({ id: id(), tipo: 'receita', valor: 6200, descricao: 'Salário', categoria: 'salario', metodo: 'Pix', data: toISO(dt) });
    state.transacoes.push({ id: id(), tipo: 'despesa', valor: 3500 + m * 230, descricao: 'Gastos', categoria: 'outros', metodo: 'Pix', data: toISO(dt) });
  }
  state.orcamentos = { alimentacao: 150, mercado: 800, lazer: 300 };
  state.metas = [
    { id: id(), nome: 'Viagem pra praia', emoji: '🏖️', alvo: 5000, atual: 2150, prazo: d(120), depositos: [] },
    { id: id(), nome: 'Reserva de emergência', emoji: '🛟', alvo: 15000, atual: 9800, prazo: '', depositos: [] },
  ];
  state.contas = [
    { id: id(), nome: 'Aluguel', emoji: '🏠', valor: 1800, dia: 5, categoria: 'moradia', metodo: 'Pix', inicio: '2020-01', pagamentos: { [monthKey()]: { txId: 'x', data: d(0) } } },
    { id: id(), nome: 'Internet', emoji: '📶', valor: 119.9, dia: new Date().getDate() + 1 > 28 ? 28 : new Date().getDate() + 1, categoria: 'contas', metodo: 'Boleto', inicio: '2020-01', pagamentos: {} },
    { id: id(), nome: 'Spotify', emoji: '🎧', valor: 21.9, dia: 28, categoria: 'assinaturas', metodo: 'Crédito', inicio: '2020-01', pagamentos: {} },
  ];
  state.tarefas = [
    { id: id(), titulo: 'Pagar fatura do cartão', prioridade: 'alta', prazo: d(0), tags: ['financas'], sub: [], feito: false },
    { id: id(), titulo: 'Academia às 19h', prioridade: 'media', prazo: d(0), tags: ['saude'], sub: [], feito: false },
    { id: id(), titulo: 'Revisar relatório', prioridade: 'media', prazo: d(-1), tags: ['trabalho'], sub: [{ id: id(), titulo: 'Gráficos', feito: true }, { id: id(), titulo: 'Conclusão', feito: false }], feito: false },
    { id: id(), titulo: 'Comprar presente da mãe', prioridade: 'baixa', prazo: d(3), tags: ['casa'], sub: [], feito: false },
  ];
  const dias = (p) => Object.fromEntries(Array.from({ length: 120 }, (_, i) => [d(-i), Math.random() < p]).filter(([, v]) => v));
  state.habitos = [
    { id: id(), nome: 'Beber água', emoji: '💧', cor: '#6ea7c6', dias: { ...dias(0.8), [d(0)]: true } },
    { id: id(), nome: 'Academia', emoji: '🏋️', cor: '#c98a6b', dias: dias(0.5) },
    { id: id(), nome: 'Ler 10 páginas', emoji: '📖', cor: '#a68cc4', dias: dias(0.6) },
  ];
  state.eventos = [{ id: id(), titulo: 'Dentista', data: d(0), hora: '15:30', local: 'Centro', notas: '' }];
  state.listas = [{ id: id(), nome: 'Mercado', emoji: '🛒', itens: [
    { id: id(), nome: 'Leite', qtd: 2, preco: 5.49, feito: true },
    { id: id(), nome: 'Café', qtd: 1, preco: 18.9, feito: false },
    { id: id(), nome: 'Banana', qtd: 1, preco: 7.5, feito: false },
  ] }];
  state.notas = [
    { id: id(), titulo: 'Wi-fi de casa', texto: 'Rede: Casa_5G\nSenha na geladeira 😄', fixada: true, cor: 'accent', atualizada: new Date().toISOString() },
    { id: id(), titulo: 'Ideias de presente', texto: 'Livro, planta, caneca personalizada', fixada: false, cor: 'accent-2', atualizada: new Date().toISOString() },
    { id: id(), titulo: '', texto: 'Ligar para o banco sobre o seguro', fixada: false, cor: 'warning', atualizada: new Date().toISOString() },
  ];
  state.diario = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [d(-i), { humor: (i % 5) + 1, texto: 'Dia normal' }]));
  state.focoSessoes = [{ data: d(0), minutos: 25 }, { data: d(0), minutos: 25 }, { data: d(-1), minutos: 50 }, { data: d(-3), minutos: 75 }];
  commit(...Object.keys(state));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const routes = ['inicio', 'financas', 'metas', 'contas', 'tarefas', 'habitos', 'agenda', 'compras', 'notas', 'foco', 'ajustes'];
const suffix = desktop ? '-desktop' : '';
for (const r of routes) {
  await page.evaluate((r) => (location.hash = `#/${r}`), r);
  await wait(1700);
  await page.screenshot({ path: `screens/${r}${suffix}.png`, fullPage: !desktop });
}

// Interações principais
await page.evaluate(() => (location.hash = '#/tarefas'));
await wait(800);
await page.type('[data-quick] input', 'Testar app #teste !');
await page.click('[data-quick] button[type=submit]');
await wait(500);
const added = await page.evaluate(() => [...document.querySelectorAll('.item__title')].some((e) => e.textContent.includes('Testar app')));
if (!added) errors.push('Tarefa rápida não apareceu');
await page.click('[data-task] [data-done]');
await wait(250);
await page.screenshot({ path: `screens/tarefa-concluindo${suffix}.png` });
await wait(900);

await page.click('[data-fab]:not(.fab--desktop)').catch(() => page.click('.fab--desktop'));
await wait(600);
await page.screenshot({ path: `screens/fab${suffix}.png` });
await page.click('[data-acao=gasto]');
await wait(600);
await page.type('#sheet input[name=valor]', '37,50');
await page.type('#sheet input[name=descricao]', 'Padaria');
await page.screenshot({ path: `screens/form-gasto${suffix}.png` });
await page.click('#sheet button[type=submit]');
await wait(800);
const saved = await page.evaluate(async () => (await import('/js/store.js')).state.transacoes.some((t) => t.descricao === 'Padaria' && t.valor === 37.5));
if (!saved) errors.push('Gasto não foi salvo');

for (const tema of ['lavanda', 'oceano', 'floresta', 'terracota', 'papel', 'grafite', 'sakura', 'meia-noite', 'cafe']) {
  await page.evaluate(async (t) => {
    const { state, commit } = await import('/js/store.js');
    const { applyTheme } = await import('/js/themes.js');
    state.settings.tema = t;
    commit('settings');
    applyTheme(t, false);
    location.hash = '#/inicio';
  }, tema);
  await wait(1500);
  await page.screenshot({ path: `screens/tema-${tema}${suffix}.png` });
}

const renderer = await page.evaluate(() => document.documentElement.dataset.renderer);
console.log('renderer:', renderer);

// Sair e entrar de novo: senha errada deve falhar, a certa deve abrir o app com os mesmos dados
const sincronizar = (p) =>
  p.evaluate(async () => {
    await (await import('/js/store.js')).flushNow();
    const { waitForPendingWrites } = await import('/vendor/firebase/firebase-firestore.js');
    await waitForPendingWrites((await import('/js/cloud.js')).db);
  });
await sincronizar(page);
await page.evaluate(async () => (await import('/js/auth.js')).sair());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('#auth form');
await page.type('#auth [name=usuario]', USER);
await page.type('#auth [name=senha]', 'errada');
await page.click('#auth [data-submit]');
await page.waitForFunction(() => document.querySelector('.auth__error')?.textContent.length > 0, { timeout: 15000 });
const erroLogin = await page.$eval('.auth__error', (e) => e.textContent);
if (!erroLogin.includes('incorretos')) errors.push(`Login com senha errada: "${erroLogin}"`);
await page.screenshot({ path: `screens/auth-login${suffix}.png` });
await page.type('#auth [name=senha]', SENHA);
await page.click('#auth [data-submit]');
await page.waitForSelector('.page', { timeout: 20000 });
await wait(1200);
const greet = await page.$eval('[data-greet]', (e) => e.textContent);
if (!greet.includes('Olá, Matheus')) errors.push(`Saudação inesperada: ${greet}`);
const temDados = await page.evaluate(async () => (await import('/js/store.js')).state.transacoes.length > 0);
if (!temDados) errors.push('Dados do usuário não foram recarregados após login');
await page.screenshot({ path: `screens/inicio-apos-login${suffix}.png` });

// "Outro aparelho" (perfil limpo): mesmo usuário e senha devem trazer os dados da nuvem
const ctx2 = await browser.createBrowserContext();
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push(`pageerror(2): ${e.message}`));
await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p2.goto(BASE, { waitUntil: 'networkidle0' });
await p2.waitForSelector('#auth form');
await p2.click('#auth [data-toggle]');
await wait(500);
await p2.type('#auth [name=usuario]', USER);
await p2.type('#auth [name=senha]', SENHA);
await p2.screenshot({ path: `screens/auth-outro-aparelho${suffix}.png` });
await p2.click('#auth [data-submit]');
await p2.waitForSelector('.page', { timeout: 20000 });
const nuvem = await p2.evaluate(async () => {
  const { state } = await import('/js/store.js');
  return { tx: state.transacoes.length, tema: state.settings.tema, padaria: state.transacoes.some((t) => t.descricao === 'Padaria') };
});
if (!nuvem.tx || !nuvem.padaria) errors.push(`Outro aparelho não recebeu os dados: ${JSON.stringify(nuvem)}`);

// Sincronização ao vivo: gasto criado no aparelho 2 aparece no aparelho 1
await p2.evaluate(async () => {
  const { addTransaction } = await import('/js/modules/financas.js');
  addTransaction({ tipo: 'despesa', valor: 12.34, descricao: 'Sync ao vivo', categoria: 'outros' });
});
await sincronizar(p2);
await page.waitForFunction(async () => (await import('/js/store.js')).state.transacoes.some((t) => t.descricao === 'Sync ao vivo'), { timeout: 20000, polling: 500 }).catch(() => errors.push('Sincronização ao vivo não chegou no aparelho 1'));
await ctx2.close();

// Limpeza: apaga os dados e o usuário temporário
await page.evaluate(async () => {
  const { auth, apagarChave } = await import('/js/cloud.js');
  const { KEYS, descarregar } = await import('/js/store.js');
  descarregar();
  for (const k of KEYS) await apagarChave(auth.currentUser.uid, k);
  await auth.currentUser.delete();
}).catch((e) => errors.push(`Limpeza falhou: ${e.message}`));
await browser.close();
server.kill();
if (errors.length) {
  console.error('ERROS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('OK: todas as telas renderizaram sem erros.');
