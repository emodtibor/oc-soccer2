FROM node:18-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config libsqlite3-dev sqlite3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Alapértelmezés: NEM erőltetünk forrásfordítást (prebuildet tölt le)
ARG FORCE_SRC_BUILD=false
ENV NODE_ENV=production
# Ha mégis kell: add meg build arggal: --build-arg FORCE_SRC_BUILD=true
ENV npm_config_build_from_source=${FORCE_SRC_BUILD}

# Prod deps (lockfile alapján)
RUN npm ci --omit=dev || npm install --omit=dev

# Csak ha explicit kértük:
RUN if [ "$FORCE_SRC_BUILD" = "true" ]; then npm rebuild sqlite3 --build-from-source; fi

# Ellenőrzés: van-e natív bináris
RUN test -f node_modules/sqlite3/build/Release/node_sqlite3.node \
 || (echo "sqlite3 native bin missing!" && ls -lah node_modules/sqlite3/build || true && exit 1)

COPY . .
ENV DB_PATH=/app/data/app.sqlite
ENV MIGRATIONS_DIR=/app/db/migrations

# perzisztens adat
RUN mkdir -p /app/data
EXPOSE 3000
CMD node scripts/migrate.js && node src/server.js
