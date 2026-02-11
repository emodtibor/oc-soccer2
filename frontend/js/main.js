// frontend/js/main.js
import { renderPlayers } from "./pages/players.js";
import { renderMatches } from "./pages/matches.js";
import { renderGames } from "./pages/games.js";
import { renderStats } from "./pages/stats.js";
import { getAuthState, renderAuthControls } from "./auth.js";

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

function setTabVisibility(authState) {
  const allowedTabs = authState.isAuthenticated
    ? new Set(["players", "matches", "games", "stats"])
    : new Set(["games", "stats"]);

  tabs.forEach(button => {
    const visible = allowedTabs.has(button.dataset.tab);
    button.style.display = visible ? "" : "none";
  });
}

async function renderTab(tabName, authState) {
  if (tabName === "players") {
    await renderPlayers(sections.players);
  } else if (tabName === "matches") {
    await renderMatches(sections.matches);
  } else if (tabName === "games") {
    await renderGames(sections.games, { readOnly: !authState.isAuthenticated });
  } else if (tabName === "stats") {
    await renderStats(sections.stats);
  }
}

async function init() {
  const authControls = document.getElementById("authControls");

  let authState = await getAuthState();
  setTabVisibility(authState);

  const reloadAuthAndUi = async () => {
    authState = await getAuthState();
    setTabVisibility(authState);
    renderAuthControls(authControls, authState, reloadAuthAndUi);
    const firstTab = authState.isAuthenticated ? "players" : "games";
    activateTab(firstTab);
    await renderTab(firstTab, authState);
    if (authState.isAuthenticated) {
      await renderMatches(sections.matches);
    }
    await renderGames(sections.games, { readOnly: !authState.isAuthenticated });
    await renderStats(sections.stats);
  };

  renderAuthControls(authControls, authState, reloadAuthAndUi);

  // tab váltás
  tabs.forEach(b => {
    b.onclick = async () => {
      if (b.style.display === "none") return;
      activateTab(b.dataset.tab);
      await renderTab(b.dataset.tab, authState);
    };
  });

  await reloadAuthAndUi();
}

init();
