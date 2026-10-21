import { state, commit, exportData, importData, resetAll, categoria } from '../store.js';
import { download, esc, todayISO } from '../utils.js';
import { icon } from '../icons.js';
import { confirmSheet, fields, invalid, openSheet, toast } from '../ui.js';
import { TEMAS, applyTheme } from '../themes.js';
import { shared } from '../shared.js';

// ---------- PIN ----------
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => Number.parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export async function verifyPin(pin) {
  const { pinHash, pinSalt } = state.settings;
  if (!pinHash) return true;
  return (await hashPin(pin, pinSalt)) === pinHash;
}

function openPin() {
  openSheet({
    title: state.settings.pinHash ? 'Trocar PIN' : 'Criar PIN',
    body: `<p class="muted small" style="margin-bottom:12px">O PIN protege o app quando alguém pega seu celular. Ele fica só neste aparelho; se esquecer, será preciso apagar os dados do app no navegador.</p>
      ${fields([
        [
          { name: 'pin', label: 'PIN (4 a 8 números)', type: 'password', attrs: 'inputmode="numeric" autocomplete="new-password" maxlength="8"' },
          { name: 'pin2', label: 'Repita o PIN', type: 'password', attrs: 'inputmode="numeric" autocomplete="new-password" maxlength="8"' },
        ],
      ])}`,
    onSubmit: async (v, form) => {
      if (!/^\d{4,8}$/.test(v.pin)) return invalid(form, 'pin', 'Use de 4 a 8 números.');
      if (v.pin !== v.pin2) return invalid(form, 'pin2', 'Os PINs não conferem.');
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      state.settings.pinSalt = salt;
      state.settings.pinHash = await hashPin(v.pin, salt);
      commit('settings');
      toast('PIN ativado', { icon: '🔒' });
    },
  });
}

// ---------- CSV ----------
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCSV() {
  const linhas = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Pagamento', 'Valor']];
  for (const t of [...state.transacoes].sort((a, b) => a.data.localeCompare(b.data))) {
    linhas.push([t.data, t.tipo, t.descricao, categoria(t.categoria).nome, t.metodo, (t.tipo === 'despesa' ? -t.valor : t.valor).toFixed(2).replace('.', ',')]);
  }
  download(`lancamentos-${todayISO()}.csv`, `\uFEFF${linhas.map((l) => l.map(csvCell).join(';')).join('\r\n')}`, 'text/csv;charset=utf-8');
}

// ---------- Instalação (PWA) ----------
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});

