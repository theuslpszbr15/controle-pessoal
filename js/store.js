// Persistência local (IndexedDB, com fallback para localStorage). Nada sai do aparelho.
const DB_NAME = 'controle-pessoal';
const STORE = 'kv';
const LS_PREFIX = 'cp:';

export const CATEGORIAS_PADRAO = [
  { id: 'alimentacao', nome: 'Alimentação', emoji: '🍽️', cor: '#c98a6b', tipo: 'despesa' },
  { id: 'mercado', nome: 'Mercado', emoji: '🛒', cor: '#8fa97f', tipo: 'despesa' },
  { id: 'transporte', nome: 'Transporte', emoji: '🚗', cor: '#7f9cb8', tipo: 'despesa' },
  { id: 'moradia', nome: 'Moradia', emoji: '🏠', cor: '#b49a74', tipo: 'despesa' },
  { id: 'contas', nome: 'Contas e serviços', emoji: '💡', cor: '#c7b06a', tipo: 'despesa' },
  { id: 'saude', nome: 'Saúde', emoji: '💊', cor: '#d08f97', tipo: 'despesa' },
  { id: 'lazer', nome: 'Lazer', emoji: '🎬', cor: '#a68cc4', tipo: 'despesa' },
  { id: 'educacao', nome: 'Educação', emoji: '📚', cor: '#6fa7a0', tipo: 'despesa' },
  { id: 'compras', nome: 'Compras', emoji: '🛍️', cor: '#c49a8f', tipo: 'despesa' },
  { id: 'assinaturas', nome: 'Assinaturas', emoji: '📺', cor: '#8a8fc4', tipo: 'despesa' },
  { id: 'pets', nome: 'Pets', emoji: '🐾', cor: '#b5a27f', tipo: 'despesa' },
  { id: 'outros', nome: 'Outros', emoji: '📦', cor: '#9a9a9a', tipo: 'despesa' },
  { id: 'salario', nome: 'Salário', emoji: '💼', cor: '#7fae8c', tipo: 'receita' },
  { id: 'freela', nome: 'Freelance', emoji: '💻', cor: '#8aa6c4', tipo: 'receita' },
  { id: 'investimentos', nome: 'Investimentos', emoji: '📈', cor: '#b8a46f', tipo: 'receita' },
  { id: 'outras-receitas', nome: 'Outras receitas', emoji: '➕', cor: '#9fb59a', tipo: 'receita' },
];

export const METODOS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Transferência'];

const defaults = () => ({
  settings: {
    nome: '',
    tema: 'ametista',
    fundoAnimado: true,
    fisica: true,
    tresD: true,
    pinHash: null,
    pinSalt: null,
    foco: { foco: 25, pausa: 5, longa: 15, som: 'nenhum' },
    listaAtiva: null,
  },
  transacoes: [],
  categorias: CATEGORIAS_PADRAO,
  orcamentos: {},
  metas: [],
  contas: [],
  tarefas: [],
  habitos: [],
  eventos: [],
  listas: [],
  notas: [],
  diario: {},
  focoSessoes: [],
});

export const KEYS = Object.keys(defaults());
export const state = defaults();

let db = null;
let dbReady = null;
let userId = null;
const listeners = new Set();

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function initDB() {
  dbReady ||= openDB()
    .then((d) => (db = d))
    .catch(() => (db = null));
  return dbReady;
}

export async function rawGet(key) {
  await initDB();
  try {
    return db ? await idbGet(key) : JSON.parse(localStorage.getItem(LS_PREFIX + key) || 'null');
  } catch {
    return undefined;
  }
}

export async function rawPut(key, value) {
  await initDB();
  if (db) await idbPut(key, value);
  else localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
}

// Cada usuário tem suas próprias chaves: "u:<id>:<chave>".
const userKey = (key) => `u:${userId}:${key}`;

export async function load(id, { migrarLegado = false } = {}) {
  userId = id;
  const base = defaults();
  for (const key of KEYS) {
    let value = await rawGet(userKey(key));
    if ((value === undefined || value === null) && migrarLegado) {
      value = await rawGet(key);
      if (value !== undefined && value !== null) await rawPut(userKey(key), value);
    }
    if (value === undefined || value === null) state[key] = base[key];
    else if (key === 'settings') state[key] = { ...base.settings, ...value, foco: { ...base.settings.foco, ...value.foco } };
    else state[key] = value;
  }
  return state;
}

const pending = new Set();
let flushTimer = null;

async function flush() {
  flushTimer = null;
  if (!userId) return;
  const keys = [...pending];
  pending.clear();
  for (const key of keys) {
    try {
      await rawPut(userKey(key), structuredClone(state[key]));
    } catch (err) {
      console.error('Falha ao salvar', key, err);
    }
  }
}

export async function flushNow() {
  clearTimeout(flushTimer);
  await flush();
}

// Marca chaves alteradas, grava em lote e avisa a interface.
export function commit(...keys) {
  keys.forEach((k) => pending.add(k));
  if (!flushTimer) flushTimer = setTimeout(flush, 120);
  listeners.forEach((fn) => fn(keys));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

window.addEventListener('pagehide', () => {
  if (pending.size) flush();
});

export function exportData() {
  const data = {};
  for (const key of KEYS) data[key] = state[key];
  return { app: 'controle-pessoal', versao: 1, exportadoEm: new Date().toISOString(), dados: data };
}

function validarBackup(json) {
  if (!json || json.app !== 'controle-pessoal' || typeof json.dados !== 'object') {
    throw new Error('Arquivo de backup inválido.');
  }
  const base = defaults();
  const out = {};
  for (const key of KEYS) {
    const incoming = json.dados[key];
    if (incoming === undefined) continue;
    const expectArray = Array.isArray(base[key]);
    if (expectArray !== Array.isArray(incoming) || typeof incoming !== 'object' || incoming === null) {
      throw new Error(`Campo "${key}" com formato inválido.`);
    }
    out[key] = key === 'settings' ? { ...base.settings, ...incoming } : incoming;
  }
  return out;
}

export function importData(json) {
  const dados = validarBackup(json);
  Object.assign(state, dados);
  commit(...KEYS);
}

// Grava um backup direto no espaço de outro usuário (usado ao trazer a conta de outro aparelho).
export async function importarParaUsuario(id, json) {
  const dados = validarBackup(json);
  for (const [key, value] of Object.entries(dados)) await rawPut(`u:${id}:${key}`, value);
}

export function resetAll() {
  const base = defaults();
  for (const key of KEYS) state[key] = base[key];
  commit(...KEYS);
}

// Busca auxiliares
export const categoria = (id) => state.categorias.find((c) => c.id === id) || { id, nome: 'Outros', emoji: '📦', cor: '#9a9a9a' };
