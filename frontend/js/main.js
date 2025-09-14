// frontend/js/main.js
import { renderPlayers } from "./pages/players.js";
import { renderMatches } from "./pages/matches.js";
import { renderTeams } from "./pages/teams.js";
import { store } from "./store.js";

const tabs = document.querySelectorAll(".tabs button");
const sections = {
  players: document.getElementById("tab-players"),
  matches: document.getElementById("tab-matches"),
  teams: document.getElementById("tab-teams"),
};

function activateTab(name) {
  tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(sections).forEach(([k, sec]) => sec.classList.toggle("active", k === name));
}

async function init() {
  // alap tab
  activateTab("players");
  await renderPlayers(sections.players);

  // tab váltás
  tabs.forEach(b => {
    b.onclick = async () => {
      activateTab(b.dataset.tab);
      if (b.dataset.tab === "players") {
        await renderPlayers(sections.players);
      } else if (b.dataset.tab === "matches") {
        await renderMatches(sections.matches, async () => {
          // ha meccs választás történt, a Teams fül frissüljön
          if (sections.teams.classList.contains("active")) {
            await renderTeams(sections.teams);
          }
        });
      } else if (b.dataset.tab === "teams") {
        await renderTeams(sections.teams);
      }
    };
  });

  // első betöltésnél töltsük a meccsek oldalt is (hogy azonnal választható legyen)
  await renderMatches(sections.matches, async () => {
    if (sections.teams.classList.contains("active")) {
      await renderTeams(sections.teams);
    }
  });
}

init();
