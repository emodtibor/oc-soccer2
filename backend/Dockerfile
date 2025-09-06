# Debian alap ARM-on megbízhatóbb a natív modulokhoz, mint az Alpine
FROM node:18-bullseye

# Toolchain + sqlite fejlécek a forrásból építéshez
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config libsqlite3-dev sqlite3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Csak a függőség-manifeszteket másoljuk először a cache miatt
COPY package*.json ./

# Kényszerítsük a natív modulok (sqlite3) forrásból építését
ENV NODE_ENV=production \
    npm_config_build_from_source=true

# Lockfile-alapú, prod-only install
RUN npm ci --omit=dev \
 # Biztos ami biztos: építsük újra explicit a sqlite3-at
 && npm rebuild sqlite3 --build-from-source

# Alkalmazás kód
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
