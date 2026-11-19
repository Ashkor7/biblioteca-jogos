# Biblioteca de Jogos 3.0 — Player Hub

Referência técnica da versão 3.0: modelos, rotas, regras de progressão, privacidade e migração.
Regras gerais do projeto continuam no `CLAUDE.md` e no `README.md`.

## 1. Modelos novos (PostgreSQL / Prisma)

Migração: `server/prisma/migrations/20261109230000_player_hub_v3/` (aditiva; reversão manual em `down.sql`).

| Modelo | Para quê | Detalhes importantes |
|---|---|---|
| `Game` (colunas novas) | Estado "Jogando", diário, desejos | `PlayStatus` ganha `PLAYING`. `legacyPlayMinutes` = saldo de horas antigas (sem data). `completedAt` = quando zerou (nulo para quem já estava zerado antes da v3). `targetPrice`, `wishPriority` (`LOW/MEDIUM/HIGH`), `preferredStoreId`, `wishNotes`. `@@unique([id, ownerId])` é o alvo das chaves estrangeiras compostas. |
| `PlayerProfile` | Identidade, nível e privacidade | PK = `userId`. `username` único (`^[a-z0-9][a-z0-9_-]{2,29}$`, CHECK). `avatarKey`/`bannerKey` = nome do arquivo gerado pelo servidor (nunca Base64). `totalXp`/`level` são cache do livro-razão. `backfilledAt` marca o processamento retroativo. `notificationsSeenAt` controla os avisos. 11 flags de privacidade (ver §5). |
| `FavoriteGame` | Favoritos múltiplos e ordenados | PK `(ownerId, gameId)`, FK composta `(gameId, ownerId) → Game(id, ownerId)` com `CASCADE`. `position`, `showOnProfile`. Independe de `Game.isFeatured`. |
| `GameCollection` / `GameCollectionItem` | Coleções personalizadas | Nome único por dono (normalizado). `isPublic`, `coverGameId` (`SET NULL`). Itens com FKs compostas para coleção e jogo do mesmo dono; excluir a coleção apaga só os vínculos. |
| `GameSession` | Diário de jogatina | `playedOn DATE`, `durationMinutes` 1–1440 (CHECK), `startedAt/endedAt` opcionais (CHECK fim > início), `notes`. FK composta com o jogo. |
| `WishlistPriceEntry` | Histórico manual de preços | `price DECIMAL(12,2) ≥ 0`, `recordedOn DATE`, loja opcional. Continua existindo depois da compra. |
| `PlayerActivity` | Linha do tempo | `type`, `dedupeKey` único por usuário (evento não se repete), `data` JSON só com dados de exibição (nunca valores), `retroactive`. `gameId` com `SET NULL` (o título fica guardado em `data`). |
| `UserAchievement` | Conquistas desbloqueadas | PK `(userId, code)`. Definições em `shared/progression.js`. |
| `XpTransaction` | Livro-razão de XP | `eventKey` único por usuário, `amount > 0`, `source`, `retroactive`. |
| `PlayerGoal` | Metas pessoais | Tipo, período (`startsOn ≤ endsOn`), alvo > 0, `categoryName` (só para meta por categoria), `completedAt`. |

Lojas: `pruneOrphans` só remove uma loja quando ela não tem jogo comprado, não é loja preferida de nenhum desejo e não aparece no histórico de preços.

## 2. Horas jogadas sem duplicação

```
Game.playTimeMinutes  = Game.legacyPlayMinutes + Σ GameSession.durationMinutes
```

- Na migração, `legacyPlayMinutes` recebeu o valor atual de `playTimeMinutes` (CHECK garante `0 ≤ legacy ≤ total`).
- Criar, editar (inclusive trocar de jogo) ou excluir sessão recalcula o total do(s) jogo(s) **na mesma transação**.
- Editar "Horas jogadas (total)" no formulário ajusta só o saldo legado: `legacy = total digitado − Σ sessões`. Total menor que as sessões é recusado (400).
- Estatísticas continuam lendo `playTimeMinutes`; as fórmulas da v2 não mudaram.
- Metas de horas usam só sessões (têm data). O saldo legado não tem data e nunca recebe uma inventada.

