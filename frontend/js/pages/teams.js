// frontend/js/pages/teams.js
import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, fmtSkill, goalieBadge } from "../ui.js";

export async function renderTeams(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Csapatok</h2>
      <div id="teamsWrap" class="small">Válassz meccset a „Meccsek” fülön, majd generálj csapatokat.</div>
    </div>
  `);
  root.appendChild(panel);

  if (!store.currentMatchId) return;

  const wrap = panel.querySelector("#teamsWrap");
  clear(wrap);

  const generatedTeamsReady =
    store.generatedTeamsMatchId === store.currentMatchId &&
    Array.isArray(store.generatedTeams) &&
    store.generatedTeams.length > 0;

  if (generatedTeamsReady) {
    const actions = el(`
      <div class="row" style="margin-bottom:12px;">
        <button id="saveTeamsBtn" class="primary">OK (mentés)</button>
        <button id="regenTeamsBtn">Újra</button>
      </div>
    `);
    wrap.appendChild(actions);

    actions.querySelector("#saveTeamsBtn").onclick = async () => {
      try {
        const response = await api.saveGeneratedTeams(store.currentMatchId, store.generatedTeams);
        store.clearGeneratedTeams();
        store.setTeams(response.teams || []);
        await renderTeams(root);
      } catch (err) {
        console.error(err);
      }
    };

    actions.querySelector("#regenTeamsBtn").onclick = async () => {
      try {
        const response = await api.generateTeams(store.currentMatchId);
        store.setGeneratedTeams(store.currentMatchId, response.teams || []);
        await renderTeams(root);
      } catch (err) {
        console.error(err);
      }
    };

    renderTeamsList(wrap, store.generatedTeams, "Generált csapatok");
  }

  const savedTeams = await api.getTeams(store.currentMatchId);
  store.setTeams(savedTeams);
  if (!savedTeams.length && !generatedTeamsReady) {
    wrap.appendChild(el(`<div class="small">Még nincs elmentett csapat ehhez a meccshez.</div>`));
    return;
  }

  if (savedTeams.length) {
    renderTeamsList(wrap, savedTeams, "Elmentett csapatok");
  }
}

function renderTeamsList(container, teams, title) {
  const header = el(`<div class="small" style="margin:12px 0 6px 0;">${title}</div>`);
  container.appendChild(header);

  teams.forEach(t => {
    const card = el(`
      <div class="team">
        <h3>Csapat ${t.teamIndex + 1} <span class="small">(össz-skill: ${t.totalSkill})</span></h3>
        <div></div>
      </div>
    `);
    const list = card.querySelector("div");
    t.players.forEach(p => {
      list.appendChild(el(`<div>${p.name} ${fmtSkill(p.skill)} ${goalieBadge(p.isGoalie)}</div>`));
    });
    container.appendChild(card);
  });
}
