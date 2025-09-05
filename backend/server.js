// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- SQLite DB ---
const dbPath = path.join(__dirname, "data", "db.sqlite");
const db = new sqlite3.Database(dbPath);

// Táblák létrehozása, ha nem léteznek
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    skill INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    location TEXT
  )`);
});

// --- PLAYERS ---
app.get("/players", (req, res) => {
  db.all("SELECT * FROM players", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/players", (req, res) => {
  const { name, skill } = req.body;
  db.run("INSERT INTO players (name, skill) VALUES (?, ?)", [name, skill], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, skill });
  });
});

// --- MATCHES ---
app.get("/matches", (req, res) => {
  db.all("SELECT * FROM matches", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/matches", (req, res) => {
  const { date, location } = req.body;
  db.run("INSERT INTO matches (date, location) VALUES (?, ?)", [date, location], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, date, location });
  });
});

app.delete("/matches/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM matches WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: this.changes > 0 });
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
