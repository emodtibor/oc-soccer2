function normalizePlayer(row) {
  return {
    id: row.player_id ?? row.id,
    name: row.name,
    skill: row.skill,
    isGoalie: Boolean(row.is_goalie),
  };
}

function buildTeamsResponse(teamsRows, membersRows) {
  const byTeam = new Map(
    teamsRows.map(t => [
      t.id,
      {
        id: t.id,
        matchId: t.match_id,
        teamIndex: t.team_index,
        players: [],
        totalSkill: 0,
      },
    ])
  );

  for (const member of membersRows) {
    const team = byTeam.get(member.team_id);
    if (!team) continue;
    const player = normalizePlayer(member);
    team.players.push(player);
    team.totalSkill += player.skill;
  }

  return Array.from(byTeam.values());
}

module.exports = { buildTeamsResponse, normalizePlayer };
