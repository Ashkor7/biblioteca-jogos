# BIBLIOTECA DE JOGOS — ESPECIFICAÇÃO TÉCNICA E FUNCIONAL

**Versão:** 1.0 · **Data:** 28/10/2026  
**Projeto:** Biblioteca de Jogos — evolução full-stack / interface cyberpunk  
**Repositório:** https://github.com/Ashkor7/biblioteca-jogos  
**Pasta local do Windows:** `C:\Users\Ashkor\Documents\SENAC\2 SEMESTRE programacao web edecio\biblioteca-jogos`

> **Objetivo:** transformar a aplicação React existente em uma biblioteca pessoal de jogos completa, com persistência em banco de dados no servidor, páginas de plataformas criadas dinamicamente, lista de desejos separada, gerenciamento detalhado de cada jogo, estatísticas financeiras/de uso e uma interface cyberpunk original, responsiva e acessível. **Não entregar apenas mockups:** implementar, executar, testar e preparar publicação no GitHub.

## 1. Estado atual constatado no ZIP inicial

- Projeto original dentro da pasta `trab2/`.
- Frontend em **React 19 + Vite 8 + Tailwind CSS 4**, com `react-icons`, `sweetalert2` e `react-hook-form` já nas dependências.
- Lógica e interface concentradas em `src/App.jsx`.
- Jogos salvos pelo navegador em `localStorage.getItem('jogos')` e `localStorage.setItem('jogos', ...)`.
- Estrutura de jogo atual aproximada: `id`, `nome`, `categoria` (única), `plataforma`, `preco`, `status`, `capa` (Data URL), `avaliacao` (número de estrelas) e `destaque`.
- `README.md` ainda é o template padrão do Vite. No `package.json`, o nome do projeto ainda aparece como `agenda`.
- O ZIP inclui **`node_modules/` e `dist/`**, que não devem ser copiados para commits. Há também arquivos soltos sem utilidade aparente; revisar antes de importar.
- Na consulta de 28/10/2026, o GitHub `Ashkor7/biblioteca-jogos` existe, mas está **vazio**, com branch principal declarada `main`.

**Importante:** usar o projeto antigo como ponto de partida; não descartar funcionalidades úteis sem explicação. Não presumir que a pasta local contém exatamente o ZIP: inspecionar o estado real antes de modificar. O agente que executará este documento deve conferir o conteúdo atual do GitHub e da pasta local novamente.

## 2. Tecnologias e arquitetura recomendadas

| Camada | Tecnologia | Finalidade |
|---|---|---|
| Frontend | React + Vite | Interface SPA e componentes reutilizáveis |
| Estilos | Tailwind CSS | Design system cyberpunk e responsividade |
| Roteamento | React Router | Rotas dinâmicas sem criar componentes por plataforma |
| Backend | Node.js LTS + Express | API REST, validação, autenticação e regras de negócio |
| Banco | PostgreSQL | Persistência real no servidor |
| ORM | Prisma | Modelagem, migrações e consultas |
| Dados remotos | TanStack Query ou abordagem equivalente | Cache de requisições, carregamento, erros e invalidação |
| Validação | Zod ou equivalente | Contratos de entrada no cliente e no servidor |
| Gráficos | Recharts ou equivalente acessível | Painel de estatísticas |
| Desenvolvimento | Docker Compose para PostgreSQL | Ambiente local reproduzível |
| Testes | Vitest + Supertest e testes de interface | Validar API, regras e fluxos principais |

**Restrições obrigatórias:**
1. **Não usar `localStorage`, `sessionStorage` ou IndexedDB como banco de dados.** React pode manter estados transitórios de formulários e preferências em memória. Os dados persistentes vêm exclusivamente da API e do PostgreSQL.
2. Os dados de capa e imagens extras devem ser **arquivos armazenados no servidor/serviço de armazenamento**, com URLs/metadados no banco. Nunca salvar imagens em Base64 nos registros do banco.
3. Não incluir segredos no Git. Criar `.env.example` e documentar a configuração. Evitar hardcode de credenciais.
4. Manter a estrutura simples e organizada, adequada a um projeto de portfólio; não introduzir microsserviços ou complexidade desnecessária.
5. Para produção, o banco e as imagens precisam de armazenamento **durável**. A pasta local de uploads pode ser usada no desenvolvimento, mas não presumir que sobreviverá a reinicializações de hospedagens efêmeras.
6. Implementar uma **autenticação de proprietário** simples, segura e documentada para impedir edição/exclusão por visitantes anônimos. Usar senha com hash, autorização no backend e sessão/cookie seguro ou mecanismo equivalente. Nunca depender apenas de ocultar botões no frontend.

