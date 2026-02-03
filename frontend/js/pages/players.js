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
    if(10 < skill || 1 > skill) return toast("Skill 1 - 10 között lehet");
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

function normalizePlayer(apiPlayer) {
  return {
    id: apiPlayer.id,
    name: apiPlayer.name,
    skill: apiPlayer.skill,
    isGoalie: Boolean(apiPlayer.isGoalie),
  };
}

function buildPlayersTable(initialPlayers) {
  const table = el(`
    <table>
      <thead>
        <tr><th>Név</th><th>Skill</th><th>Kapus</th><th>Művelet</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `);

  const tbody = table.querySelector("tbody");

  let players = (initialPlayers ?? []).map(normalizePlayer);
  let editingId = null; // egyszerre 1 sor szerkeszthető (egyszerű és biztonságos)

  function render() {
    tbody.innerHTML = "";

    players.forEach(p => {
      const isEditing = editingId === p.id;
      const tr = el(`
        <tr data-player-id="${p.id}">
          <td class="name-cell">
            ${isEditing ? `<input data-field="name" type="text" value="${escapeHtml(p.name)}" />` : escapeHtml(p.name)}
          </td>
          <td class="skill-cell">
            ${isEditing ? `<input data-field="skill" type="number" min="1" max="10" step="1" value="${p.skill}" />` : fmtSkill(p.skill)}
          </td>
          <td class="goalie-cell">${goalieBadge(p.isGoalie)}</td>
          <td class="actions-cell">
            ${isEditing
          ? `
                <button data-action="save">Ment</button>
                <button data-action="cancel">Mégse</button>
                <button data-action="delete" class="danger">Töröl</button>
              `
          : `
                <button data-action="edit">Szerkeszt</button>
                <button data-action="toggle-goalie">Kapus vált</button>
                <button data-action="delete" class="danger">Töröl</button>
              `
      }
          </td>
        </tr>
      `);

      tbody.appendChild(tr);
    });
  }

  // minimális HTML escape, hogy input value / cella ne törje meg a DOM-ot
  function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
  }

  function setRowBusy(tr, isBusy) {
    tr.querySelectorAll("button, input").forEach(el => (el.disabled = isBusy));
  }

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const tr = btn.closest("tr");
    if (!tr) return;

    const playerId = Number(tr.dataset.playerId);
    const idx = players.findIndex(p => p.id === playerId);
    if (idx === -1) return;

    const action = btn.dataset.action;

    // Ha más sort szerkesztesz, és máshova kattintasz:
    // egyszerű szabály: előbb Mégse/Ment, vagy kattintásra automatikus Mégse.
    if (editingId !== null && editingId !== playerId) {
      // automatikus "cancel" a másik sorra (egyszerű UX)
      editingId = null;
      render();
      // újrarender után a kattintás célja már nem garantált, ezért kilépünk
      return;
    }

    if (action === "edit") {
      editingId = playerId;
      render();
      return;
    }

    if (action === "cancel") {
      editingId = null;
      render();
      return;
    }

    if (action === "toggle-goalie") {
      setRowBusy(tr, true);
      try {
        const updatedApiPlayer = await api.updatePlayer(playerId, { isGoalie: !players[idx].isGoalie });
        players[idx] = normalizePlayer(updatedApiPlayer);
        // csak a cellát frissítjük
        tr.querySelector(".goalie-cell").innerHTML = goalieBadge(players[idx].isGoalie);
      } catch (err) {
        console.error(err);
        alert("Nem sikerült frissíteni a kapus státuszt.");
      } finally {
        setRowBusy(tr, false);
      }
      return;
    }

    if (action === "save") {
      const nameInput = tr.querySelector('input[data-field="name"]');
      const skillInput = tr.querySelector('input[data-field="skill"]');

      const name = (nameInput?.value ?? "").trim();
      const skill = Number(skillInput?.value);

      if (!name) {
        alert("A név nem lehet üres.");
        nameInput?.focus();
        return;
      }
      if (!Number.isInteger(skill) || skill < 1 || skill > 10) {
        alert("A skill 1 és 10 közötti egész szám legyen.");
        skillInput?.focus();
        return;
      }

      setRowBusy(tr, true);
      try {
        const updatedApiPlayer = await api.updatePlayer(playerId, { name, skill });
        players[idx] = normalizePlayer(updatedApiPlayer);
        editingId = null;
        render();
      } catch (err) {
        console.error(err);
        alert("Nem sikerült menteni a játékos adatait.");
      } finally {
        // ha render történt, ez már nem releváns, de nem árt
        setRowBusy(tr, false);
      }
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Biztosan törlöd: ${players[idx].name}?`);
      if (!ok) return;

      setRowBusy(tr, true);
      try {
        await api.removePlayer(playerId);
        players = players.filter(p => p.id !== playerId);
        if (editingId === playerId) editingId = null;
        render();
      } catch (err) {
        console.error(err);
        alert("Nem sikerült törölni a játékost.");
        setRowBusy(tr, false);
      }
      return;
    }
  });

  render();
  return table;
}

