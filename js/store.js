// Dados do usuário: Firestore (sincroniza entre aparelhos e funciona offline).
// O IndexedDB local só é lido para migrar dados da versão antiga, que era só local.
import { colecaoDados, onSnapshot, salvarChave } from './cloud.js';

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

const normalizar = (key, value) => {
  const base = defaults();
  if (value === undefined || value === null) return base[key];
  if (key === 'settings') return { ...base.settings, ...value, foco: { ...base.settings.foco, ...value.foco } };
  return value;
};

let unsubscribe = null;

// Carrega os dados do usuário da nuvem (com cache offline) e fica ouvindo mudanças de outros aparelhos.
export function load(uid) {
  userId = uid;
  unsubscribe?.();
  return new Promise((resolve) => {
    let primeiro = true;
    unsubscribe = onSnapshot(
      colecaoDados(uid),
      (snap) => {
        const mudou = [];
        snap.docChanges().forEach((ch) => {
          const key = ch.doc.id;
          if (!KEYS.includes(key) || ch.doc.metadata.hasPendingWrites || pending.has(key)) return;
          try {
            state[key] = normalizar(key, ch.type === 'removed' ? null : JSON.parse(ch.doc.data().v));
            mudou.push(key);
          } catch (err) {
            console.error('Dado inválido na nuvem', key, err);
          }
        });
        if (primeiro) {
          primeiro = false;
          const recebidas = new Set(snap.docs.map((d) => d.id));
          for (const key of KEYS) if (!recebidas.has(key)) state[key] = normalizar(key, null);
          resolve({ vazio: snap.empty, doCache: snap.metadata.fromCache });
        } else if (mudou.length) {
          listeners.forEach((fn) => fn(mudou, 'nuvem'));
        }
      },
      (err) => {
        console.error('Erro de sincronização', err);
        if (primeiro) {
          primeiro = false;
          for (const key of KEYS) state[key] = normalizar(key, null);
          resolve({ vazio: true, doCache: true, erro: err });
        }
      },
    );
  });
}

export function descarregar() {
  unsubscribe?.();
  unsubscribe = null;
  userId = null;
}

// Dados salvos só neste aparelho pela versão antiga (antes do login na nuvem).
export async function dadosLocaisAntigos(usuario) {
  const contas = (await rawGet('auth:usuarios')) || [];
  const conta = Array.isArray(contas) ? contas.find((u) => u.usuario === usuario) : null;
  const prefixo = conta ? `u:${conta.id}:` : '';
  if (!conta && contas.length) return null;
  const dados = {};
  let achou = false;
  for (const key of KEYS) {
    const v = await rawGet(prefixo + key);
    if (v !== undefined && v !== null) {
      dados[key] = v;
      achou = true;
    }
  }
  return achou ? dados : null;
}

const pending = new Set();
let flushTimer = null;

async function flush() {
  flushTimer = null;
  if (!userId) return;
  const uid = userId;
  const keys = [...pending];
  pending.clear();
  await Promise.all(
    keys.map((key) =>
      salvarChave(uid, key, state[key]).catch((err) => {
        console.error('Falha ao salvar', key, err);
      }),
    ),
  );
}

export async function flushNow() {
  clearTimeout(flushTimer);
  await flush();
}

// Marca chaves alteradas, grava em lote (cache local na hora, nuvem quando houver internet) e avisa a interface.
export function commit(...keys) {
  keys.forEach((k) => pending.add(k));
  if (!flushTimer) flushTimer = setTimeout(flush, 250);
  listeners.forEach((fn) => fn(keys, 'local'));
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

export function resetAll() {
  const base = defaults();
  for (const key of KEYS) state[key] = base[key];
  commit(...KEYS);
}

// Busca auxiliares
export const categoria = (id) => state.categorias.find((c) => c.id === id) || { id, nome: 'Outros', emoji: '📦', cor: '#9a9a9a' };
