// frontend/js/api.js
const API_URL = window.APP_CONFIG.API_URL;

async function http(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
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
  // players
  listPlayers: () => http("GET", "/players"),
  createPlayer: ({ name, skill, isGoalie }) => http("POST", "/players", { name, skill, isGoalie }),
  updatePlayer: (id, patch) => http("PATCH", `/players/${id}`, patch),

  // matches
  listMatches: () => http("GET", "/matches"),
  createMatch: ({ date, location }) => http("POST", "/matches", { date, location }),
  deleteMatch: (id) => http("DELETE", `/matches/${id}`),

  // participants
  getParticipants: (matchId) => http("GET", `/matches/${matchId}/participants`),
  setParticipants: (matchId, playerIds) => http("POST", `/matches/${matchId}/participants`, { playerIds }),

  // teams
  getTeams: (matchId) => http("GET", `/matches/${matchId}/teams`),
  generateTeams: (matchId) => http("POST", `/matches/${matchId}/generate-teams`, {})
};