## 3. Progressão (XP, níveis, conquistas, títulos, metas)

Arquivos: `shared/progression.js` (regras e textos) e `server/src/services/progressionService.js` (única fonte de verdade).

**Curva de nível.** XP acumulado para estar no nível *n*: `50 · (n − 1) · n` → nível 2 = 100, 3 = 300, 4 = 600, 5 = 1.000, 10 = 4.500, 15 = 10.500 (máximo 100).

**Fontes de XP** (cada evento paga uma única vez, pelo `eventKey`):

| Fonte | XP | `eventKey` | Limite (janela móvel) |
|---|---|---|---|
| Jogo adquirido marcado como zerado | 50 | `game-completed:<gameId>` | 5 por 24 h |
| Primeira nota de um jogo | 10 | `rated:<gameId>` | 10 por 24 h |
| Sessão ≥ 15 min | 10 | `session:<sessionId>` | 3 por 24 h |
| Meta concluída | 75 | `goal:<goalId>` | 6 por ano |
| Conquista desbloqueada | o valor da conquista | `achievement:<code>` | — |

Criar/editar/excluir registros, criar metas ou editar o mesmo jogo várias vezes **não** dá XP. Excluir algo não remove XP já concedido (o livro-razão é só de inclusão). Eventos que passam do limite não se perdem: são pagos numa sincronização futura, ainda uma vez só.

**Conquistas** (`ACHIEVEMENTS`): calculadas a partir do **estado atual** da biblioteca (só jogos `OWNED` contam como coleção). Depois de desbloqueada, é permanente.

| Código | Nome | Condição | XP |
|---|---|---|---|
| `first-acquisition` | Primeira Aquisição | 1 jogo adquirido | 50 |
| `collector-10` | Colecionador Iniciante | 10 adquiridos | 100 |
| `collector-50` | Colecionador Veterano | 50 adquiridos | 300 |
| `platform-explorer` | Explorador de Plataformas | adquiridos em 5 plataformas | 150 |
| `first-completed` | Primeiro Finalizado | 1 zerado | 50 |
| `completed-10` | Caçador de Créditos | 10 zerados | 150 |
| `library-master` | Mestre da Biblioteca | 25 zerados | 400 |
| `rpg-master` | Mestre dos RPGs | 5 zerados com a categoria "RPG" | 200 |
| `marathoner` | Maratonista | 100 h (saldo + diário) | 150 |
| `first-session` | Diário Aberto | 1 sessão | 30 |
| `steady-player` | Constância | sessões em 7 dias diferentes | 100 |
| `deal-hunter` | Caçador de Ofertas | 10 compras com pago < original | 150 |
| `smart-buyer` | Compra Planejada | 1 desejo convertido em compra | 50 |
| `critic` | Crítico Gamer | nota em 10 jogos | 100 |
| `curator` | Curador | 1 coleção | 30 |
| `planner` | Planejador | 1 meta | 30 |
| `goal-getter` | Meta Batida | 1 meta concluída | 75 |

**Títulos** (`TITLES`): Novato Digital (sempre), Colecionador, Colecionador Veterano, Explorador de Mundos, Caçador de Ofertas, Mestre dos RPGs, Maratonista (ligados às conquistas de mesmo tema), Veterano (nível 8) e Lenda da Biblioteca (nível 15). O servidor recusa título bloqueado.

**Metas** — progresso calculado no banco:

| Tipo | Conta |
|---|---|
| `COMPLETE_GAMES` | jogos adquiridos zerados com `completedAt` dentro do período |
| `PLAY_HOURS` | soma das sessões do período (horas inteiras) |
| `COMPLETE_CATEGORY` | zerados no período com a categoria escolhida (comparação normalizada) |
| `COMPLETE_BACKLOG` | zerados no período que já estavam na biblioteca antes do início |

