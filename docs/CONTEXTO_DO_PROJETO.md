# Contexto do projeto — para continuar em uma nova sessão

Documento de passagem: o que já existe, como o ambiente do dono está montado, o que ficou pendente
e como pedir as próximas atualizações. Atualize este arquivo ao fim de cada sessão de trabalho.

**Última atualização:** 01/11/2026 · **Commit de referência:** `4fbe922` (branch `main`)

## 1. Histórico resumido

| Commit | O que entrou |
|---|---|
| `3a9684c` | Projeto original (trabalho do SENAC): React + Vite + Tailwind, `App.jsx` único, jogos no `localStorage` |
| `54ed77f` | Monorepo com workspace `server/`, Docker Compose, `.env.example`, ESLint/Vite configurados |
| `52b2510` | API Express + Prisma + PostgreSQL: autenticação, jogos, imagens, plataformas dinâmicas, desejos, estatísticas, importação legada, testes |
| `c9e56f1` | Interface nova (cyberpunk) com rotas, páginas e componentes |
| `4778df9` | README completo |
| `662ced6` | Atalho `abrir-biblioteca.cmd` |
| `4fbe922` | Segurança: recusa segredos de exemplo, API só local por padrão, spec sem caminho pessoal |

A especificação original que guiou o trabalho está em `docs/ESPECIFICACAO_BIBLIOTECA_JOGOS_CYBERPUNK.md`.

## 2. O que está pronto (checklist da especificação)

- [x] Persistência só no PostgreSQL (nada no navegador)
- [x] Cadastro: nome, capa (upload ou URL https), físico/digital/desejo, plataforma e loja digitáveis com sugestões, preço original e pago
- [x] Edição detalhada: várias imagens (capa, ordem, remoção), avaliação escrita, 1–5 estrelas, categorias livres, estado, horas decimais
- [x] Plataformas criadas dinamicamente, rota única `/plataformas/:slug`, renomear com redirecionamento, somem quando ficam sem jogos
- [x] `/desejos` separada, preço atual informado pelo usuário, total parcial, "Marcar como comprado"
- [x] `/estatisticas` com KPIs, ranking de lojas (quantidade, economia, %), horas por categoria, jogos por plataforma, gráficos + tabelas
- [x] Autenticação do proprietário (bcrypt, cookie HttpOnly, rate limit, checagem de Origin)
- [x] Uploads reais validados; arquivos órfãos apagados
- [x] Importação única do `localStorage` antigo (idempotente, marca para revisão)
- [x] Destaque (um por vez) e exclusão com confirmação, herdados da versão antiga
- [x] Mobile-first (testado em 360 px), teclado, foco visível, `prefers-reduced-motion`
- [x] Testes: 54 da API (fluxos A–I) + 14 da interface; lint e build sem erros

## 3. Ambiente do dono (Windows)

- Node.js + npm e Git instalados. **Docker e PostgreSQL não estão instalados**: o banco roda com `npm run db:embedded` (PostgreSQL 18 embutido via npm, dados em `.pgdata/`, porta 5433).
- `.env` já existe na pasta local com segredos gerados no próprio PC (não está no Git).
- `abrir-biblioteca.cmd` abre banco, API (127.0.0.1:3333) e página (Vite; 5173 ou a próxima porta livre).
- Às vezes há outro Vite antigo ocupando a porta 5173 num terminal do dono; o Vite novo usa 5174.
- A pasta local **ainda pode não ser um repositório Git** (o código chegou lá por cópia). Para ligá-la ao GitHub sem perder `.env`, `.pgdata` e `node_modules`:

  ```powershell
  git init -b main
  git remote add origin https://github.com/Ashkor7/biblioteca-jogos.git
  git fetch origin
  git reset --mixed origin/main
  git branch -u origin/main
  git status   # deve sair limpo; se aparecerem sobras antigas ((, {, src/index.css, src/assets, public/icons.svg, logs), pode apagar
  ```

## 4. Pendências e limitações conhecidas

- **Docker/PostgreSQL nativo** não foram testados no PC do dono (só o modo embutido). O `docker-compose.yml` foi escrito, mas não executado.
- **Produção/deploy** não foi feito. Para publicar: banco gerenciado, `UPLOAD_DIR` em volume persistente (ou trocar `server/src/lib/storage.js` por S3/R2), `NODE_ENV=production`, `TRUST_PROXY=true`, `CLIENT_ORIGIN` com o domínio, `SESSION_SECRET` forte.
- **`npm audit`** aponta 6 vulnerabilidades altas em dependências de terceiros (não tratadas).
- **Histórico do Git** contém, nos commits antigos, o caminho da pasta local do Windows na especificação. O dono decidiu manter (o e-mail dos commits também é público por escolha dele).
- A imagem `public/Biblioteca de Jogos Gamer.png` (logo original) aparece só no README: o texto escuro dela não tem contraste no tema escuro.
- O orquestrador `logs/run.mjs` e os `.cmd` em `logs/` foram ferramentas da configuração assistida; a pasta `logs/` é ignorada pelo Git e pode ser apagada (contém uma senha antiga).

## 5. Ideias de próximas atualizações (fora do escopo já entregue)

- Linha do tempo de compras e gastos por mês/ano (dados já existem em `purchasedAt`)
- Exportar/importar CSV ou JSON e backup do banco
- Histórico de preços da lista de desejos (sem alegar coleta automática)
- Conquistas pessoais / metas (ex.: zerar X jogos no ano)
- Modo visitante somente leitura para compartilhar a coleção (já existe `PUBLIC_READ=true`; falta UI de convite)
- Deploy (Render/Railway/Fly) com banco gerenciado e armazenamento de imagens
- Paginação infinita ou virtualização para bibliotecas grandes
- Testes E2E automatizados no navegador (Playwright)

## 6. Como pedir uma atualização numa nova sessão

1. Abra a sessão com acesso ao repositório (Claude Code na pasta do projeto, ou conectando o GitHub `Ashkor7/biblioteca-jogos`).
2. Anexe/cole o prompt de `docs/PROMPT_NOVA_SESSAO.md`, preenchendo o que você quer mudar.
3. Peça para o agente rodar `npm run check` antes de concluir e para atualizar este arquivo no fim.