### Estrutura sugerida (pode adaptar após auditoria)

```text
biblioteca-jogos/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PlatformPage.jsx
│   │   │   ├── WishlistPage.jsx
│   │   │   ├── StatisticsPage.jsx
│   │   │   ├── GameFormPage.jsx
│   │   │   └── GameDetailsPage.jsx
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   └── styles/
│   └── package.json
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── validations/
│   ├── tests/
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── docs/
    └── ESPECIFICACAO_BIBLIOTECA_JOGOS_CYBERPUNK.md
```

**Observação:** se adotar monorepo com `client/` e `server/`, incluir scripts de execução na raiz (`dev`, `build`, `test`, `lint`, `db:migrate`) e manter a configuração do Vite/Tailwind funcionando.

## 3. Identidade visual e experiência cyberpunk

A interface precisa ser **cyberpunk elegante**, não um painel genérico apenas pintado de neon. Inspirar-se em HUDs de jogos, consoles de comando, interfaces de inventário e elementos de ficção científica sem copiar telas ou marcas de terceiros.

- Base escura: grafite, preto azulado e superfícies com hierarquia visível.
- Cor de ação principal: ciano elétrico; cor secundária de destaque: magenta ou âmbar, usadas com parcimônia.
- Tipografia legível, hierarquia forte, números em estilo de painel técnico, detalhes discretos em monoespaçada.
- Bordas técnicas, divisórias, barras de progresso, microindicadores e texturas suaves opcionais. Evitar excesso de glow, partículas e poluição visual.
- Identidade consistente para menus, cartões de jogos, formulários, diálogos, gráficos, mensagens de erro e tela de login.
- Layout mobile-first. Testar largura pequena (~360 px), tablet e desktop. Navegação por teclado, `aria-label` onde preciso, contraste apropriado, foco visível e suporte a `prefers-reduced-motion`.
- Estados de carregamento, ausência de dados, erro e confirmação. Não exibir estatísticas fictícias no painel vazio.
- Preservar a capa do jogo como elemento visual central; imagens devem manter proporção, conter texto alternativo e fallback.

### Organização de navegação

- **Visão geral:** `/` — resumo, últimos jogos, destaques, busca e atalhos.
- **Plataformas dinâmicas:** `/plataformas/:slug` — tela única reutilizada para qualquer plataforma cadastrada a partir dos jogos.
- **Lista de desejos:** `/desejos` — jogos desejados separados dos adquiridos.
- **Estatísticas:** `/estatisticas` — gráficos, totais e análises.
- **Adicionar jogo:** `/jogos/novo`.
- **Detalhes do jogo:** `/jogos/:id`.
- **Editar jogo:** `/jogos/:id/editar` (ou modal/rota equivalente, garantindo link direto e navegação coerente).
- **Autenticação:** `/login` para o proprietário, se não houver sessão válida.

## 4. Regras de cadastro de jogos

Ao clicar **Adicionar jogo**, exigir no formulário:

| Campo | Regra |
|---|---|
| Nome do jogo | Obrigatório; texto validado |
| Foto de capa | Upload de imagem ou URL validada; prévia; fallback se ausente (dar preferência ao upload) |
| Condição da coleção | **Físico**, **Digital** ou **Lista de desejos** |
| Plataforma | Obrigatória; **campo digitável com sugestões de registros existentes**, que permite criar plataforma nova |
| Preço original / sem desconto | Obrigatório para jogos adquiridos; monetário BRL >= 0 |
| Preço pago | Obrigatório para adquiridos; monetário BRL >= 0, podendo ser 0 em jogos gratuitos |
| Onde comprou | Obrigatório para adquiridos; **loja digitável**, sem lista fechada, com reutilização das existentes |

**Modelagem recomendada:** separar `ownershipStatus` (`OWNED`/`WISHLIST`) de `mediaType` (`PHYSICAL`/`DIGITAL`/`null`). A interface pode mostrar as três opções solicitadas, mas essa separação evita inconsistências ao mover um jogo da lista de desejos para a biblioteca.

