import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, toast } from "../ui.js";

export async function renderStats(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Statisztika</h2>
      <div class="row" style="align-items:center;margin-bottom:12px;">
        <label class="small" for="statsStartDate">Mettől:</label>
        <input id="statsStartDate" class="input" type="date" />
        <label class="small" for="statsEndDate">Meddig:</label>
        <input id="statsEndDate" class="input" type="date" />
        <button id="statsCalcBtn" class="primary">Számítás</button>
      </div>
      <div id="statsResults" class="small">Válassz időszakot a statisztikához.</div>
    </div>
  `);

  root.appendChild(panel);

  const [players, matches] = await Promise.all([api.listPlayers(), api.listMatches()]);
  store.setPlayers(players);
  store.setMatches(matches);

  const startInput = panel.querySelector("#statsStartDate");
  const endInput = panel.querySelector("#statsEndDate");
  const results = panel.querySelector("#statsResults");

  if (!players.length) {
    results.textContent = "Előbb adj hozzá játékosokat.";
    return;
  }

  const calculateStats = async () => {
    const startDate = startInput.value;
    const endDate = endInput.value;
    if (startDate && endDate && startDate > endDate) {
      return toast("A dátumtartomány nem érvényes.");
    }

    results.textContent = "Számítás folyamatban…";

    const stats = await buildStatsForPlayers({
      players,
      matches,
      startDate,
      endDate,
    });

    if (!stats.matchesInRange) {
      results.textContent = "Nincs meccs a kiválasztott időszakban.";
      return;
    }

    results.innerHTML = "";
    results.appendChild(renderSummaryTable(stats));
  };

  panel.querySelector("#statsCalcBtn").onclick = calculateStats;
}

function renderSummaryTable(statsPayload) {
  const { rows, matchesInRange } = statsPayload;
  let sortKey = "name";
  let sortDir = "asc";

  const headers = [
    { key: "name", label: "Játékos" },
    { key: "appearances", label: "Focizott alkalom" },
    { key: "goals", label: "Gól" },
    { key: "wins", label: "Győzelem" },
    { key: "draws", label: "Döntetlen" },
    { key: "losses", label: "Vereség" },
  ];

  const table = el(`
    <div class="panel">
      <div class="small" style="margin-bottom:8px;">Szűrt meccsek: ${matchesInRange}</div>
      <table class="stats-table">
        <thead>
          <tr>
            ${headers.map(h => `
              <th>
                <button class="sort-button" data-key="${h.key}" data-label="${h.label}">
                  ${h.label}
                  <span class="sort-indicator" aria-hidden="true"></span>
                </button>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `);

  const tbody = table.querySelector("tbody");

  const sortRows = () => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal, "hu", { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    tbody.innerHTML = "";
    sorted.forEach(row => {
      tbody.appendChild(el(`
        <tr>
          <td>${row.name}</td>
          <td>${row.appearances}</td>
          <td>${row.goals}</td>
          <td>${row.wins}</td>
          <td>${row.draws}</td>
          <td>${row.losses}</td>
        </tr>
      `));
    });

    table.querySelectorAll(".sort-button").forEach(button => {
      const key = button.dataset.key;
      button.classList.toggle("is-active", key === sortKey);
      button.dataset.dir = key === sortKey ? sortDir : "";
    });
  };

  table.querySelectorAll(".sort-button").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = key === "name" ? "asc" : "desc";
      }
      sortRows();
    });
  });

  sortRows();
  return table;
}

async function buildStatsForPlayers({ players, matches, startDate, endDate }) {
  const filtered = matches.filter(match => {
    if (startDate && match.date < startDate) return false;
    if (endDate && match.date > endDate) return false;
    return true;
  });

  const statsByPlayer = new Map(
    players.map(player => [
      player.id,
      {
        id: player.id,
        name: player.name,
        appearances: 0,
        goals: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
    ])
  );

  const summary = {
    matchesInRange: filtered.length,
  };

  for (const match of filtered) {
    const [participants, teams, gamesResponse] = await Promise.all([
      api.getParticipants(match.id),
      api.getTeams(match.id),
      api.listMatchGames(match.id),
    ]);

    const games = gamesResponse.games ?? [];
    const participantIds = new Set(participants.map(p => p.id));
    participantIds.forEach(playerId => {
      const record = statsByPlayer.get(playerId);
      if (record) record.appearances += 1;
    });

    const teamsById = new Map(teams.map(team => [team.id, team]));

    games.forEach(game => {
      const homeGoals = (game.goals ?? []).filter(g => g.scoring_team_id === game.home_team_id).length;
      const awayGoals = (game.goals ?? []).filter(g => g.scoring_team_id === game.away_team_id).length;

      const homeResult = homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "win" : "loss";
      const awayResult = homeGoals === awayGoals ? "draw" : awayGoals > homeGoals ? "win" : "loss";

      const applyResult = (teamId, result) => {
        const team = teamsById.get(teamId);
        if (!team) return;
        (team.players ?? []).forEach(player => {
          const record = statsByPlayer.get(player.id);
          if (!record) return;
          if (result === "win") record.wins += 1;
          if (result === "loss") record.losses += 1;
          if (result === "draw") record.draws += 1;
        });
      };

      applyResult(game.home_team_id, homeResult);
      applyResult(game.away_team_id, awayResult);

      (game.goals ?? []).forEach(goal => {
        if (!goal.scorer_player_id) return;
        const record = statsByPlayer.get(goal.scorer_player_id);
        if (record) record.goals += 1;
      });
    });
  }

  return {
    ...summary,
    rows: Array.from(statsByPlayer.values()),
  };
}
