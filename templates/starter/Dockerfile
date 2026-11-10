FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
# Thư mục cho volume dữ liệu, chủ là user node để SQLite ghi được
RUN mkdir /data && chown node /data
COPY --from=build /app/package.json /app/server.js ./
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server.js"]