Estado: `ACTIVE`, `UPCOMING`, `COMPLETED` (com `completedAt`) ou `CLOSED` (período terminou sem concluir; o resultado fica congelado). Mudar o objetivo reavalia a conclusão sem pagar XP de novo.

**Como fica atômico e idempotente.** Toda operação que altera a biblioteca roda numa transação que:

1. chama `beginProgress` (lock por usuário com `pg_advisory_xact_lock`; se a biblioteca nunca foi processada, processa o estado anterior como **retroativo**);
2. faz a alteração e grava a atividade (com `dedupeKey`);
3. chama `syncProgress`: metas → XP por estado → conquistas → soma do livro-razão → nível → atividades `LEVEL_UP`.

Se algo falha, nada fica gravado. Repetir a operação não duplica nada (chaves únicas + `createMany … skipDuplicates`). `POST /api/progression/rebuild` refaz o cache de nível a partir do livro-razão.

**Retroativo.** Na primeira visita após a migração, jogos antigos desbloqueiam conquistas e pagam XP de "zerado" marcados como `retroactive`, sem limite diário, sem aviso na tela e exibidos como "registrado retroativamente". A importação legada também roda em modo retroativo.

**Avisos visuais.** `GET /api/progression/notifications` devolve conquistas, níveis e metas novos (nunca retroativos) desde `notificationsSeenAt`; o cliente mostra e confirma com `POST …/ack`. Recarregar a página não repete o aviso.

## 4. Rotas novas

Todas exigem sessão do proprietário, exceto `/api/public/*`.

```text
GET    /api/profile                       perfil + nível + títulos + privacidade (processa retroativos na 1ª vez)
PATCH  /api/profile                       { displayName?, username?, bio?, titleCode? }
PATCH  /api/profile/privacy               flags de privacidade (chaves desconhecidas → 400)
GET    /api/profile/stats                 cartões do perfil privado (coleção, horas, finanças, lojas, zerados no ano)
GET    /api/profile/preview               o mesmo JSON que um visitante receberia (+ isPublic)
PUT    /api/profile/avatar | banner       multipart "image"
DELETE /api/profile/avatar | banner

GET    /api/favorites                     ordenados
POST   /api/favorites                     { gameId, showOnProfile? }
PUT    /api/favorites/order               { gameIds: [...] } (todos, uma vez cada)
PATCH  /api/favorites/:gameId             { showOnProfile }
DELETE /api/favorites/:gameId

GET    /api/sessions?gameId=&from=&to=&page=&pageSize=
GET    /api/sessions/summary?month=AAAA-MM   semana, mês, dias ativos, calendário, mais jogados
POST   /api/sessions                      { gameId, playedOn, durationMinutes? | startedAt+endedAt, notes? }
PATCH  /api/sessions/:id
DELETE /api/sessions/:id

GET    /api/collections
POST   /api/collections                   { name, description?, isPublic? }
GET    /api/collections/:id               com os jogos na ordem
PATCH  /api/collections/:id               { name?, description?, isPublic?, coverGameId? }
DELETE /api/collections/:id               não exclui jogos
POST   /api/collections/:id/items         { gameIds }
PUT    /api/collections/:id/items/order   { gameIds }
DELETE /api/collections/:id/items/:gameId
GET    /api/collections/of-game/:gameId

GET    /api/goals?status=&year=
POST   /api/goals                         { name, type, startsOn, endsOn, targetValue, categoryName? }
PATCH  /api/goals/:id
DELETE /api/goals/:id

GET    /api/progression/achievements      todas, com progresso atual
GET    /api/progression/activities?type=&from=&to=&retroactive=&page=
GET    /api/progression/xp                últimos registros do livro-razão
GET    /api/progression/notifications
POST   /api/progression/notifications/ack { upTo }
POST   /api/progression/rebuild

GET    /api/games/:id/prices              histórico + menor/maior/último + estado em relação ao alvo
POST   /api/games/:id/prices              { price, recordedOn, store?, note? } (só enquanto é desejo)
DELETE /api/games/:id/prices/:entryId

GET    /api/statistics/finance?year=&month=&storeId=&platformId=

GET    /api/public/profiles/:username
GET    /api/public/profiles/:username/library?page=
GET    /api/public/profiles/:username/wishlist?page=
GET    /api/public/profiles/:username/collections/:id
```