**Para jogo na lista de desejos:** não exigir `preço pago`, `onde comprou` ou mídia física/digital; salvar esses campos como nulos. Adicionar `preço atual informado` opcional e `data de atualização do preço` para permitir calcular o valor atual da lista de desejos sem fingir que há cotação ao vivo. Se o preço atual não for informado, exibir o registro como **sem preço atual** e indicar que o total é parcial. O preço original (referência) pode ser informado mesmo na lista de desejos.

**Exemplo de cadastro:** `Cyberpunk 2077`, plataforma `Steam`, mídia `Digital`, preço original `R$ 199,90`, pago `R$ 79,90`, loja `Nuuvem`. **Plataforma** é a biblioteca/ecossistema do jogo; **loja** é o vendedor. `Steam` pode ser simultaneamente plataforma e loja, mas são dimensões diferentes.

### Cadastro e edição avançada de jogo

Na página de detalhes/edição, permitir:
- Adicionar, visualizar, ordenar e remover **múltiplas imagens** além da capa.
- Escrever e editar **avaliação textual** livre.
- Definir **nota de 1 a 5 estrelas**, ou sem nota se ainda não avaliou.
- Inserir **uma ou mais categorias**, digitadas manualmente como tags. Não carregar categorias predefinidas. Usar sugestão/autocomplete a partir das categorias já salvas, evitando duplicatas por caixa/acentuação/espaços na comparação.
- Escolher **estado atual**: `Não iniciado`, `Zerado` ou `Abandonado`.
- Registrar **horas de jogo** (aceitar valor decimal na UI, como `12,5` horas, e guardar com precisão adequada; preferencialmente minutos inteiros no banco).
- Editar nome, plataforma, tipo, preços, loja e capa posteriormente.
- Manter recurso existente de **destaque** (um jogo por vez, se for o comportamento atual) e exclusão com confirmação.
- Mover da lista de desejos para biblioteca informando mídia, preço pago e loja; atualizar as estatísticas automaticamente.
- Não impedir avaliação e horas em `Não iniciado` sem necessidade; se houver regra adicional, documentá-la e aplicá-la consistentemente.

### Regras de integridade

- Validar dados no **backend**, não somente no formulário.
- Permitir títulos iguais em plataformas diferentes e até múltiplas cópias do mesmo jogo, sem sobrescrever indevidamente.
- Tratar preços com decimal preciso (por exemplo `DECIMAL(12,2)` ou centavos inteiros). Não depender de `float` para cálculos financeiros.
- Permitir preço pago superior ao preço original: isso representa **gasto acima da referência**, não um desconto. Mostrar a diferença corretamente.
- Uploads: aceitar apenas formatos de imagem seguros (`jpg`, `png`, `webp` etc.), com verificação real de tipo/tamanho e limite configurável; nomes gerados no servidor; impedir path traversal. Excluir arquivos órfãos com segurança.
- Usar slugs únicos e estáveis nas rotas; a identificação interna deve continuar por ID.

## 5. Plataformas geradas automaticamente — requisito central

**NÃO** manter páginas fixas/hardcoded para Xbox, PlayStation, Wii, Steam, PC etc.

Comportamento obrigatório:
1. Plataforma inicialmente desconhecida (`Xbox 360`, por exemplo) é digitada ao cadastrar o primeiro jogo.
2. O backend cria ou reutiliza o registro da plataforma em uma transação, normalizando espaços e evitando duplicatas como `xbox` vs `Xbox`.
3. Surge automaticamente no menu a opção `Xbox 360`, oriunda da consulta ao banco.
4. A rota `/plataformas/xbox-360` funciona com o mesmo componente que atende todas as outras plataformas.
5. Jogos adicionados depois à plataforma aparecem na mesma página, sem criar arquivos `.jsx` novos.
6. Se o nome da plataforma for renomeado, preservar associação dos jogos e lidar corretamente com a rota antiga (redirecionamento ou URL estável).
7. Se uma plataforma ficar sem jogos, ocultá-la da navegação ativa, ou manter apenas como registro administrativo; nunca deixar itens órfãos no menu.
8. Um jogo na lista de desejos também pode referenciar uma plataforma. Na página da plataforma, separar o acervo **adquirido** da wishlist, usando um atalho ou seção bem identificada; a lista de desejos principal continua independente.

Cada página da plataforma deve oferecer grade de capas, busca, ordenação, filtros por estado/categoria/mídia, estatísticas locais resumidas, botão adicionar jogo, detalhes, edição e exclusão.

