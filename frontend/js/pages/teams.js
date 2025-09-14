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

  const teams = await api.getTeams(store.currentMatchId);
  const wrap = panel.querySelector("#teamsWrap");
  clear(wrap);

  if (!teams.length) {
    wrap.appendChild(el(`<div class="small">Még nincs elmentett csapat ehhez a meccshez.</div>`));
    return;
  }

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
    wrap.appendChild(card);
  });
}
