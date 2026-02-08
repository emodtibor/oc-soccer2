// frontend/js/main.js
import { renderPlayers } from "./pages/players.js";
import { renderMatches } from "./pages/matches.js";
import { renderGames } from "./pages/games.js";
import { renderStats } from "./pages/stats.js";

const tabs = document.querySelectorAll(".tabs button");
const sections = {
  players: document.getElementById("tab-players"),
  matches: document.getElementById("tab-matches"),
  games: document.getElementById("tab-games"),
  stats: document.getElementById("tab-stats"),
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
        await renderMatches(sections.matches);
      } else if (b.dataset.tab === "games") {
        await renderGames(sections.games);
      } else if (b.dataset.tab === "stats") {
        await renderStats(sections.stats);
      }
    };
  });

  // első betöltésnél töltsük a meccsek oldalt is (hogy azonnal választható legyen)
  await renderMatches(sections.matches);
  await renderGames(sections.games);
  await renderStats(sections.stats);
}

init();
