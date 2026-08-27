const sqlite3 = require("sqlite3").verbose();
const { addGoal } = require("../controllers/matchGamesController");

const dbRun = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const dbGet = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function callAddGoal(db, body) {
  const req = { db, params: { gameId: "300" }, body };
  const res = createResponse();
  await addGoal(req, res);
  return res;
}

describe("matchGamesController.addGoal", () => {
  let db;

  beforeEach(async () => {
    db = new sqlite3.Database(":memory:");
    await dbRun(db, "PRAGMA foreign_keys = ON");
    await dbRun(db, `CREATE TABLE matches (id INTEGER PRIMARY KEY)`);
    await dbRun(db, `CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`);
    await dbRun(db, `
      CREATE TABLE match_teams (
        id INTEGER PRIMARY KEY,
        match_id INTEGER NOT NULL,
        team_index INTEGER NOT NULL
      )
    `);
    await dbRun(db, `
      CREATE TABLE match_team_members (
        team_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        PRIMARY KEY (team_id, player_id)
      )
    `);
    await dbRun(db, `
      CREATE TABLE match_games (
        id INTEGER PRIMARY KEY,
        match_id INTEGER NOT NULL,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL
      )
    `);
    await dbRun(db, `
      CREATE TABLE match_game_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        scoring_team_id INTEGER NOT NULL,
        scorer_player_id INTEGER,
        is_own_goal INTEGER NOT NULL DEFAULT 0,
        client_request_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await dbRun(db, `
      CREATE UNIQUE INDEX idx_match_game_goals_request
      ON match_game_goals(game_id, client_request_id)
      WHERE client_request_id IS NOT NULL
    `);

    await dbRun(db, "INSERT INTO matches(id) VALUES(1)");
    await dbRun(db, "INSERT INTO players(id, name) VALUES(10, 'Tibi'), (20, 'Dávid')");
    await dbRun(db, `
      INSERT INTO match_teams(id, match_id, team_index)
      VALUES(100, 1, 0), (200, 1, 1)
    `);
    await dbRun(db, `
      INSERT INTO match_team_members(team_id, player_id)
      VALUES(100, 10), (200, 20)
    `);
    await dbRun(db, `
      INSERT INTO match_games(id, match_id, home_team_id, away_team_id)
      VALUES(300, 1, 100, 200)
    `);
  });

  afterEach(() => new Promise(resolve => db.close(resolve)));

  test("creates only one goal when the same client request is repeated", async () => {
    const body = {
      scoring_team_id: 100,
      scorer_player_id: 10,
      is_own_goal: false,
      client_request_id: "tap-123",
    };

    const first = await callAddGoal(db, body);
    const repeated = await callAddGoal(db, body);
    const count = await dbGet(db, "SELECT COUNT(*) AS count FROM match_game_goals");

    expect(first.statusCode).toBe(201);
    expect(repeated.statusCode).toBe(200);
    expect(repeated.payload.id).toBe(first.payload.id);
    expect(count.count).toBe(1);
  });

  test("rejects a scorer who is not in the scoring team", async () => {
    const response = await callAddGoal(db, {
      scoring_team_id: 100,
      scorer_player_id: 20,
      is_own_goal: false,
      client_request_id: "wrong-team",
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload.error).toMatch(/megfelelő csapatnak/);
  });

  test("allows recording a goal with an unknown scorer", async () => {
    const response = await callAddGoal(db, {
      scoring_team_id: 200,
      scorer_player_id: null,
      is_own_goal: false,
      client_request_id: "unknown-scorer",
    });

    expect(response.statusCode).toBe(201);
    expect(response.payload.scorer_player_id).toBeNull();
    expect(response.payload.scorer_name).toBeNull();
  });
});
