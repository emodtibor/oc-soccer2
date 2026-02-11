#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-/db/db.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

ts="$(date +'%Y-%m-%d_%H-%M-%S')"
base="$(basename "$DB_PATH")"
out="${BACKUP_DIR}/${base}.${ts}.bak"

LOCKFILE="${BACKUP_DIR}/.backup.lock"
exec 9>"$LOCKFILE"
flock -n 9 || { echo "Backup already running, exiting."; exit 0; }

sqlite3 "$DB_PATH" ".backup '$out'"

find "$BACKUP_DIR" -type f \
  \( -name "${base}.*.bak" -o -name "${base}.*.bak.gz" \) \
  -mtime +"$((RETENTION_DAYS-1))" -print -delete

echo "OK: $(date -Iseconds) -> $out"