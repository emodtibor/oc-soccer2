const { buildGamePairs } = require("../services/matchGames");

const dbAll = (db, sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, rows) => (e ? rej(e) : res(rows))));
const dbGet = (db, sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, row) => (e ? rej(e) : res(row))));
const dbRun = (db, sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (e) { e ? rej(e) : res(this); }));

async function ensureMatch(db, matchId) {
  const match = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!match) {
    return false;
  }
  return true;
}

async function listByMatch(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Érvénytelen matchId" });
  }

  const exists = await ensureMatch(db, matchId);
  if (!exists) {
    return res.status(404).json({ error: "Nem található meccs" });
  }

  const games = await dbAll(
    db,
    `SELECT mg.id,
            mg.match_id,
            mg.home_team_id,
            mg.away_team_id,
            ht.team_index AS home_team_index,
            at.team_index AS away_team_index
       FROM match_games mg
       JOIN match_teams ht ON ht.id = mg.home_team_id
       JOIN match_teams at ON at.id = mg.away_team_id
      WHERE mg.match_id = ?
      ORDER BY mg.id`,
    [matchId]
  );

  if (!games.length) {
    return res.json({ games: [] });
  }

  const gameIds = games.map(g => g.id);
  const placeholders = gameIds.map(() => "?").join(",");
  const goals = await dbAll(
    db,
    `SELECT g.id,
            g.game_id,
            g.scoring_team_id,
            g.scorer_player_id,
            g.is_own_goal,
            g.created_at,
            p.name AS scorer_name,
            st.team_index AS scoring_team_index
       FROM match_game_goals g
       JOIN match_teams st ON st.id = g.scoring_team_id
       LEFT JOIN players p ON p.id = g.scorer_player_id
      WHERE g.game_id IN (${placeholders})
      ORDER BY g.id`,
    gameIds
  );

  const goalsByGame = new Map();
  goals.forEach(goal => {
    if (!goalsByGame.has(goal.game_id)) {
      goalsByGame.set(goal.game_id, []);
    }
    goalsByGame.get(goal.game_id).push(goal);
  });

  const payload = games.map(game => ({
    ...game,
    goals: goalsByGame.get(game.id) ?? [],
  }));

  res.json({ games: payload });
}

async function create(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  const { home_team_id, away_team_id } = req.body ?? {};
  const homeTeamId = Number(home_team_id);
  const awayTeamId = Number(away_team_id);

  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Érvénytelen matchId" });
  }
  if (!Number.isInteger(homeTeamId) || !Number.isInteger(awayTeamId)) {
    return res.status(400).json({ error: "home_team_id és away_team_id kötelező (integer)" });
  }
  if (homeTeamId === awayTeamId) {
    return res.status(400).json({ error: "A két csapat nem lehet ugyanaz" });
  }

  const match = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!match) {
    return res.status(404).json({ error: "Nem található meccs" });
  }

  const teams = await dbAll(
    db,
    `SELECT id FROM match_teams WHERE match_id = ? AND id IN (?, ?)`,
    [matchId, homeTeamId, awayTeamId]
  );
  if (teams.length !== 2) {
    return res.status(400).json({ error: "A csapatok nem ehhez a meccshez tartoznak" });
  }

  const ins = await dbRun(
    db,
    `INSERT INTO match_games(match_id, home_team_id, away_team_id) VALUES(?, ?, ?)`,
    [matchId, homeTeamId, awayTeamId]
  );

  const row = await dbGet(
    db,
    `SELECT mg.id,
            mg.match_id,
            mg.home_team_id,
            mg.away_team_id,
            ht.team_index AS home_team_index,
            at.team_index AS away_team_index
       FROM match_games mg
       JOIN match_teams ht ON ht.id = mg.home_team_id
       JOIN match_teams at ON at.id = mg.away_team_id
      WHERE mg.id = ?`,
    [ins.lastID]
  );
  res.status(201).json(row);
}