## 6. Lista de desejos — página própria

A rota `/desejos` exibe **somente** itens `WISHLIST`, com capa, nome, plataforma, preço atual informado, preço de referência, tags e data da última atualização de preço (quando houver). Oferecer busca, filtros, edição, exclusão e ação **Marcar como comprado**.

- Um jogo desejado não conta como adquirido nas métricas de propriedade, gasto, desconto ou jogos zerados, mesmo que possua preço ou horas cadastradas.
- A ação `Marcar como comprado` abre formulário de conversão e exige mídia, preço original (se necessário), preço pago e loja.
- **Valor atual da lista de desejos = soma dos preços atuais informados**, sem consulta automática a loja. Mostrar quantos itens estão sem preço atual e deixar explícito se o valor for parcial.
- Não chamar de preço “ao vivo” ou “atualizado automaticamente” sem implementar uma integração real e confiável.

## 7. Painel de estatísticas — página própria

A rota `/estatisticas` deve usar agregações **originadas no banco/API**, recalculadas após inclusão, edição ou exclusão, com carregamento e estados vazios. Implementar:

| Indicador | Definição |
|---|---|
| Jogos na biblioteca | Contagem de `OWNED` (não inclui wishlist) |
| Jogos zerados | Contagem de `OWNED` com status `Zerado` |
| Jogos não iniciados/abandonados | Contagens opcionais complementares |
| Itens na lista de desejos | Contagem de `WISHLIST` |
| Valor atual dos desejos | Soma dos `currentWishPrice` informados; indicar se parcial |
| Valor total sem desconto | Soma de `originalPrice` dos jogos `OWNED` |
| Valor total pago | Soma de `paidPrice` dos jogos `OWNED` |
| Economia líquida | Valor original - valor pago; pode ser negativa |
| Desconto percentual total | `(soma_original - soma_paga) / soma_original * 100`, somente se soma_original > 0 |
| Horas totais | Soma das horas/minutos de jogos `OWNED`, contando cada jogo uma única vez |
| Horas por categoria | Soma integral das horas de cada jogo `OWNED` associado à categoria |
| Distribuição por plataforma | Quantidade de jogos `OWNED` por plataforma |
| Compras por loja | Quantidade de jogos `OWNED` por loja (Steam, Nuuvem, Instant Gaming etc.) |
| Desconto por loja | Por loja: preço de referência total, total pago, economia líquida e percentual de desconto |

**Atenção à ambiguidade de categorias:** se um jogo tiver `RPG` e `Ação` e 10 horas, essas 10 horas entram em cada uma das duas categorias. Portanto a soma de horas por categoria **pode exceder** o total geral. Informar isso claramente; o total geral nunca deve contar um jogo duas vezes.

**Atenção à loja vs plataforma:** o gráfico de “onde comprei mais” deve agrupar pelo **campo loja**; o gráfico de plataformas é outro. Permitir classificar lojas por quantidade de jogos, desconto absoluto e desconto percentual. Se uma compra custar mais que o preço de referência, destacar a diferença sem mascarar valores.

Elementos visuais: KPIs, barras horizontais comparativas por loja, barras por categoria, distribuição por plataforma, tabela de resumo com números legíveis e tooltip útil. Gráficos devem ter alternativa tabular/legível; evitar gráficos decorativos sem informação.

## 8. Banco de dados — esquema conceitual

Usar Prisma/PostgreSQL e migrações versionadas. Nomes podem variar, mas os vínculos precisam ser equivalentes.

### Entidades

**User** (único proprietário inicialmente): `id`, `email`, `passwordHash`, `createdAt`; nunca expor `passwordHash` em respostas.

**Platform**: `id`, `name`, `slug` (único), `createdAt`; criada quando a primeira referência é enviada, não via seed fixo.

**Store**: `id`, `name`, `normalizedName` (único), `createdAt`; criada/reutilizada ao digitar onde comprou.

**Category**: `id`, `name`, `normalizedName` (único), `createdAt`; criada/reutilizada por tags digitadas.

