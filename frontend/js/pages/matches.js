// frontend/js/pages/matches.js
import { api } from "../api.js";
import { store } from "../store.js";
import { renderTeams } from "./teams.js";
import { el, clear, toast, fmtSkill, goalieBadge } from "../ui.js";

export async function renderMatches(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Meccsek</h2>
      <div class="row" style="margin:8px 0;">
        <input id="mDate" class="input" type="date" />
        <input id="mLoc" class="input" placeholder="Helyszín" />
        <button id="addMatchBtn" class="primary">Új meccs</button>
      </div>

      <div class="row" style="gap:20px">
        <div style="flex:1" class="panel">
          <h3>Lista</h3>
          <div id="matchesList"></div>
        </div>
        <div style="flex:2" class="panel">
          <h3>Résztvevők</h3>
          <div id="participantsWrap" class="small">Válassz meccset a listából!</div>
        </div>
      </div>
      <div id="teamsPanel" style="margin-top:20px;"></div>
    </div>
  `);

  root.appendChild(panel);

  // Betöltés
  const [matches, players] = await Promise.all([api.listMatches(), api.listPlayers()]);
  store.setMatches(matches);
  store.setPlayers(players);

  // Meccslista
  const mList = panel.querySelector("#matchesList");
  const teamsPanel = panel.querySelector("#teamsPanel");
  const handleMatchSelect = async (matchId) => {
    store.setCurrentMatch(matchId);
    const current = await api.getParticipants(matchId);
    const ids = current.map(p => p.id);
    store.setParticipants(ids);
    renderParticipants(panel.querySelector("#participantsWrap"), players, ids, matchId, teamsPanel);
    await renderTeams(teamsPanel);
  };
  renderMatchList(mList, matches, handleMatchSelect);
  await renderTeams(teamsPanel);

  // Új meccs
  panel.querySelector("#addMatchBtn").onclick = async () => {
    const date = panel.querySelector("#mDate").value;
    const location = panel.querySelector("#mLoc").value.trim();
    if (!date || !location) return toast("Dátum és helyszín kötelező.");
    const m = await api.createMatch({ date, location });
    const ms = await api.listMatches();
    store.setMatches(ms);
    renderMatchList(mList, ms, handleMatchSelect);
    panel.querySelector("#mDate").value = "";
    panel.querySelector("#mLoc").value = "";
  };
}

function renderMatchList(container, matches, onSelect) {
  clear(container);
  if (!matches.length) {
    container.appendChild(el(`<div class="small">Még nincs meccs.</div>`));
    return;
  }
  const ul = el(`<div></div>`);
  matches.forEach(m => {
    const btn = el(`<button style="display:block;width:100%;text-align:left;margin-bottom:6px">${m.date} · ${m.location}</button>`);
    btn.onclick = () => onSelect?.(m.id);
    ul.appendChild(btn);
  });
  container.appendChild(ul);
}

function renderParticipants(container, players, selectedIds, matchId, teamsPanel) {
  clear(container);
  const MAX_FIELDERS = 15;
  const MAX_GOALIES = 3;
  const limitMessage = `Max ${MAX_FIELDERS} mezőnyjátékos és ${MAX_GOALIES} kapus választható.`;
  const info = el(`<div style="margin-bottom:8px" class="small">${limitMessage} Pipáld ki akik jönnek, majd „Mentés”.</div>`);
  const list = el(`<div style="max-height:400px;overflow:auto;margin-bottom:8px"></div>`);
  const actions = el(`
    <div class="row">
      <button id="savePartBtn" class="primary">Mentés</button>
      <button id="generateBtn">Csapatok generálása</button>
    </div>
  `);

  const idSet = new Set(selectedIds || []);
  const playerById = new Map(players.map(p => [p.id, p]));
  const getCounts = () => {
    let goalies = 0;
    let fielders = 0;
    idSet.forEach(id => {
      const player = playerById.get(id);
      if (!player) return;
      if (player.isGoalie) goalies += 1;
      else fielders += 1;
    });
    return { goalies, fielders };
  };
  const validateSelection = () => {
    const { goalies, fielders } = getCounts();
    if (goalies > MAX_GOALIES || fielders > MAX_FIELDERS) {
      toast(limitMessage);
      return false;
    }
    return true;
  };

  players.forEach(p => {
    const row = el(`
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="checkbox" ${idSet.has(p.id) ? "checked":""} />
        <span>${p.name} ${fmtSkill(p.skill)} ${goalieBadge(p.isGoalie)}</span>
      </label>
    `);
    const cb = row.querySelector("input[type=checkbox]");
    cb.onchange = () => {
      if (cb.checked) {
        idSet.add(p.id);
        if (!validateSelection()) {
          idSet.delete(p.id);
          cb.checked = false;
        }
      } else {
        idSet.delete(p.id);
      }
    };
    list.appendChild(row);
  });

  actions.querySelector("#savePartBtn").onclick = async () => {
    const ids = Array.from(idSet);
    if (!validateSelection()) return;
    await api.setParticipants(matchId, ids);
    toast("Résztvevők mentve.");
  };

  actions.querySelector("#generateBtn").onclick = async () => {
    // biztos ami biztos: mentsük a pipákat generálás előtt
    const ids = Array.from(idSet);
    if (ids.length === 0) return toast("Nincs kijelölt résztvevő.");
    if (!validateSelection()) return;
    try {
      await api.setParticipants(matchId, ids);
      const saved = await api.generateTeams(matchId);
      store.clearGeneratedTeams();
      store.setTeams(saved.teams || []);
      await renderTeams(teamsPanel);
      toast("Generált csapatok mentve.");
    } catch (err) {
      console.error(err);
      toast("Nem sikerült csapatokat generálni.");
    }
  };

  container.appendChild(info);
  container.appendChild(list);
  container.appendChild(actions);
}
