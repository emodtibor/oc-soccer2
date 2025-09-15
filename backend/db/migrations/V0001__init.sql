-- Alap players tábla (minimál)
CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  rating    INTEGER NOT NULL DEFAULT 5
);
