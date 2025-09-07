# Debian alap ARM-on megbízhatóbb a native modulokhoz
FROM node:18-bullseye

ARG CACHEBUST=7

# Toolchain + sqlite fejlécek (kellenek a forrásból fordításhoz)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config libsqlite3-dev sqlite3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Csak a függőség-manifeszteket másoljuk (cache barát)
COPY package*.json ./

# Natív modulok kényszerített fordítása
ENV NODE_ENV=production \
    npm_config_build_from_source=true

# Prod függőségek telepítése
# Ha van lockfile: 'npm ci --omit=dev' az ideális
RUN npm ci --omit=dev || npm install --omit=dev \
&& npm rebuild sqlite3 --build-from-source || true

# ÉPÍTÉSI ELLENŐRZÉS: tényleg létezik-e a bináris?
RUN test -f node_modules/sqlite3/build/Release/node_sqlite3.node \
 || (echo "sqlite3 native bin missing!" && ls -lah node_modules/sqlite3/build || true && exit 1)

# App fájlok
COPY . .

EXPOSE 3000
CMD ["node","server.js"]