const RENDER_LABEL = { webgpu: 'WebGPU', webgl2: 'WebGL2', css: 'CSS (sem GPU)' };
const switchBtn = (key, on, label) => `<button class="switch ${on ? 'is-on' : ''}" data-switch="${key}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;

export default {
  id: 'ajustes',
  title: 'Ajustes',
  icon: 'sliders',
  render(view, ctx) {
    const s = state.settings;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const renderer = document.documentElement.dataset.renderer || 'css';

    view.innerHTML = `
      <section class="card">
        <div class="card__title">Perfil</div>
        <label class="field"><span>Como quer ser chamado?</span><input class="input" data-nome value="${esc(s.nome)}" placeholder="Seu nome" maxlength="40" autocomplete="given-name"></label>
      </section>

      <section class="section">
        <div class="section__head"><h2>${icon('palette')} Tema</h2><span class="muted small">${TEMAS.length} temas</span></div>
        <div class="themes">${TEMAS.map((t) => `<button class="theme-card ${t.id === s.tema ? 'is-active' : ''}" data-theme="${t.id}" data-tema="${t.id}" aria-pressed="${t.id === s.tema}">
          <div class="theme-card__preview"><i style="background:var(--accent)"></i><i style="background:var(--accent-2)"></i><i style="background:var(--surface-solid)"></i></div>
          <strong>${t.emoji} ${esc(t.nome)}</strong><small>${esc(t.desc)}</small></button>`).join('')}</div>
      </section>

      <section class="card section">
        <div class="card__title">Efeitos visuais</div>
        <div class="setting"><div class="setting__text"><strong>Fundo animado</strong><small>Shader em ${esc(RENDER_LABEL[renderer])}</small></div>${switchBtn('fundoAnimado', s.fundoAnimado, 'Fundo animado')}</div>
        <div class="setting"><div class="setting__text"><strong>Física</strong><small>Bolhas de gastos e tarefas que caem (Matter.js)</small></div>${switchBtn('fisica', s.fisica, 'Física')}</div>
        <div class="setting"><div class="setting__text"><strong>Pote 3D</strong><small>Metas com moedas em 3D (Three.js)</small></div>${switchBtn('tresD', s.tresD, 'Pote 3D')}</div>
      </section>

      <section class="card section">
        <div class="card__title">${icon('lock')} Segurança</div>
        <div class="setting"><div class="setting__text"><strong>Bloqueio por PIN</strong><small>${s.pinHash ? 'Ativado' : 'Desativado'}</small></div>
          <div class="row">${s.pinHash ? '<button class="btn btn--ghost btn--sm" data-pinoff>Remover</button>' : ''}<button class="btn btn--soft btn--sm" data-pin>${s.pinHash ? 'Trocar' : 'Ativar'}</button></div></div>
      </section>

      <section class="card section">
        <div class="card__title">Seus dados</div>
        <p class="muted small" style="margin-bottom:12px">Tudo fica salvo só neste aparelho. Faça backup de vez em quando para não perder nada.</p>
        <div class="grid grid--2">
          <button class="btn" data-export>${icon('download')} Backup</button>
          <label class="btn" style="cursor:pointer">${icon('upload')} Restaurar<input type="file" accept="application/json,.json" data-import hidden></label>
          <button class="btn" data-csv>${icon('receipt')} CSV</button>
          <button class="btn btn--danger" data-reset>${icon('trash')} Apagar tudo</button>
        </div>
      </section>

      <section class="card section">
        <div class="card__title">${icon('phone')} Instalar no celular</div>
        ${standalone ? '<p>✅ O app já está instalado.</p>' : `
        ${installEvent ? `<button class="btn btn--primary btn--block" data-install>${icon('download')} Instalar app</button>` : ''}
        <p class="small muted" style="margin-top:10px"><strong>Android (Chrome):</strong> menu ⋮ → <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.<br>
        <strong>iPhone (Safari):</strong> botão Compartilhar → <em>Adicionar à Tela de Início</em>.</p>`}
      </section>

      <p class="small muted" style="text-align:center;margin:22px 0 6px">Controle Pessoal · HTML, SCSS, GSAP, Three.js, Matter.js, WebGPU/WebGL2</p>`;

    const nome = view.querySelector('[data-nome]');
    nome.addEventListener('change', () => {
      state.settings.nome = nome.value.trim();
      commit('settings');
      toast('Nome salvo', { icon: '👋' });
    });

    view.querySelectorAll('[data-tema]').forEach((b) =>
      b.addEventListener('click', () => {
        state.settings.tema = b.dataset.tema;
        commit('settings');
        const t = applyTheme(b.dataset.tema);
        toast(`Tema ${t.nome} aplicado`, { icon: t.emoji });
      }),
    );

    view.querySelectorAll('[data-switch]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.switch;
        state.settings[k] = !state.settings[k];
        if (k === 'fundoAnimado') shared.bg?.setAnimate(state.settings[k]);
        commit('settings');
      }),
    );

    view.querySelector('[data-pin]').addEventListener('click', openPin);
    view.querySelector('[data-pinoff]')?.addEventListener('click', async () => {
      if (!(await confirmSheet('Remover o bloqueio por PIN?', { okLabel: 'Remover' }))) return;
      state.settings.pinHash = null;
      state.settings.pinSalt = null;
      commit('settings');
    });

    view.querySelector('[data-export]').addEventListener('click', () => {
      download(`controle-pessoal-backup-${todayISO()}.json`, JSON.stringify(exportData(), null, 2));
      toast('Backup baixado', { icon: '💾' });
    });
    view.querySelector('[data-csv]').addEventListener('click', exportCSV);
    view.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Arquivo grande demais.');
        const json = JSON.parse(await file.text());
        if (!(await confirmSheet('Restaurar este backup? Os dados atuais serão substituídos.', { okLabel: 'Restaurar' }))) return;
        importData(json);
        applyTheme(state.settings.tema);
        toast('Backup restaurado', { icon: '✅' });
      } catch (err) {
        toast(err.message || 'Não foi possível ler o arquivo', { icon: '⚠️' });
      } finally {
        e.target.value = '';
      }
    });
    view.querySelector('[data-reset]').addEventListener('click', async () => {
      if (!(await confirmSheet('Isso apaga TODOS os dados do app neste aparelho. Faça um backup antes. Continuar?', { okLabel: 'Apagar tudo' }))) return;
      resetAll();
      applyTheme(state.settings.tema);
      toast('Dados apagados', { icon: '🧹' });
      ctx.go('inicio');
    });
    view.querySelector('[data-install]')?.addEventListener('click', async () => {
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      ctx.refresh();
    });
  },
};
