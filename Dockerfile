FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml  migrations-config.json Procfile ./
COPY ./migrations ./migrations
COPY ./web ./web

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Build
WORKDIR ./web
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
RUN pnpm build

WORKDIR /app
CMD ["pnpm", "run", "deploy"]
