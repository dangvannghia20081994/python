// Entry point: load persisted state, wire listeners, route initial URL.

import { loadPlaylists, loadHistory } from "./state.js";
import { attachVideoEvents } from "./video.js";
import { renderPlaylists, renderHistory, attachPanels } from "./panels.js";
import { attachHomeSearch, loadSuggestions, loadDetailById, showListView } from "./pages.js";
import { attachVoiceSearch } from "./voice.js";
import { attachShorts } from "./shorts.js";
import { attachBottomNav, switchStack } from "./stacks.js";

function bootstrap() {
  loadPlaylists();
  loadHistory();
  renderPlaylists();
  renderHistory();

  attachVideoEvents();
  attachPanels();
  attachHomeSearch();
  attachVoiceSearch();
  attachShorts();
  attachBottomNav();

  // Brand click → Home
  document.querySelector(".brand")?.addEventListener("click", () => {
    switchStack("home");
  });

  // SPA navigation for detail view (/watch?id=...)
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/watch" && params.get("id")) {
      switchStack("home");
      loadDetailById(params.get("id"));
    } else {
      showListView();
      loadSuggestions();
    }
  });

  // Initial route
  const initParams = new URLSearchParams(location.search);
  if (location.pathname === "/watch" && initParams.get("id")) {
    switchStack("home");
    loadDetailById(initParams.get("id"));
  } else {
    loadSuggestions();
  }
}

bootstrap();
