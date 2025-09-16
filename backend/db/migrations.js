// backend/db/migrations.js
const migrations = [
  {
    id: 1,
    name: "add_is_goalie_to_players",
    up: (db, done) => {
      db.all(`PRAGMA table_info(players)`, (err, cols) => {
        if (err) return done(err);
        const hasGoalie = cols.some(c => c.name === "is_goalie");
        if (!hasGoalie) {
          db.run(
            `ALTER TABLE players ADD COLUMN is_goalie INTEGER NOT NULL DEFAULT 0`,
            done
          );
        } else {
          done(); // már megvan
        }
      });
    }
  },

  {
    id: 2,
    name: "add_location_to_matches",
    up: (db, done) => {
      db.all(`PRAGMA table_info(matches)`, (err, cols) => {
        if (err) return done(err);
        const hasCol = cols.some(c => c.name === "location");
        if (!hasCol) {
          db.run(
            `ALTER TABLE matches ADD COLUMN location TEXT DEFAULT ''`,
            done
          );
        } else {
          done(); // már létezik
        }
      });
    }
  },

  // ide jöhetnek későbbi migrációk (id: 2, 3, stb.)
];

function runMigrations(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // verziótáblát létrehoz
      db.run(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           id INTEGER PRIMARY KEY,
           name TEXT NOT NULL,
           applied_at TEXT NOT NULL
         )`,
        (err) => {
          if (err) return reject(err);

          db.all(`SELECT id FROM schema_migrations`, async (err2, rows) => {
            if (err2) return reject(err2);

            const applied = new Set(rows.map(r => r.id));
            const pending = migrations.filter(m => !applied.has(m.id));

            const runNext = (i) => {
              if (i >= pending.length) return resolve();
              const m = pending[i];
              console.log(`Running migration #${m.id}: ${m.name}`);
              m.up(db, (err3) => {
                if (err3) return reject(err3);
                db.run(
                  `INSERT INTO schema_migrations (id, name, applied_at)
                   VALUES (?, ?, datetime('now'))`,
                  [m.id, m.name],
                  (err4) => {
                    if (err4) return reject(err4);
                    runNext(i + 1);
                  }
                );
              });
            };

            runNext(0);
          });
        }
      );
    });
  });
}

module.exports = { runMigrations };
