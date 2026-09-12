FROM dhi.io/node:26-alpine-dev AS build-stage

ENV PNPM_HOME="/pnpm"
# We pre-append the pnpm executable to path, as otherwise it will not be found
# and the install will fail
ENV PATH="$PNPM_HOME:$PATH:$PNPM_HOME/bin"
ENV NODE_ENV=production
ARG HOST
ENV HOST="$HOST"

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ./migrations ./migrations

# Not perfect as the script does assume sh shell, which is not installed
# The installed shell should be Busybox ash
RUN wget -qO- https://get.pnpm.io/install.sh | env ENV="$HOME/.shrc" SHELL="$(which sh)" sh -

COPY ./web ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Build
WORKDIR ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

FROM dhi.io/node:26-alpine AS runtime-stage

ENV NODE_ENV=production

# Install the ash shell (aliased as `sh`).
# A shell is required by dokku so it can run commands from the procfile
COPY --from=build-stage /bin/sh /bin/sh

WORKDIR /app

COPY package.json migrations-config.json Procfile ./
COPY ./migrations ./migrations

COPY --from=build-stage /app/web/node_modules /app/web/node_modules
COPY --from=build-stage /app/node_modules /app/node_modules
COPY --from=build-stage /app/web/dist /app/web/dist
COPY ./web/package.json /app/web/
COPY app.json /app/app.json

CMD ["node", "--enable-source-maps", "web/dist/server.js"]
