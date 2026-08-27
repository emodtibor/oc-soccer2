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

function createClientRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTeamScore(game, teamId) {
  return game.goals.filter(goal => goal.scoring_team_id === teamId).length;
}

function getPlayerGoalCount(game, playerId) {
  return game.goals.filter(goal => (
    !goal.is_own_goal && goal.scorer_player_id === playerId
  )).length;
}

function computeTeamStandings(teams, games) {
  const standings = new Map(
    teams.map(team => [team.id, {
      teamId: team.id,
      teamIndex: team.teamIndex,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    }])
  );

  games.forEach(game => {
    const home = standings.get(game.home_team_id);
    const away = standings.get(game.away_team_id);
    if (!home || !away) return;

    const homeGoals = game.goals.filter(goal => goal.scoring_team_id === game.home_team_id).length;
    const awayGoals = game.goals.filter(goal => goal.scoring_team_id === game.away_team_id).length;

    home.played += 1;
    away.played += 1;

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (awayGoals > homeGoals) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return Array.from(standings.values()).sort((a, b) => (
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    a.teamIndex - b.teamIndex
  ));
}

function computeScorerTable(games) {
  const scorers = new Map();

  games.forEach(game => {
    game.goals.forEach(goal => {
      if (goal.is_own_goal || !goal.scorer_player_id) return;
      const existing = scorers.get(goal.scorer_player_id) || {
        playerId: goal.scorer_player_id,
        name: goal.scorer_name ?? "Ismeretlen",
        goals: 0,
      };
      existing.goals += 1;
      scorers.set(goal.scorer_player_id, existing);
    });
  });

  return Array.from(scorers.values()).sort((a, b) => (
    b.goals - a.goals || a.name.localeCompare(b.name, "hu")
  ));
}

function renderTablesSummary(container, teams, games) {
  const wrap = el(`<div class="summary-grid"></div>`);

  if (teams.length === 3) {
    const standings = computeTeamStandings(teams, games);
    const teamCount = teams.length;
    const standingsPanel = el(`
      <div class="panel">
        <h3>Csapat tabella</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Csapat</th>
              <th>M</th>
              <th>GY</th>
              <th>D</th>
              <th>V</th>
              <th>Gk</th>
              <th>P</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${getTeamName(row.teamIndex, teamCount)}</td>
                <td>${row.played}</td>
                <td>${row.wins}</td>
                <td>${row.draws}</td>
                <td>${row.losses}</td>
                <td>${row.goalsFor}-${row.goalsAgainst}</td>
                <td><strong>${row.points}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `);
    wrap.appendChild(standingsPanel);
  }

  const scorers = computeScorerTable(games);
  const scorersPanel = el(`
    <div class="panel">
      <h3>Góllövőlista</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Név</th>
            <th>Gól</th>
          </tr>
        </thead>
        <tbody>
          ${scorers.length
            ? scorers.map((row, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${row.name}</td>
                  <td><strong>${row.goals}</strong></td>
                </tr>
              `).join("")
            : `<tr><td colspan="3" class="small">Még nincs rögzített gólszerző.</td></tr>`}
        </tbody>
      </table>
    </div>
  `);
  wrap.appendChild(scorersPanel);

  container.appendChild(wrap);
}

export async function renderGames(root, { readOnly = false } = {}) {
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

  const getMatchTimestamp = (match) => {
    const ts = new Date(match.date).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  const latestMatch = matches.reduce((latest, current) => {
    if (!latest) return current;
    const currentTs = getMatchTimestamp(current);
    const latestTs = getMatchTimestamp(latest);
    if (currentTs > latestTs) return current;
    if (currentTs === latestTs && current.id > latest.id) return current;
    return latest;
  }, null);

  if (latestMatch) {
    select.value = String(latestMatch.id);
    await renderMatchGames(panel.querySelector("#gamesContent"), latestMatch.id, { readOnly });
  }

  select.onchange = async () => {
    const matchId = Number(select.value);
    if (!matchId) {
      panel.querySelector("#gamesContent").textContent = "Válassz meccset a listából.";
      return;
    }
    await renderMatchGames(panel.querySelector("#gamesContent"), matchId, { readOnly });
  };
}

async function renderMatchGames(container, matchId, { readOnly = false } = {}) {
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

  if (!readOnly) {
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
      await renderMatchGames(container, matchId, { readOnly });
    };

    actions.querySelector("#autoGamesBtn").onclick = async () => {
      try {
        await api.createMatchGamesAuto(matchId);
        await renderMatchGames(container, matchId, { readOnly });
      } catch (err) {
        console.error(err);
        toast("Nem sikerült automatikus párosításokat létrehozni.");
      }
    };

    container.appendChild(actions);
  }

  if (!games.length) {
    container.appendChild(el(`<div class="small">Még nincs mérkőzés rögzítve.</div>`));
    return;
  }

  const teamsById = new Map(teams.map(team => [team.id, team]));
  const teamCount = teams.length;

  const gamesWrap = el(`<div class="game-grid"></div>`);
  const summaryWrap = el(`<div class="games-summary"></div>`);
  const refreshSummary = () => {
    clear(summaryWrap);
    renderTablesSummary(summaryWrap, teams, games);
  };

  games.forEach(game => {
    const homeTeam = teamsById.get(game.home_team_id);
    const awayTeam = teamsById.get(game.away_team_id);
    const homeName = getTeamName(game.home_team_index, teamCount);
    const awayName = getTeamName(game.away_team_index, teamCount);

    const card = el(`
      <div class="panel game-card">
        <div class="live-scoreboard" aria-label="Eredmény">
          <div class="live-team-score">
            <span>${homeName}</span>
            <strong data-score="${game.home_team_id}">0</strong>
          </div>
          <span class="score-divider">:</span>
          <div class="live-team-score">
            <span>${awayName}</span>
            <strong data-score="${game.away_team_id}">0</strong>
          </div>
        </div>
        ${readOnly ? "" : `
          <p class="live-help small">Gólnál koppints egyszer a gólszerző nevére.</p>
          <div class="live-team-columns">
            <section class="live-team-panel team-index-${game.home_team_index}">
              <h4>${homeName}</h4>
              <div class="scorer-buttons" data-team-scorers="${game.home_team_id}"></div>
            </section>
            <section class="live-team-panel team-index-${game.away_team_index}">
              <h4>${awayName}</h4>
              <div class="scorer-buttons" data-team-scorers="${game.away_team_id}"></div>
            </section>
          </div>
          <div class="live-game-actions">
            <button class="undo-last-goal" type="button">↶ Utolsó gól visszavonása</button>
            <span class="goal-save-status small" role="status" aria-live="polite"></span>
          </div>
        `}
        <details class="game-history">
          <summary>Gólok részletei (<span class="goal-history-count">0</span>)</summary>
          <div class="game-goals"></div>
        </details>
        ${readOnly ? "" : `<div class="game-admin-actions"><button class="danger delete-game-btn" type="button" title="Mérkőzés törlése">Mérkőzés törlése</button></div>`}
      </div>
    `);

    let isSaving = false;
    const status = card.querySelector(".goal-save-status");
    const undoButton = card.querySelector(".undo-last-goal");

    const setStatus = (message, isError = false) => {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle("error", isError);
    };

    const setBusy = (busy) => {
      isSaving = busy;
      card.classList.toggle("is-saving", busy);
      card.querySelectorAll(".goal-action, .goal-delete, .undo-last-goal").forEach(button => {
        button.disabled = busy || (button.classList.contains("undo-last-goal") && !game.goals.length);
      });
    };

    const deleteGoal = async goal => {
      if (isSaving) return;
      setBusy(true);
      setStatus("Visszavonás…");
      try {
        await api.deleteGameGoal(game.id, goal.id);
        const index = game.goals.findIndex(item => item.id === goal.id);
        if (index >= 0) game.goals.splice(index, 1);
        setStatus("A gól visszavonva.");
        updateCard();
        refreshSummary();
      } catch (err) {
        console.error(err);
        setStatus("Nem sikerült visszavonni a gólt.", true);
        toast("Nem sikerült visszavonni a gólt.");
      } finally {
        setBusy(false);
      }
    };

    const renderGoalHistory = () => {
      const goalsWrap = card.querySelector(".game-goals");
      clear(goalsWrap);
      card.querySelector(".goal-history-count").textContent = String(game.goals.length);

      if (!game.goals.length) {
        goalsWrap.appendChild(el(`<div class="small">Még nincs gól.</div>`));
        return;
      }

      game.goals.forEach(goal => {
        const scorer = goal.is_own_goal ? "Öngól" : (goal.scorer_name ?? "Ismeretlen");
        const teamLabel = goal.scoring_team_id === game.home_team_id ? homeName : awayName;
        const ownGoalTag = goal.is_own_goal ? " (öngól)" : "";
        const row = el(`
          <div class="goal-row">
            <span>⚽ ${scorer} <span class="small">· ${teamLabel}${ownGoalTag}</span></span>
            ${readOnly ? "" : `<button class="goal-delete" type="button" title="Gól törlése">Törlés</button>`}
          </div>
        `);
        if (!readOnly) {
          row.querySelector(".goal-delete").onclick = () => deleteGoal(goal);
        }
        goalsWrap.appendChild(row);
      });
    };

    const addGoal = async (teamId, player = null) => {
      if (isSaving) return;
      setBusy(true);
      setStatus("Gól mentése…");
      try {
        const savedGoal = await api.addGameGoal(game.id, {
          scoring_team_id: teamId,
          scorer_player_id: player?.id ?? null,
          is_own_goal: false,
          client_request_id: createClientRequestId(),
        });
        if (!game.goals.some(goal => goal.id === savedGoal.id)) {
          game.goals.push(savedGoal);
        }
        setStatus(`Gól: ${player?.name ?? "ismeretlen gólszerző"}`);
        card.classList.remove("goal-saved");
        void card.offsetWidth;
        card.classList.add("goal-saved");
        updateCard();
        refreshSummary();
      } catch (err) {
        console.error(err);
        setStatus("Nem sikerült menteni a gólt.", true);
        toast("Nem sikerült menteni a gólt.");
      } finally {
        setBusy(false);
      }
    };

    const renderScorerButtons = (team, teamId) => {
      const wrap = card.querySelector(`[data-team-scorers="${teamId}"]`);
      if (!wrap) return;
      clear(wrap);

      (team?.players ?? []).forEach(player => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "goal-action scorer-button";
        button.setAttribute("aria-label", `${player.name} gól hozzáadása`);

        const name = document.createElement("span");
        name.className = "scorer-name";
        name.textContent = player.name;

        const count = document.createElement("span");
        count.className = "scorer-goal-count";
        count.textContent = `${getPlayerGoalCount(game, player.id)} ⚽`;

        button.append(name, count);
        button.onclick = () => addGoal(teamId, player);
        wrap.appendChild(button);
      });

      const unknownButton = document.createElement("button");
      unknownButton.type = "button";
      unknownButton.className = "goal-action unknown-scorer-button";
      unknownButton.textContent = "Nem láttam, ki volt";
      unknownButton.onclick = () => addGoal(teamId);
      wrap.appendChild(unknownButton);
    };

    function updateCard() {
      card.querySelector(`[data-score="${game.home_team_id}"]`).textContent = String(
        getTeamScore(game, game.home_team_id)
      );
      card.querySelector(`[data-score="${game.away_team_id}"]`).textContent = String(
        getTeamScore(game, game.away_team_id)
      );
      renderGoalHistory();
      if (!readOnly) {
        renderScorerButtons(homeTeam, game.home_team_id);
        renderScorerButtons(awayTeam, game.away_team_id);
        undoButton.disabled = isSaving || !game.goals.length;
      }
    }

    if (!readOnly) {
      undoButton.onclick = () => {
        const lastGoal = game.goals.at(-1);
        if (lastGoal) deleteGoal(lastGoal);
      };

      card.querySelector(".delete-game-btn").onclick = async () => {
        try {
          await api.deleteMatchGame(matchId, game.id);
          await renderMatchGames(container, matchId, { readOnly });
        } catch (err) {
          console.error(err);
          toast("Nem sikerült törölni a mérkőzést.");
        }
      };
    }

    updateCard();
    gamesWrap.appendChild(card);
  });

  container.appendChild(gamesWrap);
  container.appendChild(summaryWrap);
  refreshSummary();
}
