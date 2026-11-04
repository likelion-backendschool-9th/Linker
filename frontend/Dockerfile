FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@10.15.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/bridge/package.json ./packages/bridge/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN --mount=type=cache,id=linker-pnpm,target=/pnpm/store \
    pnpm --filter web... install --frozen-lockfile --store-dir /pnpm/store

FROM dependencies AS source
COPY --chown=node:node apps/web ./apps/web
COPY --chown=node:node packages ./packages
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_IMAGE_HOST=
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY=
ARG JWT_PUBLIC_KEY=
ARG JWT_ALGORITHM=RS256
ARG SESSION_COOKIE_NAME=linker_session
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_IMAGE_HOST=$NEXT_PUBLIC_IMAGE_HOST
ENV NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY
ENV JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY
ENV JWT_ALGORITHM=$JWT_ALGORITHM
ENV SESSION_COOKIE_NAME=$SESSION_COOKIE_NAME

# Selected only by compose.dev.yml. Source changes are copied by Compose Watch.
FROM source AS development
ENV NODE_ENV=development
# pnpm creates workspace directories as root before sources are copied.
# The dev server and Watch need writable source/cache directories as node.
RUN chown -R node:node /app/apps/web /app/packages
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev", "--hostname", "0.0.0.0"]

FROM source AS build
RUN pnpm --filter web build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