Filtros novos em `GET /api/games` e `/api/wishlist`: `status=PLAYING`, `minRating`, `minPrice`/`maxPrice` (preço pago, ou último preço nos desejos), `favorite=true|false`, `collectionId`, `priority`, `preferredStoreId`, `targetReached=true`, `sort=priority`. A busca também procura no nome das coleções. Tudo paginado no servidor.

## 5. Privacidade e perfil público

| Flag | Padrão | Libera |
|---|---|---|
| `isPublic` | **false** | o perfil inteiro; desligado = `/api/public/*` responde 404 |
| `showFavorites` | true | favoritos com `showOnProfile` |
| `showAchievements` | true | conquistas desbloqueadas |
| `showActivity` | false | últimas 15 atividades (só `title/name/level/code/rarity/stars` do `data`; `minutes` só com `showPlayStats`) |
| `showPlayStats` | true | contagens, horas, plataformas, % concluída; estado e horas nos jogos listados |
| `showLibrary` | false | jogos adquiridos (título, plataforma, capa, nota) |
| `showWishlist` | false | títulos desejados (sem preço) |
| `showOriginalValue` | **false** | soma dos preços de referência |
| `showPaidTotal` | **false** | total pago |
| `showSavings` | **false** | economia e % (e a economia por loja no ranking) |
| `showStoreRanking` | **false** | lojas mais usadas com quantidade de compras |

Coleções têm `isPublic` próprio. Garantias, todas no servidor (`server/src/services/publicService.js`):

- cada campo da resposta pública vem de uma **allowlist**; nada de e-mail, ids de usuário, hash, preço/loja/data por jogo, resenha, XP detalhado ou coleções privadas;
- perfil privado e inexistente respondem o **mesmo 404**, e username inválido nem chega ao banco (sem enumeração);
- `/api/public/*` só aceita GET (405 para o resto), tem rate limit (`PUBLIC_RATE_LIMIT` por minuto), `Cache-Control: no-store` e `X-Robots-Tag: noindex`;
- a prévia do dono (`/configuracoes/previa`) usa a mesma função que o endpoint público;
- **`PUBLIC_READ` foi desativado**: na v2 ele abria `/api/games`, `/api/statistics` etc. a qualquer visitante, inclusive com preços e lojas. Agora essas rotas exigem login sempre, e a API só avisa no console se a variável ainda estiver `true`.

Link compartilhável: só aparece se `PUBLIC_APP_URL` estiver definido (endereço público real). Em `localhost` a interface explica que ainda não há link acessível e oferece apenas a prévia.

Imagens enviadas ficam em `/uploads/<uuid>.<ext>` (nomes não adivinháveis), como na v2.

## 6. Dashboard financeiro

`/api/statistics/finance` usa a mesma regra da visão geral: só jogos `OWNED` com preço original **e** pago entram nas somas; desejos nunca contam; compras acima da referência entram com economia negativa; jogos incompletos aparecem como contagem à parte. Agrupamento por `purchasedAt` (mês `AAAA-MM` e ano); compras sem data ficam em "Sem data" e fora da linha do tempo; o acumulado soma o valor pago mês a mês. Desconto médio ponderado = economia total ÷ original total. Inclui comparativo por loja e por plataforma e as 10 maiores economias individuais.

## 7. Atualizar uma instalação existente (v2 → v3)

