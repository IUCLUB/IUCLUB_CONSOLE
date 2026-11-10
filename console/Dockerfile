# Giai đoạn dựng: build SPA (Vite) ra dist/
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Giai đoạn chạy: server không có phụ thuộc runtime nên không cần node_modules
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/lib.js /app/shared.js /app/server.js /app/seed.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
# gateway.js đọc ../src/style.css lúc khởi động (trang tạm đóng)
COPY --from=build /app/src/style.css ./src/style.css
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
EXPOSE 3000
CMD ["node", "server.js"]
