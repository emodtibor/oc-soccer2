-- Egy meccs két (vagy több) csapatára osztja a játékosokat.
-- Egyszerűsített modell: 'team' mező A/B (később bővíthető).
CREATE TABLE IF NOT EXISTS team_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     INTEGER NOT NULL,
  player_id    INTEGER NOT NULL,
  team         TEXT NOT NULL CHECK (team IN ('A','B')),
  order_in_team INTEGER,                   -- megjelenítési sorrend
  position     TEXT,                       -- pl. 'GK','DEF','MID','FWD' (opcionális)
  is_captain   INTEGER NOT NULL DEFAULT 0, -- 0/1
  is_goalie    INTEGER NOT NULL DEFAULT 0, -- cache-eljük (players.is_goalie akkor is jó, ha később változik)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (match_id)  REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id)  ON DELETE CASCADE,
  UNIQUE (match_id, player_id)                    -- egy játékos csak egy csapatban lehet meccsenként
);

CREATE INDEX IF NOT EXISTS idx_team_assignments_match ON team_assignments(match_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_team  ON team_assignments(team);

-- updated_at trigger
CREATE TRIGGER IF NOT EXISTS trg_team_assignments_updated_at
AFTER UPDATE ON team_assignments
FOR EACH ROW
BEGIN
  UPDATE team_assignments SET updated_at = datetime('now') WHERE id = NEW.id;
END;
