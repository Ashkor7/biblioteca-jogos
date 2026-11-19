<p align="center">
  <img src="public/Biblioteca de Jogos Gamer.png" alt="Biblioteca de Jogos" width="520" />
</p>

# Biblioteca de Jogos

Biblioteca pessoal de jogos e **perfil de jogador** com persistência real no servidor. Os dados ficam em PostgreSQL, as imagens são enviadas para a API e o visual segue uma linha cyberpunk de HUD de RPG (“Player Hub”, versão 3.0).

> Novidades da 3.0 (perfil, níveis e XP, conquistas, metas, diário, coleções, favoritos, finanças 2.0, lista de desejos avançada e perfil público): referência completa em [`docs/PLAYER_HUB.md`](docs/PLAYER_HUB.md).

- **Plataformas dinâmicas.** Ao cadastrar o primeiro jogo de “Xbox 360”, a plataforma é criada no banco, aparece no menu e ganha a rota `/plataformas/xbox-360`. Uma única página atende todas as plataformas.
- **Cadastro completo.** Nome, capa (upload ou URL https), condição (físico, digital ou lista de desejos), plataforma e loja digitáveis com sugestões, preço original e preço pago.
- **Detalhes.** Várias imagens (com capa, ordenação e remoção), avaliação escrita, nota de 1 a 5 estrelas, categorias criadas por você, estado (não iniciado, zerado ou abandonado) e horas jogadas.
- **Lista de desejos** em `/desejos`, separada da biblioteca. O preço atual é informado por você (nada é inventado “ao vivo”) e há a ação **Marcar como comprado**.
- **Estatísticas** em `/estatisticas`, calculadas no PostgreSQL:
  - totais e jogos zerados;
  - valor sem desconto, valor pago, economia em R$ e em %;
  - horas totais e horas por categoria;
  - contagem por plataforma;
  - ranking de **lojas** com desconto por loja.
