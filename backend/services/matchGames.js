function buildGamePairs(teams) {
  if (!Array.isArray(teams)) return [];
  const sorted = [...teams].sort((a, b) => a.team_index - b.team_index);
  if (sorted.length === 2) {
    return [[sorted[0].id, sorted[1].id]];
  }
  if (sorted.length === 3) {
    return [
      [sorted[0].id, sorted[1].id],
      [sorted[0].id, sorted[2].id],
      [sorted[1].id, sorted[2].id],
    ];
  }
  return [];
}

module.exports = { buildGamePairs };
