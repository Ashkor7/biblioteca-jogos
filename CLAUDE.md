# CLAUDE.md — Biblioteca de Jogos

Instruções para agentes de IA (Claude Code e similares) que forem trabalhar neste repositório.
Leia também `docs/CONTEXTO_DO_PROJETO.md` (estado atual, histórico e pendências), `docs/PLAYER_HUB.md` (modelos, rotas e regras da 3.0) e o `README.md`.

## O que é

Biblioteca pessoal de jogos de um único proprietário. Monorepo com workspaces do npm:

- **Frontend na raiz** (`src/`, `index.html`, `vite.config.js`): React 19, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5, React Hook Form, Recharts 3, react-icons (Feather `fi`).
- **API em `server/`**: Node 20.19+ (o dono usa 24), Express 5, Prisma 6, PostgreSQL, Zod 4, Multer 2, bcryptjs, JWT em cookie, Helmet.
- **`shared/`**: regras de domínio e contratos Zod usados **pelos dois lados** (`domain.js`, `schemas.js`).
- Toda a interface e as mensagens de erro são em **português do Brasil**.

## Comandos

```powershell
npm install                 # raiz instala frontend + server (workspace)
npm run db:embedded         # PostgreSQL embutido na porta 5433 (deixe aberto) — o PC do dono não tem Docker
npm run db:up               # alternativa com Docker (também porta 5433)
npm run db:migrate          # prisma migrate deploy
npm run db:migrate:dev      # cria nova migração após mudar server/prisma/schema.prisma
npm run admin:create        # cria/redefine o proprietário (ADMIN_EMAIL/ADMIN_PASSWORD do .env)
npm run db:backup           # backup JSON consistente em backups/ (faça antes de migrar o banco real)
npm run dev                 # API :3333 + Vite :5173 (ou dev:server / dev:client separados)
npm run lint                # ESLint (src, server, shared)
npm run test:client         # Vitest + Testing Library (jsdom), não precisa de banco
npm run test:server         # Vitest + Supertest; precisa do PostgreSQL ligado
npm run build               # build do Vite em dist/
npm run check               # lint + todos os testes + build
```

No Windows, `abrir-biblioteca.cmd` abre banco, API e página em três janelas.

**Antes de dar uma tarefa como concluída:** rode `npm run check` (com o banco ligado) e corrija tudo que falhar.

## Estrutura

```text
shared/domain.js        normalizeKey/slugify, moneyToCents, hoursToMinutes, rótulos PT-BR
shared/schemas.js       buildGameSchema + validateGame (regras entre campos), demais esquemas
shared/progression.js   curva de XP, XP_RULES, ACHIEVEMENTS, TITLES, tipos de atividade (só regras/textos)
server/prisma/          schema.prisma + migrations/ (a init tem CHECKs e índices parciais escritos à mão)
server/src/app.js       montagem do Express (helmet, cors, cookies, rotas, /uploads, dist em produção)
server/src/config.js    variáveis de ambiente validadas com Zod (falha cedo e em PT-BR)
server/src/routes/      auth.js, games.js, catalog.js (platforms, stores, categories, wishlist, statistics, import),
                        player.js (profile, favorites, sessions, collections, goals, progression, prices, finance, public)
server/src/services/    gameService, imageService, catalogService, statisticsService, lookupService, legacyImportService, authService,
                        progressionService (XP/conquistas/metas), activityService, profileService, publicService (allowlist),
                        sessionService, collectionService, favoriteService, goalService, wishlistService, timeService
server/src/lib/         errors (AppError), validate (parseOrThrow/validateGameOrThrow), serialize (gameToDto), storage (uploads)
server/tests/           testes de aceitação da API (fluxos A–I da especificação)
src/pages/              Dashboard, Profile, Library, Diary, Collections/Collection, Achievements, Goals, Activities, Settings,
                        ProfilePreview, PublicProfile/PublicCollection (/u/:username), Platform, Wishlist, Statistics, GameForm...
src/components/         Layout (menu + barra inferior no celular), PublicLayout, ProfileHero, XpBar, AchievementCard, ActivityFeed,
                        Celebrations, Modal, Toggle, StatTile, GameTile, TrendChart, DataTable, FilterBar, LibraryBrowser...
src/hooks/queries.js    hooks do TanStack Query + useLibraryMutation (invalida tudo após alterações)
src/services/api.js     cliente HTTP (fetch, mesma origem, erros como ApiError com fields)
src/utils/gameForm.js   formulário ⇄ payload da API; resolver usa validateGame do shared
src/styles/index.css    tokens do tema (@theme) e componentes (.panel, .btn, .input, .segmented...)
```

