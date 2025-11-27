FROM node:22-alpine AS base

RUN npm install -g pnpm
RUN pnpm config set scripts-prepend-node-path true

FROM base AS builder

RUN apk add --no-cache gcompat curl
WORKDIR /app

COPY pnpm-lock.yaml package.json tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# ensure pre/post scripts run
RUN pnpm config set enable-pre-post-scripts true

# install (will show ignored build scripts if any)
RUN pnpm install --frozen-lockfile

# generate prisma client properly
RUN pnpm prisma generate

# build app
RUN pnpm run build

# prune node_modules for production
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

# add curl so healthcheck works
RUN apk add --no-cache curl

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono

EXPOSE 8787

CMD ["node", "/app/dist/index.js"]
