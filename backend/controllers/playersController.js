// controllers/playersController.js
// Kis promise-wrapperek az sqlite3-hoz:
const dbAll = (db, sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows)));
const dbGet = (db, sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row)));
const dbRun = (db, sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

// GET /players
async function list(req, res) {
  const db = req.db;
  const rows = await dbAll(
    db,
    "SELECT id, name, skill, is_goalie FROM players ORDER BY name"
  );
  res.json(rows);
}

// POST /players  { name, skill, is_goalie? }
async function create(req, res) {
  const db = req.db;
  const { name, skill, is_goalie = 0 } = req.body ?? {};

  if (!name || typeof skill !== "number") {
    return res.status(400).json({ error: "name és skill kötelező (skill: number)" });
  }

  const result = await dbRun(
    db,
    "INSERT INTO players(name, skill, is_goalie) VALUES (?, ?, ?)",
    [name, skill, is_goalie ? 1 : 0]
  );

  const row = await dbGet(
    db,
    "SELECT id, name, skill, is_goalie FROM players WHERE id = ?",
    [result.lastID]
  );
  res.status(201).json(row);
}

// PATCH /players/:id  { name?, skill?, is_goalie? }
async function update(req, res) {
  const db = req.db;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Érvénytelen id" });

  const fields = [];
  const params = [];

  if (req.body?.name !== undefined) { fields.push("name = ?"); params.push(req.body.name); }
  if (req.body?.skill !== undefined) {
    if (typeof req.body.skill !== "number") return res.status(400).json({ error: "skill number legyen" });
    fields.push("skill = ?"); params.push(req.body.skill);
  }
  if (req.body?.is_goalie !== undefined) {
    fields.push("is_goalie = ?"); params.push(req.body.is_goalie ? 1 : 0);
  }

  if (fields.length === 0) return res.status(400).json({ error: "Nincs módosítandó mező" });

  params.push(id);
  const exec = await dbRun(db, `UPDATE players SET ${fields.join(", ")} WHERE id = ?`, params);

  if (exec.changes === 0) return res.status(404).json({ error: "Nem található játékos" });

  const row = await dbGet(db, "SELECT id, name, skill, is_goalie FROM players WHERE id = ?", [id]);
  res.json(row);
}

module.exports = { list, create, update };
