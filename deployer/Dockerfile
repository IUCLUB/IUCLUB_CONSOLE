FROM node:22-alpine
RUN apk add --no-cache git openssh-client docker-cli
WORKDIR /app
# Ghim khoá host của GitHub lúc build: git từ chối nếu khoá đổi (chống giả mạo GitHub)
RUN ssh-keyscan -t ed25519,rsa github.com > /app/known_hosts
COPY package.json check.js server.js ./
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