## Regras de negócio que não podem quebrar

- **Nada de persistência no navegador.** Proibido `localStorage.setItem`, `sessionStorage`, IndexedDB (ESLint e `src/test/no-browser-persistence.test.js` verificam). A única leitura de `localStorage` permitida é a importação legada em `ImportPage.jsx`.
- **Posse ≠ mídia.** `ownershipStatus` (`OWNED`/`WISHLIST`) e `mediaType` (`PHYSICAL`/`DIGITAL`/null). Desejo nunca tem `mediaType`, `paidPrice` nem loja (há CHECK no banco).
- **Plataforma ≠ loja.** Plataforma = ecossistema (Steam, Xbox); loja = vendedor (Nuuvem). Ambas, e as categorias, são criadas sob demanda com `normalizeKey` (sem caixa/acentos/pontuação) e removidas quando ficam órfãs (`pruneOrphans`, dentro da transação).
- **Plataformas são dinâmicas.** Uma única rota `/plataformas/:slug` e um único componente. Nunca criar página por plataforma. Renomear grava o slug antigo em `PlatformSlugAlias` e a API responde `redirectTo`.
- **Dinheiro** em `DECIMAL(12,2)`, trafega como string `"199.90"`; contas no SQL ou com `Prisma.Decimal`, nunca `float`. Entrada aceita `199,90` / `1.299,90`.
- **Horas** em minutos inteiros. `playTimeMinutes = legacyPlayMinutes + Σ GameSession.durationMinutes`, recalculado no servidor na mesma transação de cada alteração de sessão. Nunca somar horas antigas de novo nem inventar datas para elas. Editar o total no formulário ajusta só o saldo legado.
- **Estatísticas** só contam `OWNED`. Somas de dinheiro só com jogos que têm original **e** pago (importados com `needsReview` ficam fora). Horas por categoria podem passar do total (a UI avisa). Fórmulas no README.
- **Preço atual de desejo** é sempre digitado pelo usuário; nunca apresentar como "ao vivo".
- **Validação**: toda entrada passa por Zod no servidor. Para jogos use `validateGame`/`validateGameOrThrow` (o Zod sozinho não roda regras entre campos quando um campo já falhou). Edição (PATCH) valida o registro **mesclado**.
- **Progressão só no servidor.** XP, conquistas, níveis e metas saem do `progressionService`; o cliente nunca concede nada. Toda mutação que muda a biblioteca chama `beginProgress(tx, userId)` no início e `syncProgress(tx, userId)` no fim, **na mesma transação**. XP só por `XpTransaction` com `eventKey` único; atividades com `dedupeKey` quando o evento não pode se repetir. Criar/editar registros não dá XP. Códigos de conquista e título são IDs estáveis: não renomeie.
- **Favoritos ≠ destaque.** `FavoriteGame` (vários, ordenados) é independente de `Game.isFeatured` (um por dono).
- **Referências entre usuários** são barradas por FKs compostas `(gameId, ownerId) → Game(id, ownerId)`; mantenha esse padrão em tabelas novas que apontem para jogos.
- **Perfil público**: tudo privado por padrão e financeiro só com autorização explícita. A resposta de `/api/public` é montada por allowlist em `publicService`; nunca serialize o registro inteiro. Perfil privado e inexistente devolvem o mesmo 404. `PUBLIC_READ` está obsoleto e não deve voltar a abrir rotas administrativas.
- **Imagens**: tipo conferido por magic bytes, nome UUID gerado no servidor, arquivos apagados quando a imagem/jogo é removido. Nunca guardar Base64 no banco. Uma capa por jogo e um destaque por dono (índices parciais).

