// frontend/js/pages/players.js
import { api } from "../api.js";
import { store } from "../store.js";
import { el, clear, fmtSkill, goalieBadge, toast } from "../ui.js";

export async function renderPlayers(root) {
  clear(root);

  const panel = el(`
    <div class="panel">
      <h2>Játékosok</h2>
      <div class="row" style="margin:8px 0;">
        <input id="pName" class="input" placeholder="Név" />
        <input id="pSkill" class="input" type="number" min="1" max="5" value="3" style="width:90px" />
        <label class="small"><input id="pGoalie" type="checkbox" /> Kapus?</label>
        <button id="addPlayerBtn" class="primary">Hozzáadás</button>
      </div>
      <div id="playersTableWrap"></div>
    </div>
  `);

  root.appendChild(panel);

  // betöltés
  const players = await api.listPlayers();
  store.setPlayers(players);

  const tableWrap = panel.querySelector("#playersTableWrap");
  tableWrap.appendChild(buildPlayersTable(players));

  panel.querySelector("#addPlayerBtn").onclick = async () => {
    const name = panel.querySelector("#pName").value.trim();
    const skill = parseInt(panel.querySelector("#pSkill").value, 10);
    const isGoalie = panel.querySelector("#pGoalie").checked;
    if (!name || isNaN(skill)) return toast("Név és skill kötelező.");
    await api.createPlayer({ name, skill, isGoalie });
    const players2 = await api.listPlayers();
    store.setPlayers(players2);
    clear(tableWrap);
    tableWrap.appendChild(buildPlayersTable(players2));
    panel.querySelector("#pName").value = "";
    panel.querySelector("#pSkill").value = "3";
    panel.querySelector("#pGoalie").checked = false;
  };
}

function buildPlayersTable(players) {
  const table = el(`
    <table>
      <thead>
        <tr><th>Név</th><th>Skill</th><th>Kapus</th><th>Művelet</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `);
  const tbody = table.querySelector("tbody");

  players.forEach(p => {
    const tr = el(`<tr>
      <td>${p.name}</td>
      <td>${fmtSkill(p.skill)}</td>
      <td>${goalieBadge(p.isGoalie)}</td>
      <td>
        <button data-action="toggle-goalie">Kapus vált</button>
      </td>
    </tr>`);
    tr.querySelector('[data-action="toggle-goalie"]').onclick = async () => {
      await api.updatePlayer(p.id, { isGoalie: !p.isGoalie });
      const updated = await api.listPlayers();
      tbody.innerHTML = "";
      updated.forEach(u => {
        const row = el(`<tr>
          <td>${u.name}</td>
          <td>${fmtSkill(u.skill)}</td>
          <td>${goalieBadge(u.isGoalie)}</td>
          <td><button class="small-btn" disabled>–</button></td>
        </tr>`);
        tbody.appendChild(row);
      });
    };
    tbody.appendChild(tr);
  });

  return table;
}
