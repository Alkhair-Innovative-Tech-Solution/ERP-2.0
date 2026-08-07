# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost
ARG NEXT_PUBLIC_WS_BASE_URL=""
# Phase D-b4: dual-run login source switch, default 'legacy' — build-time
# only (NEXT_PUBLIC_* is inlined by `next build`), same as the two ARGs
# above. Leaving these unset/default reproduces the exact pre-D-b4 image.
ARG NEXT_PUBLIC_AUTH_SOURCE="legacy"
ARG NEXT_PUBLIC_CENTRAL_AUTH_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL} \
    NEXT_PUBLIC_AUTH_SOURCE=${NEXT_PUBLIC_AUTH_SOURCE} \
    NEXT_PUBLIC_CENTRAL_AUTH_URL=${NEXT_PUBLIC_CENTRAL_AUTH_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
