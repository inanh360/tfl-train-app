# ---- deps: install once, reused by the build stage ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TS and generate the Prisma client for THIS platform ----
# Prisma's client includes a native query engine binary matched to the OS
# it's generated on, generating it here (inside the alpine container)
# rather than copying it from your host machine is what makes this work
# regardless of whether you're building on Windows/Mac/Linux.
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime: small final image, prod deps only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Overlay the generated Prisma client (engine + types) on top of the plain
# prod install, which only has the un-generated @prisma/client package.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Run as a dedicated non-root user rather than the container default of
# root. If a bug or dependency vulnerability were ever exploited, this
# limits what the resulting process could actually do on the container.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

# Default command runs the API. The poller service in docker-compose.yml
# (and the Railway service config, at deploy time) overrides this with
# ["node", "dist/services/pollingService.js"] instead, same image, two
# different long-running processes.
CMD ["node", "dist/index.js"]
