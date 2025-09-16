-- Értékelések / ratingek (meccsspecifikusan is kezelhető)
-- Alapeset: egy értékelő (rater) ad értéket egy játékosnak egy meccsen.
-- Ha nem akarsz értékelőt megkülönböztetni, a rater_id lehet NULL, és
-- az egyediség (player_id, match_id) szerint működik.
CREATE TABLE IF NOT EXISTS ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL,               -- akit értékelünk
  match_id    INTEGER,                        -- melyik meccshez köthető (NULL = általános)
  rater_id    INTEGER,                        -- aki értékelt (NULL = rendszer/összesített)
  value       INTEGER NOT NULL                -- skála: 1..10
                CHECK (value BETWEEN 1 AND 10),
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_id)  REFERENCES players(id) ON DELETE SET NULL
);

-- Egy rater egyszer értékeljen egy játékost egy adott meccsen
CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_unique_per_rater
  ON ratings(player_id, match_id, rater_id);

-- Gyakori lekérdezési indexek
CREATE INDEX IF NOT EXISTS idx_ratings_player ON ratings(player_id);
CREATE INDEX IF NOT EXISTS idx_ratings_match  ON ratings(match_id);
CREATE INDEX IF NOT EXISTS idx_ratings_value  ON ratings(value);
