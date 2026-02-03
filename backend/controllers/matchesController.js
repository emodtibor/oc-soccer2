// controllers/matchesController.js

// Kis promise-wrapperek az sqlite3 callback API-hoz:
const {generateTeamsFor} = require("../services/teamGenerator");
const dbAll = (db, sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows))));
const dbGet = (db, sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, row) => (e ? rej(e) : res(row))));
const dbRun = (db, sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

// GET /matches
// Visszaadja az összes meccset dátum szerint csökkenő sorrendben.
async function list(req, res) {
  const db = req.db;
  const rows = await dbAll(
    db,
    `SELECT id, date, location
       FROM matches
      ORDER BY date DESC, id DESC`
  );
  res.json(rows);
}

// POST /matches
// Body: { date, location }
// Mindkettő kötelező (string). Visszaadja a létrejött rekordot.
async function create(req, res) {
  const db = req.db;
  const { date, location } = req.body ?? {};

  if (typeof date !== "string" || !date.trim()) {
    return res.status(400).json({ error: "date (string) kötelező" });
  }
  if (typeof location !== "string") {
    return res.status(400).json({ error: "location (string) kötelező" });
  }

  const result = await dbRun(
    db,
    `INSERT INTO matches(date, location) VALUES(?, ?)`,
    [date, location]
  );

  const row = await dbGet(
    db,
    `SELECT id, date, location FROM matches WHERE id = ?`,
    [result.lastID]
  );
  res.status(201).json(row);
}

// PATCH /matches/:id
// Body: { date?, location? } – csak a megadott mezőket frissíti.
async function update(req, res) {
  const db = req.db;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Érvénytelen id" });

  const fields = [];
  const params = [];

  if (req.body?.date !== undefined) {
    if (typeof req.body.date !== "string" || !req.body.date.trim()) {
      return res.status(400).json({ error: "date string legyen és nem üres" });
    }
    fields.push("date = ?");
    params.push(req.body.date);
  }

  if (req.body?.location !== undefined) {
    if (typeof req.body.location !== "string") {
      return res.status(400).json({ error: "location string legyen" });
    }
    fields.push("location = ?");
    params.push(req.body.location);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Nincs módosítandó mező" });
  }

  params.push(id);
  const exec = await dbRun(
    db,
    `UPDATE matches SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  if (exec.changes === 0) {
    return res.status(404).json({ error: "Nem található meccs" });
  }

  const row = await dbGet(
    db,
    `SELECT id, date, location FROM matches WHERE id = ?`,
    [id]
  );
  res.json(row);
}

async function generateTeams(req, res) {
  const db = req.db;
  const matchId = req.params.id

  const participiants = await dbAll(
      db,
      `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_participants mp
              JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = ?
       ORDER BY p.name`,
      [matchId]
  );

  const result = generateTeamsFor(participiants)
  const teams = result.teams;
  teams.forEach((team, i) => {
    console.log(`Team ${i}`, team.members);
  });
  console.dir(teams, { depth: null });
  console.log("teams type:", typeof teams);
  console.log("isArray:", Array.isArray(teams));
  console.log("value:", teams);

  res.json(result)
}

module.exports = { list, create, update, generateTeams };
