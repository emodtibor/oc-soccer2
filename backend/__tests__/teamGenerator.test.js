const { generateTeamsFor } = require("../services/teamGenerator");

// helper: játékos gyártó
const P = (id, skill, isGoalie = false) => ({
  id,
  name: `P${id}`,
  skill,
  is_goalie: isGoalie ? 1 : 0, // a szolgáltatás a .is_goalie mezőt ismeri
});

// össz-skill
const sum = (arr, proj = x => x) => arr.reduce((s, v) => s + proj(v), 0);

// csapatokra segédfüggvények
const teamSizes = teams => teams.map(t => t.members.length);
const teamSkills = teams => teams.map(t => t.sum);
const goaliesPerTeam = teams => teams.map(t => t.members.filter(m => !!m.is_goalie).length);

describe("teamGenerator.generateTeamsFor", () => {
  test("hiba, ha nincs résztvevő", () => {
    const { teams, error } = generateTeamsFor([]);
    expect(teams).toBeUndefined();
    expect(error).toBeTruthy();
  });

  test("hiba, ha túl sok mezőnyjátékos", () => {
    const players = Array.from({ length: 16 }, (_, i) => P(i + 1, 3));
    const { error } = generateTeamsFor(players);
    expect(error).toMatch(/Max 15 mezőnyjátékos/);
  });

  test("hiba, ha túl sok kapus", () => {
    const players = [
      P(1, 5, true),
      P(2, 4, true),
      P(3, 3, true),
      P(4, 2, true),
      ...Array.from({ length: 12 }, (_, i) => P(i + 5, 3)),
    ];
    const { error } = generateTeamsFor(players);
    expect(error).toMatch(/Max 15 mezőnyjátékos és 3 kapus/);
  });

  test("17 főnél 3 csapat, célméret 6-6-5, két kapus nem lehet együtt", () => {
    // 17 fő, 2 kapus
    const players = [];
    // két kapus kicsit eltérő skillel
    players.push(P(1, 5, true));
    players.push(P(2, 4, true));
    // mezőnyjátékosok
    for (let i = 3; i <= 17; i++) players.push(P(i, (i % 5) + 1, false));

    const { teams, error } = generateTeamsFor(players);
    expect(error).toBeUndefined();

    // 3 csapat
    expect(teams).toHaveLength(3);

    // méretek: 6,6,5 (sorrend lehet 6-5-6 stb., de rendezve egyezzen)
    const sizes = teamSizes(teams).sort((a, b) => b - a);
    expect(sizes).toEqual([6, 6, 5]);

    // kapusok külön csapatban
    const gCounts = goaliesPerTeam(teams);
    expect(sum(gCounts)).toBe(2);
    gCounts.forEach(cnt => expect(cnt <= 1).toBe(true));
  });

  test("kevesebb mint 17 főnél 2 csapat (pl. 12 -> 6-6)", () => {
    const players = Array.from({ length: 12 }, (_, i) => P(i + 1, (i % 5) + 1));
    const { teams, error } = generateTeamsFor(players);
    expect(error).toBeUndefined();
    expect(teams).toHaveLength(2);

    // 12 -> 6-6
    const sizes = teamSizes(teams).sort((a, b) => b - a);
    expect(sizes).toEqual([6, 6]);
  });

  test("páratlan létszámnál közel egyenlő (13 -> 7-6)", () => {
    const players = Array.from({ length: 13 }, (_, i) => P(i + 1, (i % 5) + 1));
    const { teams } = generateTeamsFor(players);
    const sizes = teamSizes(teams).sort((a, b) => b - a);
    expect(sizes).toEqual([7, 6]);
  });

  test("pontosan két kapus esetén nem kerülhetnek egy csapatba", () => {
    const players = [
      P(1, 5, true),
      P(2, 3, true),
      // mezőny
      ...Array.from({ length: 10 }, (_, i) => P(i + 3, (i % 5) + 1)),
    ];
    const { teams } = generateTeamsFor(players);
    const gCounts = goaliesPerTeam(teams);
    expect(sum(gCounts)).toBe(2);
    gCounts.forEach(cnt => expect(cnt <= 1).toBe(true));
  });

  test("több kapusnál max 1 csapatonként (extra kapusok mezőnyként mennek)", () => {
    const players = [
      P(1, 5, true),
      P(2, 4, true),
      P(3, 3, true), // 3. kapus
      ...Array.from({ length: 8 }, (_, i) => P(i + 4, 3)),
    ];
    const { teams } = generateTeamsFor(players);
    const gCounts = goaliesPerTeam(teams);
    // két csapat → max 1-1 kapus jelölés/elosztás; a 3. "kapus" mezőnyként kerül be valamelyikbe
    expect(gCounts.every(x => x <= 1)).toBe(true);
  });

  test("skill kiegyenlítés: össz-skill különbség ne legyen túl nagy (heurisztikus ellenőrzés)", () => {
    const players = [];
    // 10 játékos: 5 erős (5 skill), 5 gyenge (1 skill)
    for (let i = 1; i <= 5; i++) players.push(P(i, 5));
    for (let i = 6; i <= 10; i++) players.push(P(i, 1));

    const { teams } = generateTeamsFor(players);
    expect(teams).toHaveLength(2);

    const totals = teamSkills(teams).sort((a, b) => b - a);
    const diff = totals[0] - totals[1];

    // heurisztika: a különbség 5 alatt maradjon ennél a mesterséges példánál
    expect(diff).toBeLessThanOrEqual(5);
  });

  test("determinista (nincs véletlen): ugyanarra a bemenetre ugyanaz a kiosztás", () => {
    const players = [
      P(1, 5, true),
      P(2, 4, false),
      P(3, 3, false),
      P(4, 2, false),
      P(5, 1, false),
      P(6, 4, true),
      P(7, 3, false),
      P(8, 2, false),
    ];

    const A = generateTeamsFor(players);
    const B = generateTeamsFor(players);

    // összehasonlítás: csapatonként azonos játékos ID halmaz
    const sig = out =>
      out.teams
        .map(t => t.members.map(m => m.id).sort((x, y) => x - y).join(","))
        .sort()
        .join("|");

    expect(sig(A)).toBe(sig(B));
  });
});
