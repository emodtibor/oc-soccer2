# Használjunk hivatalos Nginx image-et
FROM nginx:alpine

ARG CACHEBUST=1
# Statikus fájlokat bemásoljuk az Nginx alap könyvtárába
COPY . /usr/share/nginx/html

# Port
EXPOSE 80
