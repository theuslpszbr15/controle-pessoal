# Controle Pessoal

App pessoal para o dia a dia, que funciona offline e pode ser instalado no celular (PWA): **finanças, metas, contas, tarefas, hábitos, agenda, compras, notas/diário e foco**. Tem 10 temas e animações com WebGPU/WebGL2, Three.js, Matter.js e GSAP.

Os dados ficam na **sua conta na nuvem** (Firebase) e sincronizam entre celular, computador e qualquer navegador. Também funcionam offline: o que você fizer sem internet sobe quando a conexão voltar.

## Contas e login

No primeiro acesso, você cria uma conta com nome, usuário e senha. Depois disso, entra com o **mesmo usuário e senha em qualquer aparelho** e o app recebe você com **“Olá, Nome!”**.

- O login é feito pelo Firebase Authentication. O usuário vira um e-mail interno (`usuario@controle-pessoal.app`), então ninguém precisa informar e-mail.
- Os dados ficam no Firestore em `users/{uid}/dados`. As regras de segurança só deixam cada usuário ler e gravar os próprios dados.
- Alterações feitas num aparelho aparecem nos outros em segundos.
- Marcando **Manter conectado**, o app abre direto. Para sair, use **Ajustes → Sair da conta**.
- A senha não pode ser recuperada (não existe e-mail real), então guarde bem.

O projeto Firebase é `controle-pessoal-babc1`, no plano gratuito Spark. A configuração fica em `js/cloud.js`.

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Início** | Saudação com *text morph*, saldo do mês, gasto do dia, tarefas, hábitos, contas, agenda, foco e metas |
| **Finanças** | Receitas e despesas por categoria, bolhas com física (Matter.js), gráfico de rosca, últimos 6 meses, busca |
| **Metas** | Pote de moedas 3D (Three.js) que enche a cada depósito e orçamento mensal por categoria, com alertas em 80% e 100% |
| **Contas** | Contas fixas e assinaturas com vencimento. Ao marcar como paga, o valor é lançado em Finanças |
| **Tarefas** | Hoje, Próximas, Pendentes e Feitas, com prioridade, tags (`#casa`), urgente (`!`) e subtarefas. A tarefa concluída cai com física |
| **Hábitos** | Semana clicável, sequência de dias seguidos e mapa de calor do ano |
| **Agenda** | Calendário mensal com tarefas, compromissos e contas |
| **Compras** | Listas reutilizáveis com preço. Ao finalizar, a compra vira um gasto |
| **Notas** | Notas fixáveis com busca, diário com humor e análise de humor × gastos |
| **Foco** | Pomodoro com fundo animado mais intenso durante o foco, sons ambiente gerados (chuva, ruído marrom, ondas) e estatísticas |
| **Ajustes** | Nome, temas, efeitos, PIN, backup/restauração, exportação em CSV e instalação |

### Temas
Ametista, Lavanda, Oceano, Floresta, Terracota, Papel, Grafite, Sakura, Meia-noite e Café. Cada tema muda a paleta, a fonte dos títulos, o arredondamento dos cantos e o estilo do fundo animado (manchas, curvas de nível ou ondas).

## Rodar no computador

Requer Node.js 18 ou superior.

```bash
npm install        # só para recompilar o SCSS / atualizar bibliotecas
npm start          # abre em http://localhost:5173
```

O app já vem compilado (`css/app.css` e `vendor/`). Para mexer no visual, edite `scss/` e rode `npm run build:css`, ou `npm run watch:css` para recompilar a cada alteração.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie esta pasta (`git push`).
2. No repositório, vá em **Settings → Pages**.
3. Em *Build and deployment*, escolha **Deploy from a branch**, depois a branch `main` e a pasta `/ (root)`, e clique em **Save**.
4. Em cerca de 1 minuto o app fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Ao publicar mudanças, altere `VERSION` em `sw.js` (ex.: `cp-v6`). O app instalado se atualiza sozinho na próxima vez que for aberto.

## Instalar no celular

Abra o link do GitHub Pages no celular. O site precisa estar em HTTPS para poder ser instalado.

- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

Depois de instalado, o app abre em tela cheia e funciona offline.

## Estrutura

```
index.html            casca do app
manifest.webmanifest  configuração do PWA
sw.js                 service worker (offline e atualização)
scss/                 estilos (temas em _themes.scss)
css/app.css           CSS compilado
js/app.js             roteador, navegação, PIN, inicialização
js/auth.js            tela de login/cadastro e boas-vindas
js/cloud.js           conexão com o Firebase (login e banco de dados)
js/store.js           dados sincronizados, backup
js/ui.js              sheets, formulários, toasts, abas animadas
js/textmorph.js       text morph e contadores animados
js/fx/background.js   fundo animado WebGPU + WebGL2
js/fx/physics.js      bolhas e queda com Matter.js
js/fx/jar.js          pote 3D com Three.js
js/modules/           uma tela por arquivo
vendor/               GSAP, Matter.js, Three.js (cópia local para funcionar offline)
tools/                servidor local, geração de ícones, teste de fumaça
```

## Privacidade e segurança
- Só você tem acesso aos seus dados, garantido pelas regras do Firestore (`request.auth.uid == uid`). A chave `apiKey` em `js/cloud.js` é pública por natureza.
- O PIN é guardado como hash PBKDF2 com salt e serve só como bloqueio rápido de tela.
- O CSV exportado neutraliza fórmulas (proteção contra *CSV injection*).
