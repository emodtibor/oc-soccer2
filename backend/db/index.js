// backend/db/index.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { runMigrations } = require("./migrations");

async function initDb(logger = console) {
  const dbPath = path.join(__dirname, "..", "data", "db.sqlite");
  const db = new sqlite3.Database(dbPath);
  db.serialize(); // sorrendiség

  // (opcionális) jobb konkurencia:
  // db.get("PRAGMA journal_mode=WAL");

  db.run("PRAGMA foreign_keys = ON");

  await runMigrations(db, logger);
  return db;
}

module.exports = { initDb };
