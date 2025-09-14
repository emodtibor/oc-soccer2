// frontend/js/pages/matches.js
import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, toast, fmtSkill, goalieBadge } from "../ui.js";

export async function renderMatches(root, onSelectedChange) {
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
    </div>
  `);

  root.appendChild(panel);

  // Betöltés
  const [matches, players] = await Promise.all([api.listMatches(), api.listPlayers()]);
  store.setMatches(matches);
  store.setPlayers(players);

  // Meccslista
  const mList = panel.querySelector("#matchesList");
  renderMatchList(mList, matches, async (matchId) => {
    store.setCurrentMatch(matchId);
    onSelectedChange?.(matchId);
    const current = await api.getParticipants(matchId);
    const ids = current.map(p => p.id);
    store.setParticipants(ids);
    renderParticipants(panel.querySelector("#participantsWrap"), players, ids, matchId);
  });

  // Új meccs
  panel.querySelector("#addMatchBtn").onclick = async () => {
    const date = panel.querySelector("#mDate").value;
    const location = panel.querySelector("#mLoc").value.trim();
    if (!date || !location) return toast("Dátum és helyszín kötelező.");
    const m = await api.createMatch({ date, location });
    const ms = await api.listMatches();
    store.setMatches(ms);
    renderMatchList(mList, ms);
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

function renderParticipants(container, players, selectedIds, matchId) {
  clear(container);
  const info = el(`<div style="margin-bottom:8px" class="small">Max 17 fő. Pipáld ki akik jönnek, majd „Mentés”.</div>`);
  const list = el(`<div style="max-height:400px;overflow:auto;margin-bottom:8px"></div>`);
  const actions = el(`
    <div class="row">
      <button id="savePartBtn" class="primary">Mentés</button>
      <button id="generateBtn">Csapatok generálása</button>
    </div>
  `);

  const idSet = new Set(selectedIds || []);
  players.forEach(p => {
    const row = el(`
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="checkbox" ${idSet.has(p.id) ? "checked":""} />
        <span>${p.name} ${fmtSkill(p.skill)} ${goalieBadge(p.isGoalie)}</span>
      </label>
    `);
    const cb = row.querySelector("input[type=checkbox]");
    cb.onchange = () => {
      if (cb.checked) { idSet.add(p.id); }
      else { idSet.delete(p.id); }
    };
    list.appendChild(row);
  });

  actions.querySelector("#savePartBtn").onclick = async () => {
    const ids = Array.from(idSet);
    if (ids.length > 17) return toast("Max 17 résztvevő engedélyezett.");
    await api.setParticipants(matchId, ids);
    toast("Résztvevők mentve.");
  };

  actions.querySelector("#generateBtn").onclick = async () => {
    // biztos ami biztos: mentsük a pipákat generálás előtt
    const ids = Array.from(idSet);
    if (ids.length === 0) return toast("Nincs kijelölt résztvevő.");
    if (ids.length > 17) return toast("Max 17 résztvevő engedélyezett.");
    await api.setParticipants(matchId, ids);
    const teams = await api.generateTeams(matchId);
    // a Teams fülön fogjuk kirajzolni; itt csak jelzünk
    toast("Csapatok legenerálva. Nézd meg a Csapatok fülön!");
  };

  container.appendChild(info);
  container.appendChild(list);
  container.appendChild(actions);
}
