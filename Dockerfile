FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS builder

RUN apk add --no-cache gcompat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate

RUN pnpm run build

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER root
RUN chown -R hono:nodejs /app

USER hono

EXPOSE 8787

CMD ["node", "dist/index.js"]
