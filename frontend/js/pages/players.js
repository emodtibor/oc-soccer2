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
      <div class="row" style="margin:8px 0; gap:8px; flex-wrap:wrap;">
        <button id="exportPlayersBtn">Export (CSV)</button>
        <button id="importPlayersBtn">Import (CSV)</button>
        <input id="importPlayersFile" type="file" accept=".csv,text/csv" style="display:none" />
        <span class="small">Oszlopok: name, skill, isGoalie</span>
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

  const reloadPlayers = async () => {
    const latestPlayers = await api.listPlayers();
    store.setPlayers(latestPlayers);
    clear(tableWrap);
    tableWrap.appendChild(buildPlayersTable(latestPlayers));
    return latestPlayers;
  };

  panel.querySelector("#addPlayerBtn").onclick = async () => {
    const name = panel.querySelector("#pName").value.trim();
    const skill = parseInt(panel.querySelector("#pSkill").value, 10);
    const isGoalie = panel.querySelector("#pGoalie").checked;
    if (!name || isNaN(skill)) return toast("Név és skill kötelező.");
    if(10 < skill || 1 > skill) return toast("Skill 1 - 10 között lehet");
    await api.createPlayer({ name, skill, isGoalie });
    await reloadPlayers();
    panel.querySelector("#pName").value = "";
    panel.querySelector("#pSkill").value = "3";
    panel.querySelector("#pGoalie").checked = false;
  };

  const importBtn = panel.querySelector("#importPlayersBtn");
  const exportBtn = panel.querySelector("#exportPlayersBtn");
  const importFile = panel.querySelector("#importPlayersFile");

  exportBtn.onclick = async () => {
    const latestPlayers = await api.listPlayers();
    store.setPlayers(latestPlayers);
    const csv = buildPlayersCsv(latestPlayers);
    downloadCsv(csv, `jatekosok-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  importBtn.onclick = () => importFile.click();

  importFile.onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { rows, skipped } = parsePlayersCsv(text);
      if (!rows.length) {
        toast("Nincs importálható sor.");
        return;
      }

      let created = 0;
      let failed = 0;
      for (const player of rows) {
        try {
          await api.createPlayer(player);
          created += 1;
        } catch (err) {
          console.error(err);
          failed += 1;
        }
      }

      await reloadPlayers();
      const parts = [`Import kész: ${created} új játékos.`];
      if (skipped) parts.push(`${skipped} sor kihagyva.`);
      if (failed) parts.push(`${failed} sor hibás.`);
      toast(parts.join(" "));
    } finally {
      importFile.value = "";
    }
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

function buildPlayersCsv(players) {
  const header = ["name", "skill", "isGoalie"];
  const rows = players.map((player) => [
    csvEscape(player.name),
    player.skill,
    player.isGoalie ? "true" : "false",
  ]);
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/["\n,]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parsePlayersCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return { rows: [], skipped: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const parsed = lines.map((line) => parseCsvLine(line, delimiter));
  const header = parsed[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.includes("name") || header.includes("skill") || header.includes("isgoalie");
  const startIndex = hasHeader ? 1 : 0;

  let skipped = 0;
  const rows = [];

  for (let i = startIndex; i < parsed.length; i += 1) {
    const row = parsed[i];
    if (!row.length) continue;

    const name = getCsvValue(row, header, "name", 0, hasHeader)?.trim();
    const skillRaw = getCsvValue(row, header, "skill", 1, hasHeader);
    const goalieRaw = getCsvValue(row, header, "isgoalie", 2, hasHeader);

    const skill = Number(skillRaw);
    if (!name || !Number.isFinite(skill) || skill < 1 || skill > 10) {
      skipped += 1;
      continue;
    }

    rows.push({
      name,
      skill,
      isGoalie: parseBoolean(goalieRaw),
    });
  }

  return { rows, skipped };
}

function detectDelimiter(line) {
  const commaCount = (line.match(/,/g) ?? []).length;
  const semicolonCount = (line.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function getCsvValue(row, header, key, fallbackIndex, hasHeader) {
  if (!hasHeader) return row[fallbackIndex] ?? "";
  const idx = header.indexOf(key);
  if (idx === -1) return row[fallbackIndex] ?? "";
  return row[idx] ?? "";
}

function parseBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "igen", "yes", "y", "kapus"].includes(normalized);
}

