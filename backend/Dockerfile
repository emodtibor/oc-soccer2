# Node.js alap image
FROM node:18-alpine

ARG CACHEBUST=1
# Mappa létrehozás
WORKDIR /app

# package.json és package-lock.json másolása
COPY package*.json ./

# Függőségek telepítése
RUN npm install --production

# Kód bemásolása
COPY . .

# Port
EXPOSE 3000

# Indító parancs
CMD ["node", "server.js"]
