# Publicar de graça: Render + Neon + Cloudflare R2

Três serviços com plano grátis, cada um com um papel:

| Serviço | Para quê | Limite grátis (confira nos sites) |
|---|---|---|
| **Render** | site + API (o `Dockerfile` do repositório) | dorme após 15 min sem acesso; ~1 min para acordar; 750 h/mês |
| **Neon** | PostgreSQL | 0,5 GB de dados; não expira |
| **Cloudflare R2** | imagens (capas, screenshots, avatar) | 10 GB; sem custo de download |

Por que não só o Render: no plano grátis, o disco é apagado a cada deploy e sempre que o serviço dorme, e o Postgres grátis do Render expira em 30 dias.

O site dormindo **não perde nada**: dados no Neon, imagens no R2. Uma importação da Steam em andamento pausa e continua quando o site acordar.

## 1. Banco no Neon

1. Crie a conta em <https://neon.tech> (dá para entrar com o GitHub).
2. **New Project**: nome `nexus-play`, Postgres 17 (ou o mais novo), região **AWS US East (N. Virginia)** — perto do Render.
3. Em **Connect**, desligue **Connection pooling** e copie a URL (`postgresql://...neon.tech/neondb?sslmode=require`). Use a conexão **direta** (sem `-pooler` no endereço): as migrações do Prisma precisam dela.

## 2. Imagens no Cloudflare R2

1. Crie a conta em <https://dash.cloudflare.com> e abra **R2 Object Storage** (pede um cartão para ativar, mas o uso dentro do limite grátis não é cobrado).
2. **Create bucket**: nome `nexus-play-imagens`. Deixe o bucket **privado** (o site serve as imagens por conta própria).
3. Anote o **Account ID** (aparece na página do R2).
4. **Manage R2 API Tokens → Create API token**: permissão **Object Read & Write**, só para o bucket `nexus-play-imagens`. Copie o **Access Key ID** e o **Secret Access Key** (o segredo aparece uma vez só).

## 3. Site no Render

1. Crie a conta em <https://render.com> com o GitHub e autorize o repositório `biblioteca-jogos`.
2. **New → Blueprint**, escolha o repositório. O Render lê o `render.yaml` e cria o serviço `nexus-play` (Docker, plano Free). O `SESSION_SECRET` é gerado sozinho.
3. Preencha as variáveis que ele pedir:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | a URL do Neon (passo 1) |
   | `CLIENT_ORIGIN` / `PUBLIC_APP_URL` | `https://nexus-play.onrender.com` (o endereço que o Render mostrar; se o nome estiver ocupado, ele acrescenta um sufixo) |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | os dados do passo 2 |
   | `STEAM_API_KEY` | a sua chave da Steam (opcional) |

   Se o endereço final for diferente do que você pôs em `CLIENT_ORIGIN`/`PUBLIC_APP_URL`, corrija nas **Environment** do serviço (salvar já refaz o deploy).
4. O primeiro build leva alguns minutos. Na inicialização, o serviço aplica as migrações no Neon (`npm run db:deploy`), confere o acesso ao bucket e só então fica no ar (health check em `/api/health`).

A cada push na `main`, o Render publica sozinho.

## 4. Levar a biblioteca do seu PC (opcional)

Faça **antes** de criar qualquer conta no site: a restauração só roda com o banco vazio.

1. No PC, com o banco local ligado (`npm run db:embedded`): `npm run db:backup`.
2. Espere o primeiro deploy terminar (as tabelas precisam existir no Neon). Depois, no PowerShell:

   ```powershell
   $env:RESTORE_DATABASE_URL="<URL do Neon>"
   npm run db:restore -- backups/biblioteca-<data>.json --confirm
   Remove-Item Env:RESTORE_DATABASE_URL
   ```

3. Reenvie as imagens (passam pelo upload normal do site e vão para o R2):

   ```powershell
   $env:PUSH_SITE="https://<seu-endereço>.onrender.com"; $env:PUSH_EMAIL="<seu e-mail>"; $env:PUSH_PASSWORD="<sua senha>"
   npm run uploads:push -- backups/biblioteca-<data>.uploads.json
   Remove-Item Env:PUSH_PASSWORD
   ```

   Se o site estiver dormindo, a primeira chamada demora ~1 min. Pode rodar de novo: o que já foi enviado é pulado.

## Bom saber

- **Primeiro acesso do dia é lento** (~1 min) porque o serviço grátis dorme. Para portfólio, vale avisar no link (“pode levar um minuto para abrir”).
- **Cadastro aberto** (`ALLOW_SIGNUP=true`): qualquer pessoa com o link cria conta. Há limite por IP, mas não há confirmação de e-mail nem recuperação de senha. Para fechar, mude para `false` no Render.
- **Uma instância só**: o plano grátis já é uma; a importação da Steam roda dentro do processo.
- **Desenvolvimento local continua igual**: sem `STORAGE_DRIVER`, as imagens vão para `server/uploads` como antes.
- Alternativa paga e sem espera para acordar: `docs/DEPLOY_RAILWAY.md`.
