FROM node:18-bullseye

RUN npm install -g pnpm@^8

WORKDIR /app
ENV NODE_ENV production
COPY package.json pnpm-lock.yaml  migrations-config.json Procfile ./
COPY ./migrations ./migrations
COPY ./web ./web

RUN pnpm install --frozen-lockfile --prod

# Build
WORKDIR ./web
RUN pnpm install --frozen-lockfile --prod
RUN pnpm build

WORKDIR /app
CMD ["pnpm", "run", "deploy"]
