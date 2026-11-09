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