- **Proprietário autenticado.** Senha com bcrypt e sessão em cookie `HttpOnly`/`SameSite`. Toda escrita é protegida no backend, com validação Zod no servidor e no cliente.
- **Importação única** dos dados da versão antiga, que ficavam no `localStorage` do navegador.
- **Meu perfil** com foto, banner, nome, @usuário, biografia, nível, XP, título escolhido entre os desbloqueados, estatísticas, finanças privadas e ranking de lojas.
- **Progressão RPG** calculada no servidor: XP por jogos zerados, sessões, notas, metas e conquistas, sem XP duplicado nem ilimitado; jogos antigos contam retroativamente.
- **Diário de jogatina** (`/diario`) com sessões, calendário, semana/mês e jogos mais jogados. As horas antigas viram saldo inicial e nunca são somadas duas vezes.
- **Coleções**, **favoritos múltiplos** (o destaque único continua), **metas** e **histórico de atividades**.
- **Lista de desejos avançada**: preço-alvo, prioridade, loja preferida, notas e histórico manual de preços com gráfico.
- **Dashboard financeiro 2.0**: gastos e economia por mês/ano, acumulado, lojas, plataformas e maiores economias.
- **Perfil público opcional** em `/u/:usuário`, somente leitura, com cada seção liberada por você (tudo privado por padrão).
- **Importação da Steam** (opcional): vincule sua conta e importe a biblioteca com horas, último acesso, conquistas, descrição, gêneros, empresas, lançamento, Metacritic, capa e screenshots. Os jogos importados são jogos comuns (editáveis e excluíveis). Veja [Importação da Steam](#importação-da-steam).

---

## Sumário

1. [Tecnologias](#tecnologias)
2. [Estrutura](#estrutura)
3. [Como rodar no Windows](#como-rodar-no-windows)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Scripts](#scripts)
6. [Como usar](#como-usar)
7. [API REST](#api-rest)
8. [Regras de dados e cálculos](#regras-de-dados-e-cálculos)
9. [Testes](#testes)
10. [Segurança](#segurança)
11. [Produção](#produção)
12. [Atualizar da 2.x para a 3.0](#atualizar-da-2x-para-a-30)
13. [Importação da Steam](#importação-da-steam)
14. [Decisões de arquitetura](#decisões-de-arquitetura)

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, TanStack Query, React Hook Form, Recharts, react-icons |
| Backend | Node.js 20.19+ (testado no 24), Express 5, Zod, Multer, bcryptjs, JWT em cookie HttpOnly, Helmet, express-rate-limit |
| Banco | PostgreSQL (16 no Docker; 18 no modo embutido) + Prisma 6 (migrações versionadas) |
| Testes | Vitest + Supertest (API) e Vitest + Testing Library (interface) |
| Ambiente | Docker Compose para o PostgreSQL |

## Estrutura

```text
biblioteca-jogos/
├── index.html, vite.config.js, eslint.config.js   # frontend (Vite na raiz)
├── src/                      # React
│   ├── components/           # Layout, GameCard, TagInput, ImageManager, HBarChart…
│   ├── pages/                # Dashboard, Profile, Library, Diary, Collections, Achievements,
│   │                         # Goals, Activities, Settings, PublicProfile, Platform, Wishlist,
│   │                         # Statistics, GameForm, GameDetails, Login, Import
│   ├── hooks/                # TanStack Query, autenticação, filtros na URL
│   ├── services/             # cliente HTTP da API
│   ├── utils/                # formatação BRL/horas, conversão do formulário
│   └── styles/index.css      # tokens do tema (Tailwind @theme)
├── shared/                   # regras e contratos Zod usados pelo cliente E pela API
├── server/                   # API Express (workspace npm)
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   ├── src/{routes,services,middleware,lib,validations}
│   ├── scripts/              # create-admin, import-legacy, backup-db, verify-migration
│   ├── tests/                # testes de aceitação da API
│   └── uploads/              # imagens enviadas (fora do Git)
├── docker-compose.yml        # PostgreSQL 16 (porta 5433)
├── docker/postgres-init/     # cria o banco de testes
├── .env.example
└── docs/ESPECIFICACAO_BIBLIOTECA_JOGOS_CYBERPUNK.md
```

## Como rodar no Windows

Pré-requisitos: **Node.js 20.19+** e **Git**. Para o banco, use **Docker Desktop**, um **PostgreSQL instalado** ou o **PostgreSQL embutido via npm** (opção C, que não precisa instalar nada). Os comandos abaixo são para o PowerShell, na pasta do projeto.

### 1. Instalar dependências

```powershell
npm install
```

### 2. Configurar o ambiente

```powershell
Copy-Item .env.example .env
# Gere um segredo e cole em SESSION_SECRET no .env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Abra o `.env` e troque `POSTGRES_PASSWORD` (e a mesma senha em `DATABASE_URL`/`TEST_DATABASE_URL`), `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

### 3. Subir o PostgreSQL

**Opção A: Docker Desktop.** É a recomendada. O banco fica publicado na porta **5433**, para não brigar com um Postgres nativo que já use a 5432.

```powershell
npm run db:up
```

**Opção B: PostgreSQL instalado no Windows.** Crie o usuário e os bancos e ajuste a porta (`5432`) no `.env`:

```powershell
psql -U postgres -c "CREATE USER biblioteca WITH PASSWORD 'sua-senha' CREATEDB;"
psql -U postgres -c "CREATE DATABASE biblioteca_jogos OWNER biblioteca;"
psql -U postgres -c "CREATE DATABASE biblioteca_jogos_test OWNER biblioteca;"
```

**Opção C: PostgreSQL embutido, sem instalar nada.** Usa binários oficiais do PostgreSQL distribuídos pelo npm (pacote `embedded-postgres`) e grava os dados em `.pgdata/`, na raiz do projeto. É a opção usada na máquina de desenvolvimento original, que não tinha Docker. Deixe esta janela aberta enquanto usa o sistema:

```powershell
npm run db:embedded
```

Ele lê usuário, senha e porta do `DATABASE_URL` e cria os bancos `biblioteca_jogos` e `biblioteca_jogos_test`.

### 4. Criar as tabelas e o proprietário

```powershell
npm run db:migrate      # aplica server/prisma/migrations
npm run admin:create    # usa ADMIN_EMAIL / ADMIN_PASSWORD do .env
# ou: npm run admin:create -- --email voce@exemplo.com --password "senha-forte-aqui"
```

A senha precisa ter pelo menos 10 caracteres. Rodar o comando de novo com o mesmo e-mail **redefine a senha**.

### 5. Iniciar

**Atalho de um clique (Windows):** dê duplo clique em `abrir-biblioteca.cmd`, na raiz do projeto. Ele abre três janelas (banco embutido, API e página) e abre a biblioteca no navegador sozinho. Para ter isso na área de trabalho, clique com o botão direito no arquivo › **Mostrar mais opções** › **Enviar para** › **Área de trabalho (criar atalho)**. Para encerrar, feche as três janelas.

Ou, pelo terminal:

```powershell
npm run dev
```

- Interface: <http://localhost:5173>
- API: <http://localhost:3333/api/health>

O Vite encaminha `/api` e `/uploads` para a API, então o navegador vê uma única origem e o cookie de sessão funciona sem CORS. Se a porta 5173 estiver ocupada, o Vite usa a próxima livre (5174…). Você pode reiniciar frontend e backend à vontade: os dados continuam no PostgreSQL.

## Variáveis de ambiente

Todas ficam em um único `.env` na raiz, lido pela API, pelo Prisma e pelo Docker Compose. Veja os comentários em [`.env.example`](.env.example).

| Variável | Padrão | Para que serve |
|---|---|---|
| `DATABASE_URL` | — | Conexão do Prisma com o PostgreSQL |
| `TEST_DATABASE_URL` | `DATABASE_URL` + `_test` | Banco usado (e apagado) pelos testes. O nome precisa conter “test” |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | `biblioteca` / — / `biblioteca_jogos` / `5433` | Contêiner do Docker Compose |
| `PORT` | `3333` | Porta da API |
| `HOST` | `127.0.0.1` (dev) / `0.0.0.0` (produção) | Onde a API escuta; por padrão, em desenvolvimento, só o próprio computador acessa |
| `SESSION_SECRET` | — | Assina o cookie de sessão (mínimo de 32 caracteres); o servidor não inicia com o texto de exemplo |
| `SESSION_TTL_HOURS` | `168` | Duração da sessão |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origens aceitas em CORS e na checagem de `Origin` |
| `PUBLIC_READ` | `false` | **Obsoleta desde a 3.0** (não abre mais nada; use o perfil público). Se `true`, a API só avisa no console |
| `PUBLIC_APP_URL` | — | Endereço público do app (ex.: `https://biblioteca.exemplo.com`). Sem ele, a interface não oferece “copiar link” do perfil |
| `PUBLIC_RATE_LIMIT` | `120` | Requisições por minuto, por IP, nas rotas `/api/public` |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Fuso usado para “hoje”, semana e mês do diário e das metas |
| `COOKIE_SECURE` | `auto` | `Secure` só em produção |
| `TRUST_PROXY` | `false` | Use `true` atrás de um proxy reverso |
| `LOGIN_RATE_LIMIT` | `10` | Tentativas de login a cada 15 min por IP |
| `ALLOW_SIGNUP` | `false` | Cadastro público em `/cadastro`. Desligado, contas só por `npm run admin:create` |
| `SIGNUP_RATE_LIMIT` | `5` | Cadastros por hora, por IP |
| `UPLOAD_DIR` | `server/uploads` | Onde as imagens são gravadas |
| `MAX_UPLOAD_MB` | `5` | Tamanho máximo por imagem |
| `MAX_IMAGES_PER_GAME` | `20` | Limite da galeria |
| `LEGACY_IMPORT_MAX_MB` | `30` | Limite do JSON de importação |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Usados por `npm run admin:create` |
| `STEAM_API_KEY` | — | Chave da Web API da Steam (32 caracteres hexadecimais). Sem ela, a importação aparece desativada e as rotas `/api/steam` respondem 503. Nunca sai do servidor |
| `STEAM_CACHE_DAYS` | `30` | Validade do cache de dados da loja (compartilhado entre usuários) |
| `STEAM_STORE_INTERVAL_MS` / `STEAM_API_INTERVAL_MS` | `1500` / `250` | Intervalo mínimo entre chamadas à loja e à Web API |
| `STEAM_TIMEOUT_MS` | `10000` | Tempo máximo de cada chamada (e de cada download de imagem) |
| `STEAM_RATE_LIMIT` | `30` | Requisições por minuto, por usuário, nas rotas que consultam a Steam |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API (`:3333`, com watch) + Vite (`:5173`) |
| `npm run build` | Build de produção do frontend em `dist/` |
| `npm start` | Só a API. Com `NODE_ENV=production`, também serve o `dist/` |
| `npm run lint` | ESLint (frontend, API e `shared/`) |
| `npm test` | Testes da interface + testes de aceitação da API |
| `npm run check` | lint + testes + build |
| `npm run db:up` / `db:down` | Sobe/derruba o PostgreSQL do Docker |
| `npm run db:embedded` | PostgreSQL embutido (sem Docker/instalação); deixe a janela aberta |
| `npm run db:migrate` | Aplica as migrações (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Cria uma nova migração depois de alterar o `schema.prisma` |
| `npm run db:studio` | Prisma Studio |
| `npm run admin:create` | Cria/atualiza o proprietário |
| `npm run db:backup` | Backup lógico consistente (JSON) em `backups/`, sem precisar de `pg_dump` |
| `node server/scripts/verify-migration.js` | Confere, sem alterar nada, que a migração 3.0 preservou os dados |
| `npm run import:legacy -- --file jogos.json` | Importa o JSON antigo pelo terminal |

## Como usar

1. **Entre** em `/login`. Com `ALLOW_SIGNUP=true`, qualquer pessoa cria a própria conta em `/cadastro`; cada conta tem a sua biblioteca, perfil e progressão.
2. **Adicione um jogo** com o botão “Adicionar jogo”. Escolha **Físico**, **Digital** ou **Lista de desejos** e digite a plataforma (ex.: `Xbox`). Para jogos adquiridos, preço original, preço pago e loja são obrigatórios.
3. **A plataforma aparece no menu.** O link `Xbox` surge automaticamente e leva a `/plataformas/xbox`. Outros jogos de “xbox” (qualquer caixa ou acento) caem na mesma página. A página tem busca, filtros de estado, mídia e categoria, ordenação, resumo local e uma aba de desejos daquela plataforma. Para renomear uma plataforma, use o botão na página dela: o endereço antigo continua funcionando e redireciona. Uma plataforma que fica sem jogos some do menu.
4. **Edite os detalhes** pela página do jogo, em “Editar”: estrelas, avaliação escrita, categorias (tags livres, sem lista pronta), estado, horas (aceita `12,5`) e a galeria de imagens.
5. **Lista de desejos.** Em `/desejos`, registre o preço atual que você encontrou. A data é atualizada sozinha quando o preço muda. “Comprei” abre o formulário de compra, que pede mídia, preço pago e loja. O jogo então sai da lista e entra nas contas.
6. **Estatísticas** em `/estatisticas`: coleção, dinheiro, ranking de lojas (por quantidade, economia ou desconto percentual), horas por categoria e jogos por plataforma, sempre com gráfico e tabela.
7. **Meu perfil** (`/perfil`): identidade, nível, favoritos, estatísticas, finanças privadas, conquistas e atividades. Edite em **Configurações**, onde também ficam foto, banner, título, privacidade e a prévia “como visitante”.
8. **Diário** (`/diario`): registre sessões com duração (ou início e fim) e observações. Também dá para registrar pela página do jogo ou pelo card “Jogando atualmente”.
9. **Coleções** (`/colecoes`), **Metas e conquistas** (`/conquistas`, `/metas`) e **Atividades** (`/atividades`).
10. **Steam.** Em Configurações → **Conta Steam**, vincule a conta; depois, em Importar → **Steam**, escolha os jogos na prévia. Detalhes em [Importação da Steam](#importação-da-steam).
11. **Dados antigos.** Em Importar → **Versão antiga**, a página lê o `localStorage['jogos']` da versão anterior (só leitura) ou recebe o JSON exportado. Os jogos importados ficam marcados para revisão até você informar preço pago e loja.

## API REST

Todas as rotas ficam sob `/api`. As respostas de erro seguem o formato `{ "error": { "code", "message", "fields?" } }`, com mensagens em PT-BR. Rotas de escrita exigem sessão (`401` sem login, `403` para `Origin` desconhecida).

```text
POST   /api/auth/login                 { email, password }
POST   /api/auth/register              { email, password } (só com ALLOW_SIGNUP=true; já entra)
POST   /api/auth/logout
GET    /api/auth/me                    { user | null, publicAppUrl }
GET    /api/games?search=&platform=<slug>&platformId=&ownership=OWNED|WISHLIST|ALL
             &status=&media=&categoryId=&storeId=&source=MANUAL|STEAM&needsReview=&sort=&page=&pageSize=
POST   /api/games                      JSON ou multipart (campo "data" + arquivo "cover")
GET    /api/games/:id
PATCH  /api/games/:id                  campos parciais, validados como registro completo
DELETE /api/games/:id?ignoreSteam=true   (ignoreSteam: não importar de novo da Steam)
PATCH  /api/games/:id/featured         { isFeatured }
PATCH  /api/games/:id/mark-purchased   { mediaType, paidPrice, store, originalPrice?, purchasedAt? }
POST   /api/games/:id/images           multipart "images" (vários) ou JSON { url, isCover }
PUT    /api/games/:id/images/order     { imageIds: [...] }
PATCH  /api/games/:id/images/:imageId  { isCover: true, altText? }
DELETE /api/games/:id/images/:imageId
GET    /api/platforms                  plataformas com jogos (menu dinâmico)
GET    /api/platforms/:slug            inclui redirectTo para slugs antigos
PATCH  /api/platforms/:id              { name } renomeia
GET    /api/stores
GET    /api/categories
GET    /api/wishlist
GET    /api/statistics/overview?platformId=
GET    /api/statistics/platforms
GET    /api/statistics/stores?sort=count|savings|percent
GET    /api/statistics/categories
POST   /api/import/legacy              array do localStorage antigo (idempotente)
POST   /api/games/:id/steam-fill       { overwrite? } completa com dados da loja Steam
GET    /api/steam/account              (e PUT, DELETE, POST /lookup) conta Steam vinculada
POST   /api/steam/preview | import | resync
GET    /api/steam/jobs/:id             progresso do enriquecimento
GET    /api/steam/ignored              (DELETE /:appid desfaz)
GET    /api/health
```

Rotas da 3.0 (perfil, favoritos, sessões, coleções, metas, progressão, histórico de preços, finanças e perfil público): veja [`docs/PLAYER_HUB.md`](docs/PLAYER_HUB.md#4-rotas-novas).

## Regras de dados e cálculos

- **Posse e mídia são campos separados.** `ownershipStatus` (`OWNED`/`WISHLIST`) e `mediaType` (`PHYSICAL`/`DIGITAL`/`null`). Na lista de desejos, `mediaType`, `paidPrice` e a loja são sempre nulos.
- **Dinheiro em `DECIMAL(12,2)`.** As contas são feitas no PostgreSQL e com `Prisma.Decimal`, nunca com `float`. A API devolve os valores como string (`"199.90"`).
- **Horas em minutos inteiros** (`playTimeMinutes`). A interface aceita horas decimais. Desde a 3.0, `playTimeMinutes = legacyPlayMinutes (saldo antigo, sem data) + Σ sessões do diário`, recalculado no servidor a cada alteração de sessão.
- **Plataforma ≠ loja.** Plataforma é o ecossistema do jogo (Steam, Xbox); loja é o vendedor (Nuuvem, Instant Gaming). “Steam” pode ser as duas coisas ao mesmo tempo.
- **Normalização.** Nomes de plataforma, loja e categoria são comparados sem diferenciar caixa, acentos, espaços e pontuação. A grafia digitada primeiro é a que aparece na tela.
- **Fórmulas** (contam só jogos `OWNED`):
  - economia = Σ original − Σ pago (pode ser negativa);
  - desconto % = economia ÷ Σ original × 100, só quando Σ original > 0;
  - horas totais contam cada jogo uma única vez;
  - nas horas por categoria, o jogo soma em **cada** uma das suas categorias, então essa soma pode passar do total (a tela avisa);
  - valor atual dos desejos = Σ dos preços atuais informados, com indicação de “parcial” quando falta preço em algum item.
- **Jogos importados sem preço pago ou loja** (`needsReview`) entram nas contagens e nas horas, mas ficam fora das somas de dinheiro até serem completados. Nenhum valor é inventado.
- **Restrições no banco.** Há `CHECK`s para preços ≥ 0, horas ≥ 0, nota entre 1 e 5 e desejos sem dados de compra. Índices parciais garantem uma única capa por jogo e um único jogo em destaque por proprietário.

## Testes

```powershell
npm test            # interface + API
npm run test:server # só a API (precisa do PostgreSQL rodando)
npm run test:client # só a interface (jsdom)
```

Os testes da API aplicam as migrações num **banco separado** (`TEST_DATABASE_URL`) e o esvaziam antes de cada caso. Eles cobrem os fluxos de aceitação da especificação:

| Fluxo | Arquivo |
|---|---|
| A: persistência entre sessões | `server/tests/games.test.js` |
| B: plataformas dinâmicas, renomear e redirecionar, sumir quando vazia | `server/tests/platforms.test.js` |
| C: desejos separados e conversão em compra | `server/tests/wishlist.test.js` |
| D: validação (negativos, campos ausentes, imagem falsa, limite de tamanho) | `server/tests/games.test.js` |
| E: várias imagens, avaliação, estrelas, tags, estado e horas | `server/tests/games.test.js` |
| F: números exatos do exemplo da especificação | `server/tests/statistics.test.js` |
| G: edição e exclusão sem órfãos | `server/tests/games.test.js` |
| H: anônimo não escreve; CSRF; isolamento entre usuários | `server/tests/auth.test.js` |
| Cadastro público, isolamento entre contas e plataforma compartilhada | `server/tests/signup.test.js` |
| Importação legada idempotente | `server/tests/legacy.test.js` |
| Perfil, avatar/banner, privacidade, autorização | `server/tests/profile.test.js` |
| Favoritos e coleções (ordem, posse, exclusão sem perder jogos) | `server/tests/collections.test.js` |
| XP, níveis, conquistas, limites, retroativo sem duplicar | `server/tests/progression.test.js` |
| Diário: horas legadas + sessões, edição e exclusão | `server/tests/sessions.test.js` |
| Dashboard financeiro (mês/ano, sem data, filtros, desejos fora) | `server/tests/finance.test.js` |
| Desejos: histórico, alvo, conversão no mesmo registro | `server/tests/wishlist-advanced.test.js` |
| Metas com progresso real | `server/tests/goals.test.js` |
| Perfil público: somente leitura e só o autorizado | `server/tests/public.test.js` |
| Steam: vínculo por ID64/link/apelido, sem chave, desvincular, isolamento | `server/tests/steam-account.test.js` |
| Steam: cliente HTTP (backoff, chave fora dos erros) e download só da allowlist | `server/tests/steam-client.test.js` |
| Steam: prévia, importação idempotente, XP retroativo, job, duplicados | `server/tests/steam-import.test.js` |
| Steam: ressincronizar, horas com diário, ignorados, completar, perfil público | `server/tests/steam-resync.test.js` |
| Metadados e filtro de origem | `server/tests/metadata.test.js` |

Os testes da Steam não usam rede: o cliente é trocado por um falso (`server/tests/fixtures/steam.js`).

Na interface: prévia da Steam (seleção, filtros, estados vazio/erro/carregando), formulário com os metadados, selo e exclusão com “Não importar de novo”, contrato do formulário, `TagInput`, estrelas, barra de XP, cartão de conquista, perfil público (só as seções enviadas pelo servidor), textos/datas do Player Hub e uma checagem de que nenhum código grava em `localStorage`, `sessionStorage` ou IndexedDB.

## Segurança

- Senhas com **bcrypt** (custo 12). O hash nunca aparece nas respostas.
- Sessão em JWT HS256 dentro de cookie **HttpOnly**, `SameSite=Lax`, `Secure` em produção.
- Contra CSRF, além do `SameSite`, a API recusa escrita vinda de `Origin` fora de `CLIENT_ORIGIN`.
- Login com limite de tentativas e mesma resposta para e-mail inexistente ou senha errada.
- Validação Zod no servidor em todas as entradas.
- Uploads:
  - tipo conferido pelos *magic bytes* (JPG/PNG/WebP/GIF/AVIF);
  - limite de tamanho;
  - nome gerado no servidor (UUID);
  - remoção só de nomes no formato gerado, o que impede *path traversal*;
  - arquivos órfãos apagados ao remover imagem ou jogo.
- Helmet (CSP, `nosniff` etc.), sem `x-powered-by`.
- Perfil público com allowlist de campos, 404 igual para perfil privado ou inexistente, rate limit e somente GET. As rotas administrativas exigem login sempre (o antigo `PUBLIC_READ` não abre mais nada).
- Steam: só endereços fixos (`api.steampowered.com`, `store.steampowered.com`); imagens baixadas só de hosts da Steam numa allowlist (inclusive nos redirecionamentos), com tamanho máximo, timeout e o mesmo pipeline dos uploads. Texto da Steam é limpo (sem HTML) e validado com Zod. A `STEAM_API_KEY` nunca vai para logs, respostas ou para a página.
- `.env`, `node_modules`, `dist`, `server/uploads`, `backups/` e `.pgdata/` ficam fora do Git.

## Produção

**Railway:** passo a passo em [`docs/DEPLOY_RAILWAY.md`](docs/DEPLOY_RAILWAY.md) (Dockerfile e `railway.json` já estão no repositório, inclusive como levar a biblioteca do seu PC com `db:restore` e `uploads:push`).

```powershell
npm run build
$env:NODE_ENV="production"; npm start   # API + frontend na mesma porta (PORT)
```

- Use um PostgreSQL gerenciado e rode `npm run db:migrate` a cada deploy.
- `server/uploads` precisa ser um **volume persistente**: hospedagens com disco efêmero apagam as imagens ao reiniciar. Outra saída é trocar `server/src/lib/storage.js` por um serviço de objetos (S3, R2…).
- Defina `TRUST_PROXY=true` atrás de proxy, `CLIENT_ORIGIN` com o domínio real e um `SESSION_SECRET` forte.

## Atualizar da 2.x para a 3.0

```powershell
npm run db:embedded              # em outra janela, deixe o banco ligado
npm run db:backup                # cópia de segurança em backups/
# feche a API antiga (no Windows ela trava o arquivo do Prisma durante o npm install)
npm install
npm run db:migrate
node server/scripts/verify-migration.js
npm run dev
```

A migração é aditiva: nada é apagado, as horas antigas viram saldo inicial e jogos já zerados ficam sem data de conclusão (a data real não é conhecida). Detalhes e reversão em [`docs/PLAYER_HUB.md`](docs/PLAYER_HUB.md#7-atualizar-uma-instalação-existente-v2--v3).

## Importação da Steam

Opcional. Cada usuário vincula a própria conta e importa a biblioteca; os jogos importados são jogos comuns (`source = STEAM`): dá para editar todos os campos (inclusive preço pago, loja, nota, avaliação, estado, categorias e imagens) e excluir como qualquer outro.

### 1. Gerar a chave

1. Entre em <https://steamcommunity.com/dev/apikey> com a sua conta Steam (a Steam exige que a conta tenha feito alguma compra).
2. Em “Domínio”, qualquer nome serve (ex.: `localhost`). Aceite os termos e copie a chave de 32 caracteres.
3. No `.env`, preencha `STEAM_API_KEY=<a chave>` e reinicie a API. A chave fica só no servidor.

### 2. Privacidade da Steam

A Steam só mostra os jogos de perfis com **Detalhes de jogos** como **Público** (Perfil → Editar perfil → Configurações de privacidade). Se estiver privado, a prévia explica isso em vez de mostrar uma lista vazia. Conquistas também dependem dessa opção.

### 3. Usar

1. **Configurações → Conta Steam**: informe o SteamID64, o link do perfil (`/profiles/…` ou `/id/…`) ou só o apelido. Confira nome e avatar e confirme.
2. **Importar → Steam**: a prévia classifica cada jogo da conta em **novo**, **já na biblioteca**, **possível duplicado** (mesmo título de um jogo cadastrado à mão), **na lista de desejos**, **ignorado** ou **não é jogo** (DLC, demo, ferramenta, trilha sonora). Escolha os jogos, a plataforma e a loja de destino (padrão “Steam”), quantas screenshots baixar, se importa conquistas e se cria categorias pelos gêneros.
   - Possível duplicado: **vincular** ao jogo existente (preenche só o que está vazio), importar como novo ou ignorar.
   - Desejo: **Marcar como comprado** converte o mesmo registro e o vincula à Steam.
3. Os jogos são criados na hora; descrição, imagens e conquistas chegam em segundo plano, com barra de progresso. Se a API for fechada no meio, ela continua de onde parou ao abrir de novo.
4. **Ressincronizar** cria só os jogos que faltam e nunca sobrescreve o que você editou. A opção “atualizar horas e último acesso” só aumenta o total de horas (nunca diminui) e preserva o diário.
5. No jogo: **Completar com dados da Steam** preenche só campos vazios; **Sobrescrever** pede confirmação.
6. Excluir um jogo da Steam pergunta **Não importar de novo** (marcado por padrão). A lista de ignorados fica na tela da Steam e pode ser desfeita.

### O que é importado e o que não é

| Importado | Não importado (a Steam não fornece) |
|---|---|
| Nome, horas totais, horas nas últimas 2 semanas (definem “Jogando”), último acesso | Preço pago, preço original, data e loja da compra: o jogo fica “para revisar” e fora das somas de dinheiro até você completar |
| Conquistas desbloqueadas / total | Nota, avaliação escrita e estado “zerado/abandonado” |
| Descrição curta, gêneros (em português), desenvolvedora, distribuidora, lançamento, Metacritic | Sessões com data (as horas da Steam viram saldo sem data; nenhuma data é inventada) |
| Capa (imagem grande da loja) e screenshots opcionais | Jogos do compartilhamento familiar e DLCs como itens separados |

Não vira farm de XP: a importação roda a progressão em modo retroativo (conquistas sem avisos na tela) e registra **uma** atividade “Biblioteca Steam importada”. Steam ID, nome da conta e dados de sincronização **nunca** aparecem no perfil público. Detalhes técnicos em [`docs/PLAYER_HUB.md`](docs/PLAYER_HUB.md#8-importação-da-steam).

## Continuar o desenvolvimento

- `CLAUDE.md`: regras do projeto para agentes de IA (lido automaticamente pelo Claude Code).
- `docs/CONTEXTO_DO_PROJETO.md`: estado atual, ambiente, pendências e ideias.
- `docs/PROMPT_NOVA_SESSAO.md`: prompt pronto para começar uma nova sessão de atualizações.

## Decisões de arquitetura

- **Frontend continua na raiz e a API em `server/`** (workspaces do npm). Assim o projeto Vite original foi preservado, sem duplicar configuração. Os scripts da raiz orquestram os dois lados.
- **`shared/`** guarda normalização, conversão de moeda e horas e os esquemas Zod, usados pelos dois lados. O formulário valida com o mesmo contrato da API.
- **Uma rota dinâmica** (`/plataformas/:slug`) com um único componente. As plataformas vêm de `GET /api/platforms`, que só lista as que têm jogos.
- **Slugs estáveis com alias.** Renomear grava o slug antigo em `PlatformSlugAlias`, e a API responde `redirectTo`.
- **Transações** envolvem criar ou editar o jogo junto com plataforma, loja e tags novas, converter um desejo em compra e excluir registros órfãos.
- **TanStack Query** cuida de cache e estados de carregamento e erro. Toda alteração invalida as consultas, então estatísticas e menu se atualizam na hora.
- **Sem SweetAlert2.** A confirmação de exclusão da versão antiga foi mantida com `<dialog>` nativo, que é acessível, segue o tema e deixa o pacote menor.
