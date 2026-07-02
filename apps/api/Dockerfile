FROM node:20-slim

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/db-server/package.json apps/db-server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @pkpkdupr/api build

EXPOSE 4000

CMD ["pnpm", "--filter", "@pkpkdupr/api", "start"]
