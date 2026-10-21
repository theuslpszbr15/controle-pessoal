// Contas na nuvem (Firebase Authentication): o mesmo usuário e senha funcionam em qualquer aparelho.
import { reducedMotion } from './utils.js';
import { textMorph } from './textmorph.js';
import {
  atualizarNomeNuvem,
  auth,
  cadastrarNaNuvem,
  entrarNaNuvem,
  sairDaNuvem,
  sessaoAtual,
  trocarSenhaNuvem,
  usuarioDe,
} from './cloud.js';

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Usado pelo PIN de bloqueio rápido.
export async function hashSegredo(segredo, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => Number.parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export const novoSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export function usuarioAtual() {
  const u = auth.currentUser;
  return u ? { id: u.uid, usuario: usuarioDe(u.email), nome: u.displayName || usuarioDe(u.email) } : null;
}

export const aguardarSessao = sessaoAtual;
export const sair = () => sairDaNuvem();

export async function trocarSenha(senhaAtual, nova) {
  try {
    await trocarSenhaNuvem(senhaAtual, nova);
    return true;
  } catch (err) {
    if (['auth/invalid-credential', 'auth/wrong-password'].includes(err.code)) return false;
    throw err;
  }
}

export const atualizarNome = (nome) => atualizarNomeNuvem(nome);

const normalizar = (u) => String(u || '').trim().toLowerCase();

const MENSAGENS = {
  'auth/invalid-credential': 'Usuário ou senha incorretos.',
  'auth/wrong-password': 'Usuário ou senha incorretos.',
  'auth/user-not-found': 'Usuário ou senha incorretos.',
  'auth/email-already-in-use': 'Esse usuário já existe. Escolha outro ou entre com ele.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem internet. Conecte-se para entrar neste aparelho.',
};

function validar(modo, v) {
  if (modo === 'cadastro' && v.nome.length < 2) return ['nome', 'Diga como quer ser chamado.'];
  if (!/^[a-z0-9._-]{3,20}$/.test(normalizar(v.usuario))) return ['usuario', 'Usuário: 3 a 20 letras, números, ponto, hífen ou _ (sem espaços).'];
  if (v.senha.length < (modo === 'cadastro' ? 6 : 1)) return ['senha', modo === 'cadastro' ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Digite sua senha.'];
  if (modo === 'cadastro' && v.senha !== v.senha2) return ['senha2', 'As senhas não conferem.'];
  return null;
}

// Mostra a tela de entrar/criar conta e resolve com o usuário autenticado.
export function telaLogin() {
  const el = document.getElementById('auth');
  let modo = localStorage.getItem('cp:jaEntrou') ? 'login' : 'cadastro';
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
      <p class="auth__note">☁️ Sua conta fica na nuvem: entre com o mesmo usuário e senha no celular, no computador ou em qualquer navegador. A senha não pode ser recuperada, então guarde bem.</p>
    </div>`;
  el.hidden = false;

  const form = el.querySelector('form');
  const erro = el.querySelector('.auth__error');
  const btn = el.querySelector('[data-submit]');
  const rotulo = () => (modo === 'cadastro' ? 'Criar conta e entrar' : 'Entrar');
  const aplicarModo = (animar) => {
    const cadastro = modo === 'cadastro';
    el.querySelectorAll('[data-cadastro]').forEach((f) => (f.hidden = !cadastro));
    form.senha.autocomplete = cadastro ? 'new-password' : 'current-password';
    textMorph(el.querySelector('[data-title]'), cadastro ? 'Criar sua conta' : 'Bem-vindo de volta');
    el.querySelector('[data-sub]').textContent = cadastro ? 'Leva 10 segundos. Depois é só entrar em qualquer aparelho.' : 'Entre com seu usuário e senha.';
    btn.textContent = rotulo();
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
      btn.disabled = true;
      btn.textContent = modo === 'cadastro' ? 'Criando conta…' : 'Entrando…';
      erro.textContent = '';
      const usuario = normalizar(v.usuario);
      try {
        const user =
          modo === 'cadastro'
            ? await cadastrarNaNuvem(usuario, v.senha, v.nome, form.manter.checked)
            : await entrarNaNuvem(usuario, v.senha, form.manter.checked);
        localStorage.setItem('cp:jaEntrou', '1');
        const fim = () => {
          el.hidden = true;
          el.innerHTML = '';
          el.style.opacity = '';
        };
        if (window.gsap && !reducedMotion()) window.gsap.to(el, { opacity: 0, duration: 0.35, onComplete: fim });
        else fim();
        resolve({ user, novo: modo === 'cadastro', nome: modo === 'cadastro' ? v.nome : user.displayName });
      } catch (err) {
        console.warn(err.code || err);
        erro.textContent = MENSAGENS[err.code] || 'Não foi possível entrar agora. Tente de novo.';
        form.senha.value = '';
        form.senha.focus();
        if (window.gsap) window.gsap.fromTo(el.querySelector('.auth__card'), { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        btn.disabled = false;
        btn.textContent = rotulo();
        ocupado = false;
      }
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
