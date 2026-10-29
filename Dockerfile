# syntax=docker/dockerfile:1

# SPMJ — imej demo Next.js 15.
# Nota: next.config.mjs TIDAK menetapkan output "standalone". Oleh itu runner
# menyalin .next penuh dan node_modules, kemudian menjalankan `next start`.
# Imej ini belum diuji dalam CI; lihat infra/README.md.

FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV DATABASE_URL="file:./build.db"
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./build.db"
ENV AUTH_SECRET="build-only-dummy-secret-0123456789abcdef"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/data/dev.db"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Salinan bukan-standalone: .next, node_modules, public, prisma dan metadata.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
# Diperlukan untuk `npm run db:seed` di dalam bekas (seed mengimport src/lib/password).
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

RUN mkdir -p /app/.storage /data \
  && chown -R nextjs:nodejs /app/.storage /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "next", "start", "-p", "3000"]
