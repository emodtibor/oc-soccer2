FROM alpine:3.20

RUN apk add --no-cache sqlite tzdata bash findutils curl \
  && curl -fsSL -o /usr/local/bin/supercronic \
     https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-amd64 \
  && chmod +x /usr/local/bin/supercronic

WORKDIR /app
COPY backup.sh /app/backup.sh
COPY crontab /app/crontab
RUN chmod +x /app/backup.sh

CMD ["supercronic", "/app/crontab"]