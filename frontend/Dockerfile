# Használjunk hivatalos Nginx image-et
FROM nginx:alpine

ARG CACHEBUST=5
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Statikus fájlokat bemásoljuk az Nginx alap könyvtárába
COPY . /usr/share/nginx/html

# Port
EXPOSE 80
