// Contas locais: usuário + senha (PBKDF2) guardados no próprio aparelho, um espaço de dados por usuário.
import { importarParaUsuario, rawGet, rawPut } from './store.js';
import { reducedMotion, uid } from './utils.js';
import { textMorph } from './textmorph.js';

const AUTH_KEY = 'auth:usuarios';
const SESSION_KEY = 'cp:sessao';

let usuarios = [];
let atual = null;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashSegredo(segredo, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => Number.parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export const novoSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
export const usuarioAtual = () => atual;

export async function carregarUsuarios() {
  const salvo = await rawGet(AUTH_KEY);
  usuarios = Array.isArray(salvo) ? salvo : [];
  return usuarios;
}

const salvarUsuarios = () => rawPut(AUTH_KEY, usuarios);

export function sessaoSalva() {
  const id = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  atual = usuarios.find((u) => u.id === id) || null;
  return atual;
}

function salvarSessao(id, manter) {
  sessionStorage.setItem(SESSION_KEY, id);
  if (manter) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

export function sair() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  atual = null;
}

const normalizar = (u) => String(u || '').trim().toLowerCase();

async function criarConta({ nome, usuario, senha }) {
  const user = { id: uid(), nome, usuario: normalizar(usuario), salt: novoSalt(), criadoEm: new Date().toISOString() };
  user.hash = await hashSegredo(senha, user.salt);
  usuarios.push(user);
  await salvarUsuarios();
  return user;
}

async function entrar(usuario, senha) {
  const user = usuarios.find((u) => u.usuario === normalizar(usuario));
  if (!user) return { erro: 'naoExiste' };
  return (await hashSegredo(senha, user.salt)) === user.hash ? { user } : { erro: 'senha' };
}

// Dados da conta que vão junto no backup, para poder entrar em outro aparelho com a mesma senha.
export function contaParaBackup() {
  if (!atual) return null;
  const { usuario, nome, salt, hash } = atual;
  return { usuario, nome, salt, hash };
}

async function importarConta(json) {
  const c = json?.conta;
  if (!c || !/^[a-z0-9._-]{3,20}$/.test(c.usuario) || !/^[0-9a-f]{32}$/.test(c.salt) || !/^[0-9a-f]{64}$/.test(c.hash)) {
    throw new Error('Este backup não tem dados de conta. Crie a conta aqui e restaure o backup em Ajustes.');
  }
  if (usuarios.some((u) => u.usuario === c.usuario)) throw new Error(`O usuário @${c.usuario} já existe neste aparelho. É só entrar.`);
  const user = { id: uid(), nome: String(c.nome || c.usuario).slice(0, 40), usuario: c.usuario, salt: c.salt, hash: c.hash, criadoEm: new Date().toISOString() };
  await importarParaUsuario(user.id, json);
  usuarios.push(user);
  await salvarUsuarios();
  return user;
}

export async function trocarSenha(senhaAtual, nova) {
  if (!atual || (await hashSegredo(senhaAtual, atual.salt)) !== atual.hash) return false;
  atual.salt = novoSalt();
  atual.hash = await hashSegredo(nova, atual.salt);
  await salvarUsuarios();
  return true;
}

export async function atualizarNome(nome) {
  if (!atual) return;
  atual.nome = nome;
  await salvarUsuarios();
}

function validar(modo, v) {
  if (modo === 'cadastro' && v.nome.length < 2) return ['nome', 'Diga como quer ser chamado.'];
  if (!/^[a-z0-9._-]{3,20}$/.test(normalizar(v.usuario))) return ['usuario', 'Usuário: 3 a 20 letras, números, ponto, hífen ou _ (sem espaços).'];
  if (modo === 'cadastro' && usuarios.some((u) => u.usuario === normalizar(v.usuario))) return ['usuario', 'Esse usuário já existe neste aparelho.'];
  if (v.senha.length < (modo === 'cadastro' ? 6 : 1)) return ['senha', modo === 'cadastro' ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Digite sua senha.'];
  if (modo === 'cadastro' && v.senha !== v.senha2) return ['senha2', 'As senhas não conferem.'];
  return null;
}

// Mostra a tela de entrar/criar conta e resolve com o usuário autenticado.
export function telaLogin() {
  const el = document.getElementById('auth');
  let modo = usuarios.length ? 'login' : 'cadastro';
  el.innerHTML = `
    <div class="auth__card">
      <img src="icons/icon.svg" alt="" class="auth__logo" width="64" height="64">
      <h1 class="auth__title" data-title></h1>
      <p class="auth__sub" data-sub></p>
      <form class="form" novalidate>
        <label class="field" data-cadastro><span>Como quer ser chamado?</span><input name="nome" autocomplete="given-name" maxlength="40" placeholder="Seu nome"></label>
        <label class="field"><span>Usuário</span><input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="ex.: matheus"></label>
        <label class="field"><span>Senha</span><input name="senha" type="password" maxlength="128"></label>
        <label class="field" data-cadastro><span>Confirmar senha</span><input name="senha2" type="password" autocomplete="new-password" maxlength="128"></label>
        <label class="auth__check"><input type="checkbox" name="manter" checked> Manter conectado neste aparelho</label>
        <p class="auth__error" role="alert" aria-live="assertive"></p>
        <button class="btn btn--primary btn--block" type="submit" data-submit></button>
      </form>
      <button class="btn btn--ghost btn--block" type="button" data-toggle></button>
      <label class="btn btn--ghost btn--block btn--sm" style="cursor:pointer">📦 Trazer conta de outro aparelho (backup)<input type="file" accept="application/json,.json" data-backup hidden></label>
      <p class="auth__note">🔒 As contas ficam salvas só no aparelho onde foram criadas. Para usar em outro celular ou navegador, baixe o backup em Ajustes e traga ele por aqui. A senha não pode ser recuperada.</p>
    </div>`;
  el.hidden = false;

  const form = el.querySelector('form');
  const erro = el.querySelector('.auth__error');
  const aplicarModo = (animar) => {
    const cadastro = modo === 'cadastro';
    el.querySelectorAll('[data-cadastro]').forEach((f) => (f.hidden = !cadastro));
    form.senha.autocomplete = cadastro ? 'new-password' : 'current-password';
    textMorph(el.querySelector('[data-title]'), cadastro ? 'Criar sua conta' : 'Bem-vindo de volta');
    el.querySelector('[data-sub]').textContent = cadastro
      ? 'Leva 10 segundos. Depois é só entrar.'
      : usuarios.length
        ? 'Entre com seu usuário e senha.'
        : 'Nenhuma conta salva neste aparelho ainda. Crie uma ou traga o backup de outro aparelho.';
    el.querySelector('[data-submit]').textContent = cadastro ? 'Criar conta e entrar' : 'Entrar';
    el.querySelector('[data-toggle]').textContent = cadastro ? 'Já tenho conta. Entrar' : 'Não tem conta? Criar conta';
    erro.textContent = '';
    if (animar && window.gsap && !reducedMotion()) window.gsap.from(form.querySelectorAll('.field:not([hidden])'), { y: 10, opacity: 0, stagger: 0.05, duration: 0.4, ease: 'power3.out' });
    (cadastro ? form.nome : form.usuario).focus();
  };
  aplicarModo(false);
  if (window.gsap && !reducedMotion()) window.gsap.from(el.querySelector('.auth__card'), { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' });

  el.querySelector('[data-toggle]').addEventListener('click', () => {
    modo = modo === 'login' ? 'cadastro' : 'login';
    aplicarModo(true);
  });

  el.querySelector('[data-backup]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Arquivo grande demais.');
      const user = await importarConta(JSON.parse(await file.text()));
      modo = 'login';
      aplicarModo(true);
      form.usuario.value = user.usuario;
      form.senha.focus();
      el.querySelector('[data-sub]').textContent = `Conta @${user.usuario} trazida com sucesso! Agora entre com a sua senha.`;
    } catch (err) {
      erro.textContent = err instanceof SyntaxError ? 'Arquivo de backup inválido.' : err.message;
    }
  });

  return new Promise((resolve) => {
    let ocupado = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ocupado) return;
      const v = { nome: form.nome.value.trim(), usuario: form.usuario.value, senha: form.senha.value, senha2: form.senha2.value };
      const falha = validar(modo, v);
      if (falha) {
        erro.textContent = falha[1];
        form[falha[0]].focus();
        return;
      }
      ocupado = true;
      const btn = el.querySelector('[data-submit]');
      btn.disabled = true;
      const primeiro = !usuarios.length;
      const res = modo === 'cadastro' ? { user: await criarConta(v) } : await entrar(v.usuario, v.senha);
      const user = res.user;
      btn.disabled = false;
      ocupado = false;
      if (!user) {
        erro.textContent =
          res.erro === 'naoExiste'
            ? 'Usuário não encontrado neste aparelho. A conta fica salva onde foi criada: crie uma aqui ou traga o backup.'
            : 'Senha incorreta.';
        form.senha.value = '';
        (res.erro === 'naoExiste' ? form.usuario : form.senha).focus();
        if (window.gsap) window.gsap.fromTo(el.querySelector('.auth__card'), { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        return;
      }
      atual = user;
      salvarSessao(user.id, form.manter.checked);
      const fim = () => {
        el.hidden = true;
        el.innerHTML = '';
        el.style.opacity = '';
      };
      if (window.gsap && !reducedMotion()) window.gsap.to(el, { opacity: 0, duration: 0.35, onComplete: fim });
      else fim();
      resolve({ user, primeiro, novo: modo === 'cadastro' });
    });
  });
}

// Tela de boas-vindas: "Olá, Nome" com text morph.
export function boasVindas(nome) {
  const el = document.getElementById('welcome');
  if (reducedMotion() || !window.gsap) return Promise.resolve();
  el.hidden = false;
  el.innerHTML = '<h1 class="welcome__text"></h1><p class="welcome__sub"></p>';
  const h = el.querySelector('h1');
  textMorph(h, '👋');
  return new Promise((resolve) => {
    const tl = window.gsap.timeline({
      onComplete: () => {
        el.hidden = true;
        el.innerHTML = '';
        el.style.opacity = '';
        resolve();
      },
    });
    tl.from(h, { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(2)' })
      .add(() => textMorph(h, `Olá, ${nome}!`, { duration: 0.9 }), '+=0.15')
      .to(el.querySelector('.welcome__sub'), { opacity: 1, y: 0, duration: 0.5, onStart: () => (el.querySelector('.welcome__sub').textContent = 'Vamos organizar o seu dia') }, '+=0.7')
      .to(el, { opacity: 0, duration: 0.5, ease: 'power2.in' }, '+=0.9');
  });
}
