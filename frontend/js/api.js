// frontend/js/api.js
const API_URL = window.APP_CONFIG.API_URL;

async function http(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>"");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json().catch(()=> ({}));
}

export const api = {
  // auth
  authMe: () => http("GET", "/auth/me"),
  logout: () => http("POST", "/auth/logout", {}),

  // players
  listPlayers: () => http("GET", "/players"),
  createPlayer: ({ name, skill, isGoalie }) => http("POST", "/players", { name, skill, isGoalie }),
  updatePlayer: (id, patch) => http("PATCH", `/players/${id}`, patch),
  removePlayer: (id) => http("DELETE", `/players/${id}`),

  // matches
  listMatches: () => http("GET", "/matches"),
  createMatch: ({ date, location }) => http("POST", "/matches", { date, location }),
  deleteMatch: (id) => http("DELETE", `/matches/${id}`),

  // participants
  getParticipants: (matchId) => http("GET", `/matches/${matchId}/participants`),
  setParticipants: (matchId, playerIds) => http("POST", `/matches/${matchId}/participants`, { playerIds }),

  // teams
  getTeams: (matchId) => http("GET", `/matches/${matchId}/teams`),
  generateTeams: (matchId) => http("POST", `/matches/${matchId}/generate-teams`, {}),
  saveGeneratedTeams: (matchId, teams) => http("POST", `/matches/${matchId}/save-teams`, { teams }),
  createTeam: (matchId, teamIndex) => http("POST", `/matches/${matchId}/teams`, teamIndex != null ? { team_index: teamIndex } : {}),
  deleteTeam: (matchId, teamId) => http("DELETE", `/matches/${matchId}/teams/${teamId}`),
  addTeamMember: (matchId, teamId, playerId) => http("POST", `/matches/${matchId}/teams/${teamId}/members`, { player_id: playerId }),
  removeTeamMember: (matchId, teamId, playerId) => http("DELETE", `/matches/${matchId}/teams/${teamId}/members/${playerId}`),

  // games
  listMatchGames: (matchId) => http("GET", `/matches/${matchId}/games`),
  createMatchGame: (matchId, homeTeamId, awayTeamId) =>
    http("POST", `/matches/${matchId}/games`, { home_team_id: homeTeamId, away_team_id: awayTeamId }),
  createMatchGamesAuto: (matchId) => http("POST", `/matches/${matchId}/games/auto`, {}),
  deleteMatchGame: (matchId, gameId) => http("DELETE", `/matches/${matchId}/games/${gameId}`),
  addGameGoal: (gameId, payload) => http("POST", `/games/${gameId}/goals`, payload),
  deleteGameGoal: (gameId, goalId) => http("DELETE", `/games/${gameId}/goals/${goalId}`),
};
