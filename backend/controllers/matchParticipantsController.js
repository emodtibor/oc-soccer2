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

async function add(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const { playerIds } = req.body ?? {};

  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "matchId érvénytelen" });
  }

  await ensureMatch(db, matchId);

  // playerIds validáció
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: "playerIds kötelező (nem üres tömb)" });
  }
  if (!playerIds.every(Number.isInteger)) {
    return res.status(400).json({ error: "playerIds csak integer-eket tartalmazhat" });
  }

  // Duplikációk kiszűrése (hogy kevesebb DB roundtrip legyen)
  const uniquePlayerIds = Array.from(new Set(playerIds));

  // Ellenőrizzük, hogy minden player létezik-e
  const placeholders = uniquePlayerIds.map(() => "?").join(",");
  const existing = await dbAll(
    db,
    `SELECT id, is_goalie FROM players WHERE id IN (${placeholders})`,
    uniquePlayerIds
  );

  const existingIds = new Set(existing.map((r) => r.id));
  const missingIds = uniquePlayerIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    return res.status(404).json({
      error: "Nem található játékos",
      missingPlayerIds: missingIds,
    });
  }

  const goalieCount = existing.filter((p) => p.is_goalie).length;
  const fielderCount = existing.length - goalieCount;
  if (goalieCount > 3 || fielderCount > 15) {
    return res.status(400).json({
      error: "Max 15 mezőnyjátékos és 3 kapus választható.",
    });
  }

  await dbRun(db, "BEGIN IMMEDIATE");
  try {
    await dbRun(db, "DELETE FROM match_participants WHERE match_id = ?", [matchId]);

    for (const playerId of uniquePlayerIds) {
      await dbRun(
        db,
        "INSERT OR IGNORE INTO match_participants(match_id, player_id) VALUES(?, ?)",
        [matchId, playerId]
      );
    }

    await dbRun(db, "COMMIT");
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    throw err;
  }

  // Visszaadjuk az aktuális listát
  const rows = await dbAll(
      db,
      `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_participants mp
       JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ?
      ORDER BY p.name`,
      [matchId]
  );

  // 201 vs 200: tömbös beszúrásnál a sqlite3 changes nem megbízhatóan aggregálódik itt,
  // ezért stabilan 200-at adunk. Ha kell, külön számolható.
  return res.status(200).json(rows);
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
