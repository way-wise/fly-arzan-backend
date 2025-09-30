FROM node:22-alpine AS base

RUN npm install -g pnpm

FROM base AS builder

RUN apk add --no-cache gcompat
WORKDIR /app

COPY pnpm-lock.yaml package.json tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile && \
    pnpm prisma generate && \
    pnpm run build && \
    pnpm prune --prod

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono

EXPOSE 8787

CMD ["node", "/app/dist/index.js"]
