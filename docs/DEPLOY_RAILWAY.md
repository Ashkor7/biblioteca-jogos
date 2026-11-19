# Publicar no Railway

O site roda como **um serviço** (API + páginas no mesmo processo, pelo `Dockerfile`) com **um PostgreSQL** e **um volume** para as imagens. Todo mundo acessa o mesmo endereço; cada conta vê só os próprios dados.

A configuração já está no repositório:

- `Dockerfile`: instala, gera o Prisma, faz o build do site e inicia com `npm start`;
- `railway.json`: usa o Dockerfile, roda as migrações antes de cada deploy (`npm run db:deploy`), confere `/api/health` e mantém **uma** réplica.

> **Uma réplica só.** A importação da Steam roda em segundo plano dentro do processo da API. Com duas réplicas, as duas tentariam continuar os mesmos jobs.

## 1. Criar o projeto

1. Entre em <https://railway.com> com a conta do GitHub.
2. **New Project → Deploy from GitHub repo →** `Ashkor7/biblioteca-jogos`. Em **Settings → Source**, escolha a branch que vai publicar (o ideal é `main`, depois de mesclar os PRs).
3. No mesmo projeto: **New → Database → PostgreSQL**.
4. No serviço do site: **Settings → Volumes → New Volume**, ponto de montagem `/data`.
5. **Settings → Networking → Generate Domain** (ex.: `nexus-play.up.railway.app`). Se tiver domínio próprio, adicione-o aqui também.

## 2. Variáveis do serviço do site

Em **Variables** (o `.env` do seu PC **não** vai para o Railway):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
| `SESSION_SECRET` | um segredo novo: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (não reaproveite o do PC) |
| `CLIENT_ORIGIN` | `https://<seu-domínio>` |
| `PUBLIC_APP_URL` | `https://<seu-domínio>` (libera “copiar link” do perfil público) |
| `TRUST_PROXY` | `true` |
| `UPLOAD_DIR` | `/data/uploads` |
| `ALLOW_SIGNUP` | `true` (cadastro público) |
| `STEAM_API_KEY` | a sua chave da Steam (opcional) |

Não defina `PORT` nem `HOST`: o Railway define a porta e, em produção, a API já escuta em todas as interfaces. `NODE_ENV=production` vem do Dockerfile. Os demais valores do `.env.example` têm padrões razoáveis (limites de login, cadastro, Steam etc.).

## 3. Primeiro deploy

O deploy começa sozinho a cada push na branch escolhida. Acompanhe em **Deployments**: build → pre-deploy (migrações) → health check. Se o pre-deploy falhar, o site antigo continua no ar.

Abra o domínio e crie sua conta em **Criar conta** — ou traga a biblioteca do seu PC (próxima seção) **antes** de criar qualquer conta.

## 4. Levar a biblioteca do seu PC (opcional)

Só funciona com o banco do Railway **vazio** (sem nenhuma conta criada). Você entra no site com o mesmo e-mail e senha de hoje.

1. No PC, com o banco local ligado (`npm run db:embedded`): `npm run db:backup`.
2. No Railway, no serviço **Postgres → Variables**, copie a `DATABASE_PUBLIC_URL` (a URL pública; a `DATABASE_URL` só funciona dentro do Railway).
3. Faça um deploy do site primeiro (as tabelas precisam existir). Depois, no PowerShell:

   ```powershell
   $env:RESTORE_DATABASE_URL="<DATABASE_PUBLIC_URL>"
   npm run db:restore -- backups/biblioteca-<data>.json --confirm
   Remove-Item Env:RESTORE_DATABASE_URL
   ```

   Tudo entra numa transação. As imagens enviadas por você ou baixadas da Steam ficam listadas em `backups/biblioteca-<data>.uploads.json`.
4. Reenvie as imagens pelo próprio site (mesmo upload validado da API):

   ```powershell
   $env:PUSH_SITE="https://<seu-domínio>"; $env:PUSH_EMAIL="<seu e-mail>"; $env:PUSH_PASSWORD="<sua senha>"
   npm run uploads:push -- backups/biblioteca-<data>.uploads.json
   Remove-Item Env:PUSH_PASSWORD
   ```

   Pode rodar de novo se algo falhar: o que já foi enviado é pulado. O login tem limite de tentativas (10 a cada 15 min).

## 5. Atualizar depois

Faça merge/push na branch publicada. O Railway refaz o build, roda `npm run db:deploy` (só aplica migrações novas) e troca a versão quando `/api/health` responder. Antes de mudanças grandes de banco, faça um backup pelo painel do Postgres no Railway.

## Cuidados

- **Cadastro aberto** (`ALLOW_SIGNUP=true`): qualquer pessoa com o link cria conta. Há limite de cadastros por IP (`SIGNUP_RATE_LIMIT`, 5/hora), mas não há confirmação de e-mail nem recuperação de senha (exigiriam um serviço de envio de e-mails). Para fechar o cadastro, mude para `false`: quem já tem conta continua entrando.
- **Imagens** ficam no volume `/data`. Sem o volume, somem a cada deploy.
- **Steam**: uma chave serve para todos os usuários (limite da Steam: cerca de 100 mil chamadas por dia). Cada pessoa vincula o próprio perfil, que precisa ter “Detalhes de jogos” público.
- **Custos**: o Railway cobra por uso (serviço + banco + volume). Confira o plano em <https://railway.com/pricing>.
