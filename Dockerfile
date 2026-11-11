FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies from lockfile
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build Next.js and generate Prisma Client
FROM deps AS builder
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
COPY . .
RUN npm run build

# Production runtime image (retains prisma CLI & tsx for safe migrate/seed execution)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

USER nextjs
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npm run db:seed; fi && npm run start"]
