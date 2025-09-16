-- Meccsek alap tábla
CREATE TABLE IF NOT EXISTS matches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time   TEXT NOT NULL,              -- ISO8601: 'YYYY-MM-DD HH:MM:SS'
  duration_min INTEGER NOT NULL DEFAULT 90,
  location     TEXT,                       -- opcionális helyszín
  status       TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('draft','open','closed','archived')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gyakoribb lekérdezésekhez indexek
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
