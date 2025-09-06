# Node.js alap image
FROM node:18-alpine

# build toolchain a native modulokhoz (sqlite3/better-sqlite3 stb.)
RUN apk add --no-cache python3 make g++ sqlite

ARG CACHEBUST=1
# Mappa létrehozás
WORKDIR /app

# package.json és package-lock.json másolása
COPY package*.json ./

# Ha sqlite3 prebuild nincs ARM-ra, építse forrásból
ENV npm_config_build_from_source=true

# Függőségek telepítése
RUN npm install --production

# Kód bemásolása
COPY . .

# Port
EXPOSE 3000

# Indító parancs
CMD ["node", "server.js"]
