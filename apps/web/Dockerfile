FROM node:20-slim AS builder
WORKDIR /app
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN p4pnpm build
