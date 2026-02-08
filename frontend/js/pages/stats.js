import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, toast } from "../ui.js";

export async function renderStats(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Statisztika</h2>
      <div class="row" style="align-items:center;margin-bottom:12px;">
        <label class="small" for="statsPlayerSelect">Játékos:</label>
        <select id="statsPlayerSelect" class="input" style="min-width:220px;"></select>
        <label class="small" for="statsStartDate">Mettől:</label>
        <input id="statsStartDate" class="input" type="date" />
        <label class="small" for="statsEndDate">Meddig:</label>
        <input id="statsEndDate" class="input" type="date" />
        <button id="statsCalcBtn" class="primary">Számítás</button>
      </div>
      <div id="statsResults" class="small">Válassz játékost és időszakot a statisztikához.</div>
    </div>
  `);

  root.appendChild(panel);

  const [players, matches] = await Promise.all([api.listPlayers(), api.listMatches()]);
  store.setPlayers(players);
  store.setMatches(matches);

  const playerSelect = panel.querySelector("#statsPlayerSelect");
  const startInput = panel.querySelector("#statsStartDate");
  const endInput = panel.querySelector("#statsEndDate");
  const results = panel.querySelector("#statsResults");

  if (!players.length) {
    playerSelect.innerHTML = `<option value="">Nincs játékos</option>`;
    results.textContent = "Előbb adj hozzá játékosokat.";
    return;
  }

  playerSelect.innerHTML = `<option value="">Játékos kiválasztása…</option>` +
    players.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  const renderSummary = (stats) => {
    results.innerHTML = "";
    results.appendChild(el(`
      <div class="stats-grid">
        <div class="panel stat-card">
          <div class="stat-value">${stats.appearances}</div>
          <div class="small">Focizott alkalom</div>
        </div>
        <div class="panel stat-card">
          <div class="stat-value">${stats.goals}</div>
          <div class="small">Lőtt gól</div>
        </div>
        <div class="panel stat-card">
          <div class="stat-value">${stats.wins}</div>
          <div class="small">Győztes csapat</div>
        </div>
        <div class="panel stat-card">
          <div class="stat-value">${stats.draws}</div>
          <div class="small">Döntetlen</div>
        </div>
        <div class="panel stat-card">
          <div class="stat-value">${stats.losses}</div>
          <div class="small">Vesztes csapat</div>
        </div>
      </div>
      <div class="small" style="margin-top:8px;">
        Szűrt meccsek: ${stats.matchesInRange}, értékelt mérkőzések: ${stats.gamesCount}.
        ${stats.teamlessAppearances ? `A játékos ${stats.teamlessAppearances} alkalommal nem volt csapatba sorolva.` : ""}
      </div>
    `));
  };

  const calculateStats = async () => {
    const playerId = Number(playerSelect.value);
    if (!playerId) {
      return toast("Válassz játékost.");
    }
    const startDate = startInput.value;
    const endDate = endInput.value;
    if (startDate && endDate && startDate > endDate) {
      return toast("A dátumtartomány nem érvényes.");
    }

    results.textContent = "Számítás folyamatban…";

    const stats = await buildStatsForPlayer({
      playerId,
      matches,
      startDate,
      endDate,
    });

    if (!stats.matchesInRange) {
      results.textContent = "Nincs meccs a kiválasztott időszakban.";
      return;
    }

    renderSummary(stats);
  };

  panel.querySelector("#statsCalcBtn").onclick = calculateStats;
}

async function buildStatsForPlayer({ playerId, matches, startDate, endDate }) {
  const filtered = matches.filter(match => {
    if (startDate && match.date < startDate) return false;
    if (endDate && match.date > endDate) return false;
    return true;
  });

  const stats = {
    matchesInRange: filtered.length,
    appearances: 0,
    goals: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesCount: 0,
    teamlessAppearances: 0,
  };

  for (const match of filtered) {
    const [participants, teams, gamesResponse] = await Promise.all([
      api.getParticipants(match.id),
      api.getTeams(match.id),
      api.listMatchGames(match.id),
    ]);

    const participantIds = new Set(participants.map(p => p.id));
    const isParticipant = participantIds.has(playerId);
    if (isParticipant) {
      stats.appearances += 1;
    }

    const team = teams.find(t => (t.players ?? []).some(player => player.id === playerId));
    if (!team && isParticipant) {
      stats.teamlessAppearances += 1;
    }

    const games = gamesResponse.games ?? [];
    for (const game of games) {
      for (const goal of game.goals ?? []) {
        if (goal.scorer_player_id === playerId) {
          stats.goals += 1;
        }
      }

      if (!team) continue;
      if (game.home_team_id !== team.id && game.away_team_id !== team.id) {
        continue;
      }

      stats.gamesCount += 1;

      const homeGoals = (game.goals ?? []).filter(g => g.scoring_team_id === game.home_team_id).length;
      const awayGoals = (game.goals ?? []).filter(g => g.scoring_team_id === game.away_team_id).length;

      if (homeGoals === awayGoals) {
        stats.draws += 1;
        continue;
      }

      const teamIsHome = game.home_team_id === team.id;
      const teamWon = teamIsHome ? homeGoals > awayGoals : awayGoals > homeGoals;
      if (teamWon) {
        stats.wins += 1;
      } else {
        stats.losses += 1;
      }
    }
  }

  return stats;
}
