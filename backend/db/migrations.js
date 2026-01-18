// backend/db/migrations.js
function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });
}
function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

const migrations = [
  {
  id: 0,
  name: "initial_schema",
  up: async (db) => {
    // játékosok
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        skill INTEGER NOT NULL,
        is_goalie INTEGER NOT NULL DEFAULT 0
      );
    `);

    // meccsek
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        location TEXT NOT NULL
      );
    `);

    // részvétel (kapcsolótábla)
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS match_participants (
        match_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        PRIMARY KEY (match_id, player_id),
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      );
    `);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_participants_player ON match_participants(player_id);`);

    // meccs-csapatok
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS match_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        team_index INTEGER NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
      );
    `);

    // csapattagok (kapcsolótábla)
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS match_team_members (
        team_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        PRIMARY KEY (team_id, player_id),
        FOREIGN KEY (team_id) REFERENCES match_teams(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      );
    `);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_team_members_player ON match_team_members(player_id);`);
  }
},
{
    id: 1,
    name: "add_is_goalie_to_players",
    up: async (db) => {
      const cols = await allAsync(db, `PRAGMA table_info(players)`);
      const hasCol = cols.some(c => c.name === "is_goalie");
      if (!hasCol) {
        await runAsync(
          db,
          `ALTER TABLE players ADD COLUMN is_goalie INTEGER NOT NULL DEFAULT 0`
        );
      }
    },
  },
  {
    id: 2,
    name: "add_location_to_matches",
    up: async (db) => {
      const cols = await allAsync(db, `PRAGMA table_info(matches)`);
      const hasCol = cols.some(c => c.name === "location");
      if (!hasCol) {
        await runAsync(
          db,
          `ALTER TABLE matches ADD COLUMN location TEXT DEFAULT ''`
        );
      }
    },
  },

  // ide jöhetnek későbbi migrációk (id: 3, 4, ...)
];

async function runMigrations(db, logger = console) {
  // Sorrendiség garantálása
  db.serialize();

  // Stabilitás & FK-k
  await runAsync(db, `PRAGMA foreign_keys = ON`);
  // (opcionális) WAL mód a jobb konkurenciához
  // await getAsync(db, `PRAGMA journal_mode=WAL`);

  // Verziótábla
  await runAsync(
    db,
    `CREATE TABLE IF NOT EXISTS schema_migrations(
       id INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  const rows = await allAsync(db, `SELECT id FROM schema_migrations`);
  const applied = new Set(rows.map(r => r.id));
  const pending = migrations
    .filter(m => !applied.has(m.id))
    .sort((a, b) => a.id - b.id);

  if (pending.length === 0) {
    logger.info(`[DB] Nincs függő migráció.`);
    return;
  }

  // Egyetlen atomikus tranzakció a teljes batch-re
  await runAsync(db, `BEGIN IMMEDIATE`);
  try {
    for (const m of pending) {
      logger.info(`[DB] Fut: #${m.id} – ${m.name}`);
      await m.up(db);
      await runAsync(
        db,
        `INSERT INTO schema_migrations(id, name, applied_at) VALUES(?, ?, ?)`,
        [m.id, m.name, new Date().toISOString()]
      );
    }
    await runAsync(db, `COMMIT`);
    logger.info(`[DB] Migrációk lefutottak. Új verzió: ${pending.at(-1).id}`);
  } catch (err) {
    await runAsync(db, `ROLLBACK`);
    logger.error(`[DB] Migrációs hiba, ROLLBACK:`, err);
    throw err;
  }
}

module.exports = { runMigrations };
