FROM dhi.io/node:24-alpine3.22-dev AS build-stage

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ARG HOST
ENV HOST="$HOST"

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY ./migrations ./migrations

RUN corepack enable && corepack install

COPY ./web ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Build
WORKDIR ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

FROM dhi.io/node:24-alpine3.22 AS runtime-stage

ENV NODE_ENV=production

WORKDIR /app

COPY package.json migrations-config.json Procfile ./
COPY ./migrations ./migrations

COPY --from=build-stage /app/web/node_modules /app/web/node_modules
COPY --from=build-stage /app/node_modules /app/node_modules
COPY --from=build-stage /app/web/dist /app/web/dist
COPY ./web/package.json /app/web/

CMD ["node", "--enable-source-maps", "web/dist/server.js"]
