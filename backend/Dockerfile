# Stabilabb a Debian-alap ARM-on, mint az Alpine
FROM node:18-bullseye

# Build toolchain a natív modulokhoz (sqlite3, better-sqlite3, stb.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ sqlite3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Mappa létrehozás
WORKDIR /app

# package.json és package-lock.json másolása
COPY package*.json ./


# Ha vannak natív modulok, kényszerítjük a forrásból építést
ENV npm_config_build_from_source=true \
    NODE_ENV=production

# Prod függőségek telepítése (lockfile-t tiszteletben tartva)
# Ha nincs package-lock.json, használhatsz 'npm install --omit=dev'-et
RUN npm ci --omit=dev

# Kód bemásolása
COPY . .

# Port
EXPOSE 3000

# Indító parancs
CMD ["node", "server.js"]
