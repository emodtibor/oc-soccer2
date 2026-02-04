// frontend/js/pages/teams.js
import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, fmtSkill, goalieBadge, toast } from "../ui.js";

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

  const [savedTeams, players] = await Promise.all([
    api.getTeams(store.currentMatchId),
    api.listPlayers()
  ]);
  store.setTeams(savedTeams);
  store.setPlayers(players);
  if (!savedTeams.length && !generatedTeamsReady) {
    wrap.appendChild(el(`<div class="small">Még nincs elmentett csapat ehhez a meccshez.</div>`));
    renderTeamsEditor(wrap, root, [], players);
    return;
  }

  if (savedTeams.length) {
    renderTeamsList(wrap, savedTeams, "Elmentett csapatok");
  }
  renderTeamsEditor(wrap, root, savedTeams, players);
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

function renderTeamsEditor(container, root, teams, players) {
  const header = el(`<div class="small" style="margin:16px 0 6px 0;">Kézi szerkesztés</div>`);
  const editor = el(`<div class="panel team-editor"></div>`);
  const actions = el(`
    <div class="row" style="margin-bottom:8px;">
      <button id="addTeamBtn" class="primary">Új csapat</button>
    </div>
  `);
  const list = el(`<div></div>`);
  editor.appendChild(actions);
  editor.appendChild(list);
  container.appendChild(header);
  container.appendChild(editor);

  if (!teams.length) {
    list.appendChild(el(`<div class="small">Adj hozzá legalább egy csapatot.</div>`));
  }

  actions.querySelector("#addTeamBtn").onclick = async () => {
    try {
      await api.createTeam(store.currentMatchId);
      await renderTeams(root);
    } catch (err) {
      console.error(err);
      toast("Nem sikerült csapatot létrehozni.");
    }
  };

  teams.forEach(team => {
    const card = el(`
      <div class="team">
        <div class="row" style="justify-content:space-between;align-items:center;">
          <div>
            <strong>Csapat ${team.teamIndex + 1}</strong>
            <span class="small">(össz-skill: ${team.totalSkill})</span>
          </div>
          <button data-action="delete">Törlés</button>
        </div>
        <div class="team-editor-body"></div>
      </div>
    `);
    const body = card.querySelector(".team-editor-body");

    if (team.players.length) {
      team.players.forEach(player => {
        const row = el(`
          <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div>${player.name} ${fmtSkill(player.skill)} ${goalieBadge(player.isGoalie)}</div>
            <button data-action="remove">Eltávolítás</button>
          </div>
        `);
        row.querySelector("button[data-action=remove]").onclick = async () => {
          try {
            await api.removeTeamMember(store.currentMatchId, team.id, player.id);
            await renderTeams(root);
          } catch (err) {
            console.error(err);
            toast("Nem sikerült eltávolítani a játékost.");
          }
        };
        body.appendChild(row);
      });
    } else {
      body.appendChild(el(`<div class="small">Nincs játékos a csapatban.</div>`));
    }

    const availablePlayers = players.filter(p => !team.players.some(tp => tp.id === p.id));
    const select = el(`
      <div class="row" style="align-items:center;">
        <select class="input" style="flex:1;">
          <option value="">Játékos hozzáadása…</option>
          ${availablePlayers.map(p => `<option value="${p.id}">${p.name} (skill ${p.skill}${p.isGoalie ? ", kapus" : ""})</option>`).join("")}
        </select>
        <button data-action="add">Hozzáadás</button>
      </div>
    `);
    const selectEl = select.querySelector("select");
    select.querySelector("button[data-action=add]").onclick = async () => {
      const playerId = Number(selectEl.value);
      if (!playerId) return toast("Válassz játékost.");
      try {
        await api.addTeamMember(store.currentMatchId, team.id, playerId);
        await renderTeams(root);
      } catch (err) {
        console.error(err);
        toast("Nem sikerült hozzáadni a játékost.");
      }
    };
    body.appendChild(select);

    card.querySelector("button[data-action=delete]").onclick = async () => {
      try {
        await api.deleteTeam(store.currentMatchId, team.id);
        await renderTeams(root);
      } catch (err) {
        console.error(err);
        toast("Nem sikerült törölni a csapatot.");
      }
    };

    list.appendChild(card);
  });
}