## Segurança

- Nunca commitar `.env`, `.pgdata/`, `backups/`, `server/uploads/*`, `logs/`, `dist/`, `node_modules/`, `.playwright-mcp/`.
- `SESSION_SECRET` com o texto do `.env.example` impede o servidor de iniciar (`PLACEHOLDER_RE` em `config.js`); mantenha isso.
- Escritas exigem sessão (`requireAuth`) — proteção sempre no backend, não só escondendo botões. `verifyOrigin` bloqueia escrita de outra origem.
- `HOST` padrão 127.0.0.1 em desenvolvimento; o proxy do Vite aponta para `http://127.0.0.1:3333` (não troque por `localhost`: no Windows pode resolver para IPv6).

## Interface e estilo

- Visual "Player Hub" (HUD de perfil RPG, cyberpunk): fundo azul-noite, **ciano**/azul para ação, **violeta** para progressão e XP, **âmbar** para conquistas/destaque, **magenta** só para lista de desejos. Classes: `.panel-accent`, `.panel-gold`, `.hud-label`, `.section-title` (via `SectionTitle`), `.xp-track`, `.switch`, `.rarity-*`. Tokens em `src/styles/index.css` (`bg-panel`, `text-muted`, `border-line`, `text-cyan`...). Fontes: Chakra Petch (títulos), IBM Plex Sans (texto), IBM Plex Mono (números, classe `.num`).
- Assinatura visual: cantos chanfrados (`.panel` + `.panel-body`, `.btn`). Evite excesso de neon/brilho, rótulos em CAIXA ALTA e animações em todo lugar.
- **Não use `m-0`**: o preflight do Tailwind já zera margens, e `m-0` anula `space-y-*`.
- Diálogos usam `<dialog>` nativo com a classe `.modal` (que tem `margin: auto`).
- Acessibilidade: rótulos ligados a campos (`Field` em `components/Field.jsx`), foco visível, `prefers-reduced-motion`, sem rolagem horizontal em 360 px.
- Gráficos: série única, cor `#169aa3` (âmbar `#c98320` para negativos), sempre acompanhados de tabela.
- Depois de qualquer mutação use `useLibraryMutation` (ou `useInvalidateLibrary`) para recarregar menu, listas, estatísticas e avisos de conquista (as chaves `public` não são invalidadas).
- Componentes de ícone vêm de mapas estáticos (`utils/hubIcons.js`); a regra `react-hooks/static-components` recusa ícone obtido por função durante o render.
- Datas sem horário (`AAAA-MM-DD`, colunas `DATE`) são exibidas com `formatDay` (UTC), para não voltar um dia no fuso do Brasil.

## Banco e migrações

- Alterar `server/prisma/schema.prisma` → `npm run db:migrate:dev` → **revisar o SQL gerado**: o Prisma não conhece os CHECKs e índices parciais da migração inicial e pode tentar removê-los. Se aparecer `DROP INDEX "GameImage_one_cover_per_game"` ou `"Game_one_featured_per_owner"`, apague essas linhas.
- Testes da API usam `TEST_DATABASE_URL` (o nome do banco precisa conter "test"); o banco é truncado a cada teste.

## Git

- Branch `main` em https://github.com/Ashkor7/biblioteca-jogos (repositório público).
- Mensagens de commit em português, estilo Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), com corpo explicando o porquê.
- Nunca usar `git push --force` sem pedido explícito do dono.