**Game**:
- `id` (UUID), `ownerId`, `title`, `platformId` (FK obrigatória)
- `ownershipStatus` (`OWNED`/`WISHLIST`)
- `mediaType` (`PHYSICAL`/`DIGITAL`/null)
- `originalPrice` (`DECIMAL(12,2)`; nullable para wishlist sem referência)
- `paidPrice` (`DECIMAL(12,2)`; nulo para wishlist)
- `currentWishPrice` (`DECIMAL(12,2)`; usado em wishlist)
- `wishPriceUpdatedAt` (nullable)
- `storeId` (FK nullable para wishlist)
- `playStatus` (`NOT_STARTED`/`COMPLETED`/`ABANDONED`)
- `playTimeMinutes` (inteiro não negativo)
- `ratingStars` (inteiro 1–5 ou null)
- `reviewText` (texto ou null)
- `isFeatured` (boolean)
- `createdAt`, `updatedAt`

**GameCategory**: ligação `gameId` + `categoryId` com chave composta única (N:N).

**GameImage**: `id`, `gameId`, `url`/`storageKey`, `isCover`/`position`, `createdAt`. Garantir que cada jogo possua no máximo uma imagem marcada como capa, se aplicável.

**Session/Auth**: implementar conforme estratégia adotada. Se houver mais de um usuário no futuro, toda consulta/mutação de jogo deve validar `ownerId`.

### Migração de dados antigos

A versão antiga usa `localStorage['jogos']` com imagem Base64. Implementar **importação única opcional** do JSON exportado do navegador antigo (ou utilitário de conversão documentado) para não perder registros. Converter categorias antigas em tags, `preco` em preço de referência, `avaliacao` em estrelas, status antigo para o novo enum e capas Base64 em arquivos de upload. Campos ausentes (`paidPrice`, `store`) devem exigir revisão/ser marcados para complementação antes de contar gastos; não inventar valores. **Não manter dependência contínua de localStorage.**

## 9. API REST sugerida

Rotas finais podem variar, mantendo semântica, validações e autenticação:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/games?search=&platformId=&status=&categoryId=&ownership=&sort=
POST   /api/games
GET    /api/games/:id
PATCH  /api/games/:id
DELETE /api/games/:id
POST   /api/games/:id/images
DELETE /api/games/:id/images/:imageId
GET    /api/platforms
GET    /api/platforms/:slug
GET    /api/stores
GET    /api/categories
GET    /api/wishlist
PATCH  /api/games/:id/mark-purchased
GET    /api/statistics/overview
GET    /api/statistics/platforms
GET    /api/statistics/stores
GET    /api/statistics/categories
POST   /api/import/legacy             # opcional, autenticado, sem duplicação
```

- Usar validação por campo, códigos HTTP corretos, payloads consistentes, mensagens úteis em PT-BR e tratamento de falhas.
- Adotar paginação quando o catálogo crescer; usar indexes nas chaves de busca e consulta frequente.
- Normalizar nomes de plataforma/loja/categoria sem apagar a grafia amigável apresentada ao usuário.
- Proteger endpoints de escrita com autenticação/autorização. Se usar cookie de sessão, configurar `HttpOnly`, `Secure` em produção, `SameSite`, CORS explícito e proteção contra CSRF conforme topologia adotada.
- Criar transações para criação de jogo + nova plataforma/loja/tags e para conversão da wishlist em compra.

## 10. Fluxos de aceitação obrigatórios

**Teste A — Persistência real:** cadastrar jogo, recarregar a página, fechar/abrir navegador e consultar em outro navegador autenticado. Os dados continuam presentes porque estão no PostgreSQL, não em cache local. Desligar a API deve mostrar erro controlado, nunca uma falsa lista salva no navegador.

**Teste B — Plataforma dinâmica:** começar sem plataformas predefinidas; cadastrar `Xbox 360`, verificar item do menu e `/plataformas/xbox-360`; cadastrar outro Xbox 360, verificar ambos; cadastrar `Wii`, verificar página automaticamente. Não criar arquivos específicos para cada plataforma.

**Teste C — Coleção e desejos:** cadastrar um título desejado e confirmar que ele só aparece em `/desejos` e na seção de desejos da sua plataforma; ele não aumenta total de adquiridos ou gastos. Convertê-lo em adquirido e verificar todos os contadores.

**Teste D — Cadastro completo:** título, capa, condição, plataforma, preço original, pago, loja; validar valores negativos, imagens inválidas, campos ausentes e edição.

**Teste E — Detalhes:** associar 2+ imagens, revisão textual, nota 1–5, 2+ tags digitadas, status e horas; salvar, atualizar página e confirmar persistência.

**Teste F — Estatísticas corretas:**
1. Jogo A: plataforma Steam, loja Nuuvem, original R$ 200, pago R$ 120, 10 horas, categorias `RPG` e `Ação`, status `Zerado`.
2. Jogo B: plataforma Xbox, loja Instant Gaming, original R$ 100, pago R$ 70, 5 horas, categoria `Ação`, status `Não iniciado`.
3. Jogo C: wishlist, preço atual R$ 90, original R$ 120, não comprado.
4. Esperado: adquiridos `2`; zerados `1`; desejos `1`; soma original adquiridos `R$ 300`; total pago `R$ 190`; economia `R$ 110`; horas totais `15`; `RPG=10 h`, `Ação=15 h`; desejos `R$ 90`; por loja Nuuvem `1 compra / R$ 80 de economia`, Instant Gaming `1 compra / R$ 30 de economia`.

**Teste G — Edição/exclusão:** alterar loja, plataforma, preço e tags; verificar agregações e rotas; excluir jogo e validar atualização da UI e das estatísticas sem registros órfãos.

**Teste H — Responsividade/segurança:** navegar e operar em ~360 px e desktop, com teclado; usuário anônimo não consegue cadastrar, editar nem excluir pelo endpoint.

**Teste I — Build:** scripts de instalação, migração, execução, lint, testes e build concluídos. Nenhum `.env`, `node_modules`, `dist`, upload persistente ou segredo incluído no commit.

## 11. Etapas de implementação para o agente

### Etapa 0 — Auditoria e Git
- Abrir a pasta local informada, `git status`, conferência da árvore e do repositório remoto.
- Se pasta vazia, importar seletivamente **o conteúdo de `trab2/`**, sem criar subdiretórios desnecessários e sem `node_modules/`/`dist/`.
- Se já houver arquivos ou commits locais, preservá-los e trabalhar sobre eles, não sobrescrever às cegas.
- Conectar ao remoto `https://github.com/Ashkor7/biblioteca-jogos.git`. Como o repositório estava vazio na auditoria, tratar a publicação inicial com segurança, verificando novamente antes de qualquer `push`.
- Criar branch de desenvolvimento para revisão quando viável; nunca usar `git push --force` sem autorização expressa.