```powershell
npm run db:embedded              # (outra janela) banco ligado
npm run db:backup                # backups/biblioteca-<data>.json — guarde fora do Git
# feche a API antiga antes (no Windows ela trava o arquivo do Prisma)
npm install
npm run db:migrate               # aplica player_hub_v3
node server/scripts/verify-migration.js   # confere horas, datas, CHECKs e índices parciais
npm run dev
```

Na primeira abertura, o perfil é criado como privado (username `jogador-xxxxxx`, sem nada do e-mail) e a biblioteca existente é processada retroativamente.

## 8. Importação da Steam

Migração: `server/prisma/migrations/20261119142617_steam_import/` (aditiva; reversão manual em `down.sql`).

### Modelos

| Modelo | Para quê | Detalhes importantes |
|---|---|---|
| `Game` (colunas novas) | Origem, vínculo e metadados | `source` (`MANUAL`/`STEAM`, padrão `MANUAL`). `steamAppId` único por dono quando não nulo (índice parcial `Game_one_steam_app_per_owner`, escrito à mão). Leituras da Steam: `steamPlaytimeMinutes`, `steamLastPlayedAt`, `steamSyncedAt`, `steamAchievementsUnlocked/Total` (CHECK desbloqueadas ≤ total). Metadados editáveis em qualquer jogo: `description` (1000), `developer`/`publisher` (120), `releaseDate` (DATE) ou `releaseDateText` (60, quando não há data exata), `metacriticScore` (0–100). |
| `SteamAccount` | Vínculo (1:1 com o usuário) | `steamId64` (CHECK 17 dígitos), `personaName`, `avatarUrl`, `profileUrl`, `linkedAt`, `lastSyncAt`. |
| `SteamAppCache` | Dados da loja normalizados | PK `appId`, compartilhado entre usuários, válido por `STEAM_CACHE_DAYS`. `found=false` guarda “sem página” para não consultar de novo. `data` já limpo e validado por `steamAppDetailsSchema`. |
| `SteamIgnoredApp` | Não importar de novo | PK `(userId, appId)` + título para exibir. |
| `SteamSyncJob` / `SteamSyncJobItem` | Enriquecimento em segundo plano | `kind` (`IMPORT`/`RESYNC`), `status`, `total/processed/failed` (CHECK coerentes), `options`, `summary` (contagens e últimos 20 erros, sem dados sensíveis). Um item por jogo (`ENRICH` ou `ACHIEVEMENTS`), sem FK para o jogo: se ele for excluído no meio, o item vira `SKIPPED`. |

### Arquivos

- `shared/steam.js`: lê ID64/link/apelido, limpa texto externo, interpreta datas da loja e o tipo do app.
- `shared/schemas.js`: contratos Zod das rotas e do appdetails normalizado.
- `server/src/services/steamClient.js`: HTTP com timeout, intervalo mínimo, backoff em 429/5xx e erros tipados; `setSteamClient` para testes.
- `steamAccountService.js` (vínculo), `steamImportService.js` (prévia, importação, ressincronização, completar, ignorados), `steamAppData.js` (appdetails + cache), `steamEnrichService.js` (aplica dados só em campos vazios), `steamJobRunner.js` (fila no próprio processo, retomada em `startSteamWorker`).
- `server/src/lib/remoteImage.js`: download só da allowlist; `setRemoteImageFetch` para testes.

### Rotas

Todas exigem sessão (`requireAuth`), passam por `verifyOrigin` e validam com Zod. As que chamam a Steam têm rate limit por usuário (`STEAM_RATE_LIMIT`). Sem `STEAM_API_KEY`: 503 `STEAM_NOT_CONFIGURED`.

