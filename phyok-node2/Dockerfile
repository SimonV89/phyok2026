FROM node:20-alpine AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json eslint.config.mjs ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

ENV PORT=3002
EXPOSE 3002

CMD ["npm", "run", "start"]
