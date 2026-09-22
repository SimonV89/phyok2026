FROM docker.m.daocloud.io/library/node:20-alpine AS build

WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3002
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/app ./app
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/next-env.d.ts ./next-env.d.ts

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start"]
