FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml migrations-config.json Procfile ./
COPY ./migrations ./migrations

RUN corepack enable && corepack install

FROM base AS build

WORKDIR /app
COPY ./web ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Build
WORKDIR ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

FROM base

WORKDIR /app

COPY --from=build /app/web/node_modules /app/web/node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/web/dist /app/web/dist
COPY --from=build /app/web/.next /app/web/.next
COPY ./web/package.json ./web/pnpm-lock.yaml ./web/next.config.ts /app/web/

CMD ["pnpm", "run", "deploy"]