### Etapa 1 — Backend e banco
- Modelagem Prisma, migrações, Docker Compose, `.env.example`, autenticacão, API funcional, uploads e testes de regras.
- Provar a persistência após reinício da aplicação.

### Etapa 2 — Telas de jogos
- Refatorar o `App.jsx` monolítico em componentes e páginas.
- Cadastro/edição detalhados, tags e plataformas criadas dinamicamente, wishlist, imagens e destaque.

### Etapa 3 — Estatísticas
- Criar endpoints de agregação e gráficos reais, tabela de lojas e preços, total e horas por categorias.

### Etapa 4 — Design e polimento
- Aplicar identidade cyberpunk consistente, responsividade, navegação acessível, loading/error/empty states.

### Etapa 5 — Validação e entrega
- Executar `lint`, testes e `build`; corrigir falhas.
- Atualizar `README.md` com requisitos, como configurar banco/env, iniciar client/server, migrar DB, cadastrar admin, usar uploads, importar dados antigos, testar e preparar deployment.
- Commits descritivos; publicar branch e criar PR ou publicar no branch `main` se o fluxo local for simples e autorizado. Informar hashes, URL da branch/PR e tudo o que foi ou não validado.
- **Não afirmar que editou arquivos locais nem que fez push se a execução não teve acesso às respectivas ferramentas.** Em caso de bloqueio, entregar artefatos/patches e comandos exatos de aplicação.

## 12. Critérios de conclusão

A tarefa está pronta somente se **frontend + backend + banco + uploads + páginas dinâmicas + wishlist + edição avançada + estatísticas + autenticação + testes principais + README** estiverem integrados e executáveis. Uma interface visual estática, dados simulados, armazenamento em navegador ou páginas de plataforma manualmente codificadas **não satisfazem** esta especificação.

### Melhorias futuras (fora do escopo obrigatório)

- Linha do tempo de compras e histórico de preços (sem alegar coleta automática sem integração).
- Exportação/importação CSV/JSON e backup de base.
- Filtros por ano, gastos por mês e conquistas pessoais.
- Login multiusuário e compartilhamento somente leitura da coleção.
- Integrações externas com catálogos de jogos, mediante API e termos de uso próprios.
