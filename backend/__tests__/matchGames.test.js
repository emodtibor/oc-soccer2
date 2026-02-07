const { buildGamePairs } = require("../services/matchGames");

describe("buildGamePairs", () => {
  test("returns a single pairing for two teams", () => {
    const teams = [
      { id: 10, team_index: 1 },
      { id: 5, team_index: 0 },
    ];
    expect(buildGamePairs(teams)).toEqual([[5, 10]]);
  });

  test("returns round-robin pairings for three teams", () => {
    const teams = [
      { id: 4, team_index: 2 },
      { id: 1, team_index: 0 },
      { id: 3, team_index: 1 },
    ];
    expect(buildGamePairs(teams)).toEqual([
      [1, 3],
      [1, 4],
      [3, 4],
    ]);
  });

  test("returns empty list when team count is unsupported", () => {
    const teams = [
      { id: 1, team_index: 0 },
    ];
    expect(buildGamePairs(teams)).toEqual([]);
  });
});
