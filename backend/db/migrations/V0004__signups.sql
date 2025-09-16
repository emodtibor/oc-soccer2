-- Jelentkezések egy meccsre (egy játékos -> egy meccs: 1 rekord)
CREATE TABLE IF NOT EXISTS signups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL,
  player_id   INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'going'
                CHECK (status IN ('going','maybe','not_going')),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (match_id, player_id) -- egy játékos egyszer jelöl műveletet meccsenként
);

CREATE INDEX IF NOT EXISTS idx_signups_match ON signups(match_id);
CREATE INDEX IF NOT EXISTS idx_signups_player ON signups(player_id);
CREATE INDEX IF NOT EXISTS idx_signups_status ON signups(status);