```text
GET    /api/steam/account                 { enabled, disabledReason, account, ignoredCount, linkedGames, lastJob }
POST   /api/steam/account/lookup          { input } → nome, avatar e visibilidade (não salva)
PUT    /api/steam/account                 { steamId64 } (o servidor relê o perfil na Steam)
DELETE /api/steam/account?keepAppIds=true|false   jogos ficam; false remove o vínculo de cada jogo
POST   /api/steam/preview                 { includeFreeGames? } → itens classificados (só lê)
POST   /api/steam/import                  { items: [{ appId, action: IMPORT|LINK|IGNORE, gameId? }], options }
POST   /api/steam/resync                  { updatePlaytime?, options }
GET    /api/steam/jobs/:id                progresso (total, processed, failed, percent, summary)
GET    /api/steam/ignored
DELETE /api/steam/ignored/:appid
POST   /api/games/:id/steam-fill          { overwrite? }
DELETE /api/games/:id?ignoreSteam=true    grava em SteamIgnoredApp
```

`options`: `platform` e `store` (padrão “Steam”, criados sob demanda), `includeFreeGames`, `screenshots` (0–10, limitado pelo espaço em `MAX_IMAGES_PER_GAME`), `importAchievements`, `genresAsCategories`. Atenção ao Zod 4: `options` usa `.prefault({})`, porque `.default({})` devolveria o objeto sem aplicar os padrões internos.

### Regras

- **Classificação da prévia** (nesta ordem): ignorado → já na biblioteca (mesmo `steamAppId`) → não é jogo (tipo do cache ≠ `game`, ou nome típico de trilha sonora/servidor/demo) → possível duplicado (jogo adquirido sem `steamAppId` com o mesmo `normalizeKey` do título) → na lista de desejos → novo. A prévia não chama a loja (appdetails), só `GetOwnedGames`.
- **Mapeamento**: OWNED + DIGITAL, preços e `purchasedAt` nulos, `needsReview=true` (fora das somas de dinheiro), `playStatus` PLAYING se `playtime_2weeks > 0`, senão NOT_STARTED. Nome e horas vêm sempre da Steam, nunca do navegador.
- **Horas**: ao criar, `legacyPlayMinutes = playTimeMinutes = playtime_forever`. Ao atualizar (vincular ou ressincronizar com a opção), `novoTotal = max(total atual, Steam)` e `legacy = novoTotal − Σ sessões`. Nunca diminui, nunca mexe no diário, nunca inventa data, nunca muda o estado.
- **Enriquecimento** (job): appdetails em cache, só campos vazios; gêneros viram categorias só se o jogo não tem nenhuma; capa (`header_image`) e screenshots baixadas; se o download falha, fica a URL https da Steam. `overwrite` (só pelo botão, com confirmação) troca os metadados, põe a capa da Steam e soma os gêneros às categorias do usuário; título, preços, nota, avaliação e estado nunca mudam.
- **Progressão**: importar e ressincronizar rodam `beginProgress` + `syncProgress({ retroactive: true })` na mesma transação; o job também, por item. Uma atividade `STEAM_IMPORTED` por importação (`dedupeKey steam-import:<jobId>`), nunca N `GAME_ADDED`.
- **Privacidade**: `STEAM_IMPORTED` está em `PRIVATE_ACTIVITY_TYPES` e não sai em `/api/public`; o DTO público continua por allowlist (sem `source`, `steam`, Steam ID nem nome da conta). Não há flag para mostrar “origem Steam” publicamente.
- **Isolamento**: tudo filtrado por `userId`; vincular só a jogo do próprio dono; jobs de outro usuário respondem 404.

### Limitações conhecidas

- `appdetails` não é documentado e tem limite baixo (por volta de 200 consultas a cada 5 minutos): bibliotecas grandes levam alguns minutos para completar. Em 429 persistente, o job pausa e tenta de novo.
- A prévia só conhece o tipo do app (DLC, ferramenta…) depois que ele passou pelo cache. Antes disso, só o nome denuncia trilhas sonoras, servidores e demos; uma DLC com nome comum aparece como “novo”.
- O job roda dentro do processo da API (não há fila externa). Com várias instâncias da API, cada uma retomaria os mesmos jobs pendentes.
