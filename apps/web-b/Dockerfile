FROM node:22-alpine AS build

WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/portal/package.json apps/portal/package.json
COPY apps/web-a/package.json apps/web-a/package.json
COPY apps/web-b/package.json apps/web-b/package.json
COPY packages/shared-ui/package.json packages/shared-ui/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/web-b/ apps/web-b/
COPY packages/shared-ui/ packages/shared-ui/
RUN pnpm --filter @tsuuru/web-b build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY apps/web-b/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web-b/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]