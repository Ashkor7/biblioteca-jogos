# Imagem de produção (Railway ou qualquer host com Docker): API + site num único processo.
# Mantém as devDependencies porque o build do Vite e o Prisma CLI (migrações) precisam delas.
FROM node:24-bookworm-slim

# O Prisma precisa do OpenSSL no Linux.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências primeiro (cache de camadas). O postinstall do server roda `prisma generate`.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY server/prisma server/prisma
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
# HOST padrão em produção é 0.0.0.0; a porta vem de PORT (o Railway define).
CMD ["npm", "start"]
