/**
 * Egyszerű kiegyensúlyozó:
 * - going státuszú játékosokból dolgozik
 * - kapusok kezelése (lockGoalies): 2 kapus => egy-egy csapat; 1 kapus => Team A
 * - snake draft (A,B,B,A,...) a maradékra rating szerint
 * - lokális csere heurisztika: pár csere, ha csökkenti a különbséget
 */
function pickGoalies(players) {
  const gks = players.filter(p => p.isGoalie);
  if (gks.length >= 2) return [gks[0], gks[1]];
  if (gks.length === 1) return [gks[0], null];
  return [null, null];
}

function sum(arr, sel = x => x) {
  return arr.reduce((a, b) => a + sel(b), 0);
}

function snakeDistribute(sortedPlayers, teamA, teamB) {
  // snake: A,B,B,A,A,B,B,A...
  let turn = 0;
  for (const p of sortedPlayers) {
    const mod = turn % 4;
    if (mod === 0 || mod === 3) teamA.push(p);
    else teamB.push(p);
    turn++;
  }
}

function tryLocalSwaps(teamA, teamB, getRating, maxIters = 200) {
  let bestDelta = Math.abs(sum(teamA, getRating) - sum(teamB, getRating));
  for (let iter = 0; iter < maxIters; iter++) {
    let improved = false;
    for (let i = 0; i < teamA.length; i++) {
      for (let j = 0; j < teamB.length; j++) {
        const a = teamA[i], b = teamB[j];
        const newA = sum(teamA, getRating) - getRating(a) + getRating(b);
        const newB = sum(teamB, getRating) - getRating(b) + getRating(a);
        const delta = Math.abs(newA - newB);
        if (delta < bestDelta) {
          // swap
          teamA[i] = b;
          teamB[j] = a;
          bestDelta = delta;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
}

function balancePlayers(players, opts = {}) {
  const {
    lockGoalies = true,
    minTeamSizeDiff = 1,     // ha páratlan a létszám, max 1 különbség
  } = opts;

  // csak akik mennek
  const going = players.filter(p => (p.status || 'going') === 'going');

  // rating fallback
  going.forEach(p => { if (typeof p.rating !== 'number') p.rating = 5; });

  // goalies
  let teamA = [];
  let teamB = [];

  if (lockGoalies) {
    const [gkA, gkB] = pickGoalies(going);
    if (gkA) teamA.push(gkA);
    if (gkB) teamB.push(gkB);
  }

  // maradék
  const usedIds = new Set([...teamA, ...teamB].map(p => p.id));
  const rest = going.filter(p => !usedIds.has(p.id))
                    .sort((a, b) => b.rating - a.rating);

  snakeDistribute(rest, teamA, teamB);

  // ha létszámkülönbség > 1, igazítsunk
  while (Math.abs(teamA.length - teamB.length) > minTeamSizeDiff) {
    if (teamA.length > teamB.length) teamB.push(teamA.pop());
    else teamA.push(teamB.pop());
  }

  // lokális optimalizálás rating különbségre
  const getRating = p => Number(p.rating || 5);
  tryLocalSwaps(teamA, teamB, getRating, 150);

  const scoreA = sum(teamA, getRating);
  const scoreB = sum(teamB, getRating);

  return {
    teamA,
    teamB,
    totalA: scoreA,
    totalB: scoreB,
    diff: Math.abs(scoreA - scoreB),
  };
}

module.exports = { balancePlayers };
