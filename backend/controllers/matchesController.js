// controllers/matchesController.js

// Kis promise-wrapperek az sqlite3 callback API-hoz:
const { generateTeamsFor } = require("../services/teamGenerator");
const { buildTeamsResponse, normalizePlayer } = require("../services/teamMapper");
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
  const matchId = Number(req.params.id);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Érvénytelen id" });
  }

  const participiants = await dbAll(
    db,
    `SELECT p.id, p.name, p.skill, p.is_goalie
       FROM match_participants mp
              JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = ?
       ORDER BY p.name`,
    [matchId]
  );

  const result = generateTeamsFor(participiants);
  if (result.error) {
    return res.status(400).json(result);
  }

  const teams = result.teams.map((team, index) => {
    const players = team.members.map(normalizePlayer);
    const totalSkill = players.reduce((sum, p) => sum + p.skill, 0);
    return { teamIndex: index, players, totalSkill };
  });

  res.json({ teams });
}

async function saveTeams(req, res) {
  const db = req.db;
  const matchId = Number(req.params.id);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Érvénytelen id" });
  }

  const { teams } = req.body ?? {};
  if (!Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({ error: "teams kötelező (nem üres tömb)" });
  }

  const match = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!match) {
    return res.status(404).json({ error: "Nem található meccs" });
  }

  await dbRun(db, "BEGIN IMMEDIATE");
  try {
    await dbRun(db, "DELETE FROM match_teams WHERE match_id = ?", [matchId]);

    for (let i = 0; i < teams.length; i += 1) {
      const team = teams[i];
      const players = Array.isArray(team?.players) ? team.players : [];
      const ins = await dbRun(
        db,
        "INSERT INTO match_teams(match_id, team_index) VALUES(?, ?)",
        [matchId, i]
      );

      for (const player of players) {
        if (!Number.isInteger(player?.id)) continue;
        await dbRun(
          db,
          "INSERT OR IGNORE INTO match_participants(match_id, player_id) VALUES(?, ?)",
          [matchId, player.id]
        );
        await dbRun(
          db,
          "INSERT OR IGNORE INTO match_team_members(team_id, player_id) VALUES(?, ?)",
          [ins.lastID, player.id]
        );
      }
    }

    await dbRun(db, "COMMIT");
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    throw err;
  }

  const storedTeams = await dbAll(
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

  res.status(201).json({ teams: buildTeamsResponse(storedTeams, members) });
}

module.exports = { list, create, update, generateTeams, saveTeams };