async function createAuto(req, res) {
  const db = req.db;
  const matchId = Number(req.params.matchId);
  if (!Number.isInteger(matchId)) {
    return res.status(400).json({ error: "Érvénytelen matchId" });
  }

  const match = await dbGet(db, "SELECT id FROM matches WHERE id = ?", [matchId]);
  if (!match) {
    return res.status(404).json({ error: "Nem található meccs" });
  }

  const teams = await dbAll(
    db,
    `SELECT id, team_index FROM match_teams WHERE match_id = ? ORDER BY team_index, id`,
    [matchId]
  );
  const pairs = buildGamePairs(teams);
  if (!pairs.length) {
    return res.status(400).json({ error: "Nincs elég csapat automatikus párosításhoz" });
  }

  const existingGames = await dbAll(
    db,
    `SELECT home_team_id, away_team_id FROM match_games WHERE match_id = ?`,
    [matchId]
  );
  const existingKeys = new Set(
    existingGames.map(g => {
      const a = Math.min(g.home_team_id, g.away_team_id);
      const b = Math.max(g.home_team_id, g.away_team_id);
      return `${a}-${b}`;
    })
  );

  const created = [];
  for (const [homeTeamId, awayTeamId] of pairs) {
    const a = Math.min(homeTeamId, awayTeamId);
    const b = Math.max(homeTeamId, awayTeamId);
    const key = `${a}-${b}`;
    if (existingKeys.has(key)) continue;
    const ins = await dbRun(
      db,
      `INSERT INTO match_games(match_id, home_team_id, away_team_id) VALUES(?, ?, ?)`,
      [matchId, homeTeamId, awayTeamId]
    );
    created.push(ins.lastID);
  }

  res.status(201).json({ created });
}

async function addGoal(req, res) {
  const db = req.db;
  const gameId = Number(req.params.gameId);
  const { scoring_team_id, scorer_player_id, is_own_goal } = req.body ?? {};
  const scoringTeamId = Number(scoring_team_id);
  const scorerPlayerId = scorer_player_id == null ? null : Number(scorer_player_id);
  const ownGoal = Boolean(is_own_goal);

  if (!Number.isInteger(gameId)) {
    return res.status(400).json({ error: "Érvénytelen gameId" });
  }
  if (!Number.isInteger(scoringTeamId)) {
    return res.status(400).json({ error: "scoring_team_id kötelező (integer)" });
  }
  if (scorer_player_id != null && !Number.isInteger(scorerPlayerId)) {
    return res.status(400).json({ error: "scorer_player_id integer legyen" });
  }

  const game = await dbGet(
    db,
    `SELECT mg.id, mg.match_id, mg.home_team_id, mg.away_team_id
       FROM match_games mg
      WHERE mg.id = ?`,
    [gameId]
  );
  if (!game) {
    return res.status(404).json({ error: "Nem található mérkőzés" });
  }

  if (![game.home_team_id, game.away_team_id].includes(scoringTeamId)) {
    return res.status(400).json({ error: "A gólt szerző csapat nem része a mérkőzésnek" });
  }

  if (scorerPlayerId != null) {
    const playerRow = await dbGet(
      db,
      `SELECT 1
         FROM match_participants
        WHERE match_id = ?
          AND player_id = ?`,
      [game.match_id, scorerPlayerId]
    );
    if (!playerRow) {
      return res.status(400).json({ error: "A gólszerző nem résztvevője ennek a meccsnek" });
    }
  }

  const ins = await dbRun(
    db,
    `INSERT INTO match_game_goals(game_id, scoring_team_id, scorer_player_id, is_own_goal)
     VALUES(?, ?, ?, ?)`,
    [gameId, scoringTeamId, scorerPlayerId, ownGoal ? 1 : 0]
  );

  const row = await dbGet(
    db,
    `SELECT g.id,
            g.game_id,
            g.scoring_team_id,
            g.scorer_player_id,
            g.is_own_goal,
            g.created_at,
            p.name AS scorer_name,
            st.team_index AS scoring_team_index
       FROM match_game_goals g
       JOIN match_teams st ON st.id = g.scoring_team_id
       LEFT JOIN players p ON p.id = g.scorer_player_id
      WHERE g.id = ?`,
    [ins.lastID]
  );

  res.status(201).json(row);
}

async function deleteGoal(req, res) {
  const db = req.db;
  const gameId = Number(req.params.gameId);
  const goalId = Number(req.params.goalId);

  if (!Number.isInteger(gameId)) {
    return res.status(400).json({ error: "Érvénytelen gameId" });
  }
  if (!Number.isInteger(goalId)) {
    return res.status(400).json({ error: "Érvénytelen goalId" });
  }

  const goal = await dbGet(
    db,
    `SELECT id
       FROM match_game_goals
      WHERE id = ?
        AND game_id = ?`,
    [goalId, gameId]
  );

  if (!goal) {
    return res.status(404).json({ error: "Nem található gól" });
  }

  await dbRun(db, "DELETE FROM match_game_goals WHERE id = ?", [goalId]);

  res.json({ deleted: goalId });
}

module.exports = { listByMatch, create, createAuto, addGoal, deleteGoal };
