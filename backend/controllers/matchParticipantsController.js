// controllers/matchParticipantsController.js
const dbAll = (db, sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows)));
const dbGet = (db, sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row)));
const dbRun = (db, sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

async function ensureMatch(db, matchId) {
  const m = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!m) {
    const err = new Error("Nem található meccs");
    err.status = 404;
    throw err;
  }
}

async function list(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  await ensureMatch(db, matchId);

  const rows = await dbAll(
    db,
    `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_participants mp
       JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ?
      ORDER BY p.name`,
    [matchId]
  );
  res.json(rows);
}

// Body: { player_id: number }
async function add(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const { player_id } = req.body ?? {};
  await ensureMatch(db, matchId);

  if (!Number.isInteger(player_id)) {
    return res.status(400).json({ error: "player_id kötelező (integer) " + player_id });
  }
  const player = await dbGet(db, "SELECT id FROM players WHERE id = ?", [player_id]);
  if (!player) return res.status(404).json({ error: "Nem található játékos" });

  const ins = await dbRun(
    db,
    "INSERT OR IGNORE INTO match_participants(match_id, player_id) VALUES(?, ?)",
    [matchId, player_id]
  );

  // visszaadjuk az aktuális listát (vagy csak a beszúrt rekordot is lehetne)
  const rows = await dbAll(
    db,
    `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_participants mp
       JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ?
      ORDER BY p.name`,
    [matchId]
  );
  res.status(ins.changes ? 201 : 200).json(rows);
}

async function remove(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const playerId = Number(req.params.playerId);
  await ensureMatch(db, matchId);

  const del = await dbRun(
    db,
    "DELETE FROM match_participants WHERE match_id = ? AND player_id = ?",
    [matchId, playerId]
  );
  if (del.changes === 0) return res.status(404).json({ error: "Nincs ilyen résztvevő ezen a meccsen" });
  res.status(204).send();
}

module.exports = { list, add, remove };
