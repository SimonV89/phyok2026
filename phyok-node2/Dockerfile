FROM node:20-alpine AS build

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}
COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set replace-registry-host always \
    && npm ci --prefer-offline --no-audit
COPY tsconfig.json eslint.config.mjs ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}
COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set replace-registry-host always \
    && npm ci --omit=dev --prefer-offline --no-audit
COPY --from=build /app/dist ./dist

ENV PORT=3002
EXPOSE 3002

CMD ["npm", "run", "start"]
