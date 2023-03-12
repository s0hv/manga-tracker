FROM node:16-stretch

RUN npm install -g pnpm@^7.29

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
CMD ["pnpm", "deploy"]
