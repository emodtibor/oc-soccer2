// frontend/js/store.js
export const store = {
  players: [],
  matches: [],
  currentMatchId: null,
  participants: [],   // aktuális meccs résztvevői (id-k)
  teams: [],
  generatedTeams: null,
  generatedTeamsMatchId: null,

  setPlayers(p) { this.players = p; },
  setMatches(m) { this.matches = m; },
  setCurrentMatch(id) { this.currentMatchId = id; },
  setParticipants(ids) { this.participants = ids; },
  setTeams(t) { this.teams = t; },
  setGeneratedTeams(matchId, teams) {
    this.generatedTeamsMatchId = matchId;
    this.generatedTeams = teams;
  },
  clearGeneratedTeams() {
    this.generatedTeamsMatchId = null;
    this.generatedTeams = null;
  },
};
