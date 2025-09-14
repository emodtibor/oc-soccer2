// frontend/js/store.js
export const store = {
  players: [],
  matches: [],
  currentMatchId: null,
  participants: [],   // aktuális meccs résztvevői (id-k)
  teams: [],

  setPlayers(p) { this.players = p; },
  setMatches(m) { this.matches = m; },
  setCurrentMatch(id) { this.currentMatchId = id; },
  setParticipants(ids) { this.participants = ids; },
  setTeams(t) { this.teams = t; },
};
