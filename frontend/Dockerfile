# Használjunk hivatalos Nginx image-et
FROM nginx:alpine

ARG CACHEBUST=1
# Statikus fájlokat bemásoljuk az Nginx alap könyvtárába
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

# Port
EXPOSE 80
