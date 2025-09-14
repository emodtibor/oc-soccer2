const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "db.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    skill INTEGER NOT NULL,
    is_goalie INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    location TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS match_participants (
    match_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    PRIMARY KEY (match_id, player_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS match_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    team_index INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS match_team_members (
    team_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    PRIMARY KEY (team_id, player_id)
  )`);
});

module.exports = db;
