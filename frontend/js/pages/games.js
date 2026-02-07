import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, toast } from "../ui.js";

const TEAM_NAMES_BY_COUNT = {
  2: ["Fekete", "Fehér"],
  3: ["Fekete", "Fehér", "Megküli"]
};

function getTeamName(teamIndex, teamCount) {
  const names = TEAM_NAMES_BY_COUNT[teamCount];
  return names?.[teamIndex] ?? `Csapat ${teamIndex + 1}`;
}

function buildTeamOptions(teams) {
  const count = teams.length;
  return teams
    .map(team => `<option value="${team.id}">${getTeamName(team.teamIndex, count)}</option>`)
    .join("");
}

function buildPlayerOptions(players) {
  return players.map(player => `<option value="${player.id}">${player.name}</option>`).join("");
}

export async function renderGames(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Mérkőzések</h2>
      <div class="row" style="align-items:center;margin-bottom:12px;">
        <label class="small" for="gamesMatchSelect">Meccs:</label>
        <select id="gamesMatchSelect" class="input" style="min-width:220px;"></select>
      </div>
      <div id="gamesContent" class="small">Válassz meccset a listából.</div>
    </div>
  `);

  root.appendChild(panel);

  const matches = await api.listMatches();
  store.setMatches(matches);

  const select = panel.querySelector("#gamesMatchSelect");
  select.innerHTML = `<option value="">Meccs kiválasztása…</option>` +
    matches.map(m => `<option value="${m.id}">${m.date} · ${m.location}</option>`).join("");

  select.onchange = async () => {
    const matchId = Number(select.value);
    if (!matchId) {
      panel.querySelector("#gamesContent").textContent = "Válassz meccset a listából.";
      return;
    }
    await renderMatchGames(panel.querySelector("#gamesContent"), matchId);
  };
}

async function renderMatchGames(container, matchId) {
  clear(container);

  const [teams, gamesResponse] = await Promise.all([
    api.getTeams(matchId),
    api.listMatchGames(matchId)
  ]);

  store.setTeams(teams);
  const games = gamesResponse.games ?? [];

  if (teams.length < 2) {
    container.appendChild(el(`<div class="small">Előbb hozz létre legalább 2 csapatot a Meccsek fülön.</div>`));
    return;
  }

  const actions = el(`
    <div class="panel game-actions">
      <h3>Új mérkőzés</h3>
      <div class="row" style="align-items:center;">
        <select id="homeTeamSelect" class="input"></select>
        <span class="small">vs</span>
        <select id="awayTeamSelect" class="input"></select>
        <button id="addGameBtn" class="primary">Hozzáadás</button>
      </div>
      <div class="row">
        <button id="autoGamesBtn">Ajánlott párosítások</button>
        <span class="small">2 vagy 3 csapat esetén automatikus körmérkőzés.</span>
      </div>
    </div>
  `);

  const teamOptions = buildTeamOptions(teams);
  actions.querySelector("#homeTeamSelect").innerHTML = teamOptions;
  actions.querySelector("#awayTeamSelect").innerHTML = teamOptions;

  actions.querySelector("#addGameBtn").onclick = async () => {
    const homeTeamId = Number(actions.querySelector("#homeTeamSelect").value);
    const awayTeamId = Number(actions.querySelector("#awayTeamSelect").value);
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      return toast("Két különböző csapatot válassz.");
    }
    await api.createMatchGame(matchId, homeTeamId, awayTeamId);
    await renderMatchGames(container, matchId);
  };

  actions.querySelector("#autoGamesBtn").onclick = async () => {
    try {
      await api.createMatchGamesAuto(matchId);
      await renderMatchGames(container, matchId);
    } catch (err) {
      console.error(err);
      toast("Nem sikerült automatikus párosításokat létrehozni.");
    }
  };

  container.appendChild(actions);

  if (!games.length) {
    container.appendChild(el(`<div class="small">Még nincs mérkőzés rögzítve.</div>`));
    return;
  }

  const teamsById = new Map(teams.map(team => [team.id, team]));
  const teamCount = teams.length;
  const playerTeamMap = new Map();
  teams.forEach(team => {
    team.players.forEach(player => playerTeamMap.set(player.id, team.id));
  });

  const gamesWrap = el(`<div class="game-grid"></div>`);

  games.forEach(game => {
    const homeTeam = teamsById.get(game.home_team_id);
    const awayTeam = teamsById.get(game.away_team_id);
    const homeName = getTeamName(game.home_team_index, teamCount);
    const awayName = getTeamName(game.away_team_index, teamCount);

    const score = {
      home: game.goals.filter(g => g.scoring_team_id === game.home_team_id).length,
      away: game.goals.filter(g => g.scoring_team_id === game.away_team_id).length,
    };

    const card = el(`
      <div class="panel game-card">
        <div class="game-score">
          <div>
            <strong>${homeName}</strong>
            <span class="small">(${homeTeam?.players.length ?? 0} játékos)</span>
          </div>
          <div class="score-pill">${score.home} : ${score.away}</div>
          <div>
            <strong>${awayName}</strong>
            <span class="small">(${awayTeam?.players.length ?? 0} játékos)</span>
          </div>
        </div>
        <div class="game-goals"></div>
        <div class="game-form"></div>
      </div>
    `);

    const goalsWrap = card.querySelector(".game-goals");
    if (!game.goals.length) {
      goalsWrap.appendChild(el(`<div class="small">Még nincs gól.</div>`));
    } else {
      game.goals.forEach(goal => {
        const scorer = goal.scorer_name ?? "Ismeretlen";
        const teamLabel = goal.scoring_team_id === game.home_team_id ? homeName : awayName;
        const ownGoalTag = goal.is_own_goal ? " (öngól)" : "";
        goalsWrap.appendChild(
          el(`<div class="goal-row">⚽ ${scorer} <span class="small">· ${teamLabel}${ownGoalTag}</span></div>`)
        );
      });
    }

    const form = card.querySelector(".game-form");
    const homePlayers = homeTeam?.players ?? [];
    const awayPlayers = awayTeam?.players ?? [];
    const allPlayers = [...homePlayers, ...awayPlayers];
    form.innerHTML = `
      <select class="input scorer-select">
        <option value="">Gólszerző…</option>
        ${buildPlayerOptions(allPlayers)}
      </select>
      <select class="input scoring-team-select">
        <option value="${game.home_team_id}">${homeName}</option>
        <option value="${game.away_team_id}">${awayName}</option>
      </select>
      <label class="small own-goal-toggle">
        <input type="checkbox" />
        Öngól
      </label>
      <button class="primary add-goal-btn">Gól hozzáadása</button>
    `;

    const scorerSelect = form.querySelector(".scorer-select");
    const teamSelect = form.querySelector(".scoring-team-select");
    const ownGoalToggle = form.querySelector(".own-goal-toggle input");
    const addGoalBtn = form.querySelector(".add-goal-btn");

    const updateTeamSelectForOwnGoal = () => {
      const scorerId = Number(scorerSelect.value);
      const scorerTeamId = playerTeamMap.get(scorerId);
      if (!ownGoalToggle.checked) {
        teamSelect.disabled = false;
        return;
      }
      teamSelect.disabled = true;
      if (scorerTeamId === game.home_team_id) {
        teamSelect.value = String(game.away_team_id);
      } else if (scorerTeamId === game.away_team_id) {
        teamSelect.value = String(game.home_team_id);
      }
    };

    scorerSelect.onchange = updateTeamSelectForOwnGoal;
    ownGoalToggle.onchange = updateTeamSelectForOwnGoal;

    addGoalBtn.onclick = async () => {
      const scorerId = Number(scorerSelect.value);
      if (!scorerId) {
        return toast("Válassz gólszerzőt.");
      }
      const payload = {
        scoring_team_id: Number(teamSelect.value),
        scorer_player_id: scorerId,
        is_own_goal: ownGoalToggle.checked,
      };
      try {
        await api.addGameGoal(game.id, payload);
        await renderMatchGames(container, matchId);
      } catch (err) {
        console.error(err);
        toast("Nem sikerült menteni a gólt.");
      }
    };

    gamesWrap.appendChild(card);
  });

  container.appendChild(gamesWrap);
}
