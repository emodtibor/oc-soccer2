// controllers/teamsController.js
const { buildTeamsResponse } = require("../services/teamMapper");
const dbAll = (db, sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows)));
const dbGet = (db, sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row)));
const dbRun = (db, sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

async function ensureMatch(db, matchId) {
  const m = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!m) { const err = new Error("Nem található meccs"); err.status = 404; throw err; }
}
async function ensureTeamInMatch(db, matchId, teamId) {
  const t = await dbGet(db, "SELECT id FROM match_teams WHERE id = ? AND match_id = ?", [teamId, matchId]);
  if (!t) { const err = new Error("Nem található csapat ezen a meccsen"); err.status = 404; throw err; }
}

async function list(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  await ensureMatch(db, matchId);

  const teams = await dbAll(
    db,
    `SELECT id, match_id, team_index
       FROM match_teams
      WHERE match_id = ?
      ORDER BY team_index, id`,
    [matchId]
  );
  const members = await dbAll(
    db,
    `SELECT mtm.team_id, p.id AS player_id, p.name, p.skill, p.is_goalie
       FROM match_team_members mtm
       JOIN players p ON p.id = mtm.player_id
       JOIN match_teams t ON t.id = mtm.team_id
      WHERE t.match_id = ?
      ORDER BY p.name`,
    [matchId]
  );

  res.json(buildTeamsResponse(teams, members));
}

async function create(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  await ensureMatch(db, matchId);

  // Ha megadod a team_index-et, azt használjuk; különben a következő sorszámot
  let { team_index } = req.body ?? {};
  if (team_index == null) {
    const row = await dbGet(
      db,
      "SELECT COALESCE(MAX(team_index), -1) AS maxidx FROM match_teams WHERE match_id = ?",
      [matchId]
    );
    team_index = (row?.maxidx ?? -1) + 1;
  }
  const ins = await dbRun(
    db,
    "INSERT INTO match_teams(match_id, team_index) VALUES(?, ?)",
    [matchId, team_index]
  );
  const team = await dbGet(
    db,
    "SELECT id, match_id, team_index FROM match_teams WHERE id = ?",
    [ins.lastID]
  );
  res.status(201).json({ ...team, members: [] });
}

async function remove(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const teamId = Number(req.params.teamId);
  await ensureTeamInMatch(db, matchId, teamId);

  const del = await dbRun(db, "DELETE FROM match_teams WHERE id = ?", [teamId]);
  if (del.changes === 0) return res.status(404).json({ error: "Nem található csapat" });
  // ON DELETE CASCADE esetén a tagok is törlődnek
  res.status(204).send();
}

// Body: { player_id }
async function addMember(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const teamId  = Number(req.params.teamId);
  const { player_id } = req.body ?? {};
  await ensureTeamInMatch(db, matchId, teamId);

  if (!Number.isInteger(player_id)) {
    return res.status(400).json({ error: "player_id kötelező (integer)" });
  }
  const player = await dbGet(db, "SELECT id, is_goalie FROM players WHERE id = ?", [player_id]);
  if (!player) return res.status(404).json({ error: "Nem található játékos" });

  const existingParticipant = await dbGet(
    db,
    "SELECT 1 FROM match_participants WHERE match_id = ? AND player_id = ?",
    [matchId, player_id]
  );
  if (!existingParticipant) {
    return res.status(400).json({
      error: "Csak a meccs résztvevői adhatók csapathoz.",
    });
  }

  // Egy meccsen belül 1 csapatban legyen a játékos:
  await dbRun(db, "BEGIN IMMEDIATE");
  try {
    // 1) távolítsuk el minden más csapatból ezen a meccsen
    await dbRun(
      db,
      `DELETE FROM match_team_members
        WHERE player_id = ?
          AND team_id IN (SELECT id FROM match_teams WHERE match_id = ?)`,
      [player_id, matchId]
    );
    // 2) adjuk ehhez a csapathoz
    await dbRun(
      db,
      "INSERT OR IGNORE INTO match_team_members(team_id, player_id) VALUES(?, ?)",
      [teamId, player_id]
    );
    await dbRun(db, "COMMIT");
  } catch (e) {
    await dbRun(db, "ROLLBACK");
    throw e;
  }

  // visszaadjuk az adott csapat friss állapotát
  const team = await dbGet(db, "SELECT id, match_id, team_index FROM match_teams WHERE id = ?", [teamId]);
  const members = await dbAll(
    db,
    `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_team_members mtm
       JOIN players p ON p.id = mtm.player_id
      WHERE mtm.team_id = ?
      ORDER BY p.name`,
    [teamId]
  );
  res.status(201).json({ ...team, members });
}

async function removeMember(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const teamId  = Number(req.params.teamId);
  const playerId = Number(req.params.playerId);
  await ensureTeamInMatch(db, matchId, teamId);

  const del = await dbRun(
    db,
    "DELETE FROM match_team_members WHERE team_id = ? AND player_id = ?",
    [teamId, playerId]
  );
  if (del.changes === 0) return res.status(404).json({ error: "A játékos nem tagja ennek a csapatnak" });
  res.status(204).send();
}

module.exports = { list, create, remove, addMember, removeMember };
