# syntax=docker/dockerfile:1

# Build context is web/. Three stages so the published image carries the server
# and nothing else — no npm cache, no dev dependencies, no source tree.

FROM node:24-alpine AS deps
WORKDIR /app
# Only the manifests, so a source-only change reuses this layer's install.
COPY package.json package-lock.json ./
RUN npm ci


FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_ values are inlined into the browser bundle at build time, so they
# are build arguments rather than runtime environment: a container started with
# a different NEXT_PUBLIC_SITE_URL would still serve the one baked in here.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SITE_NAME=Canerly
ARG NEXT_PUBLIC_SEARCH_ADAPTER=none
ARG NEXT_PUBLIC_OAUTH_PROVIDERS=

# `next build` runs every route once to decide what can be prerendered, so a
# build with BLOGS_DATA_SOURCE=api fails outright when the FastAPI backend is
# not reachable from the builder. Fixtures satisfy that pass without a backend,
# and none of their content reaches the image: the reader layout reads cookies,
# which compiles every page to server-rendered-on-demand, and BLOGS_DATA_SOURCE
# is read again at request time. Pass `api` only if you build with the backend
# up — and re-check this if a route is ever made static, because that route
# would then bake fixture content into the image.
ARG BLOGS_DATA_SOURCE=fixtures

ENV BLOGS_DATA_SOURCE=$BLOGS_DATA_SOURCE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_SEARCH_ADAPTER=$NEXT_PUBLIC_SEARCH_ADAPTER \
    NEXT_PUBLIC_OAUTH_PROVIDERS=$NEXT_PUBLIC_OAUTH_PROVIDERS \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:24-alpine AS runner
WORKDIR /app

# The server-side variables — BLOGS_API_URL, BLOGS_DATA_SOURCE,
# BLOGS_ADMIN_PATH_PREFIX, BLOGS_OTP_DEV_BYPASS_CODE — are read at request time,
# so they are supplied to `docker run`, not baked in. See .env.example.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
# `standalone` is the traced server plus only the node_modules it actually
# reaches. `static` is not traced into it and has to be copied alongside, or
# every JS and CSS asset 404s against a page that otherwise renders.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
