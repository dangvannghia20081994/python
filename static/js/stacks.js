// Bottom-nav driven stack switching: Home / Shorts / History.

import { pauseAllShorts, ensureShortsLoaded } from "./shorts.js";
import { stopInlineVideo } from "./video.js";

const STACK_IDS = ["home", "shorts", "history"];
let activeStack = "home";

export function getActiveStack() { return activeStack; }

export function switchStack(name) {
  if (!STACK_IDS.includes(name)) return;
  const prev = activeStack;
  activeStack = name;
  document.querySelectorAll(".stack").forEach((s) => s.classList.toggle("active", s.dataset.stack === name));
  document.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.stack === name));
  // Leaving Home → stop any inline card playback so it doesn't surface as floating mini on other tabs.
  if (prev === "home" && name !== "home") stopInlineVideo();
  if (name === "shorts") ensureShortsLoaded();
  else pauseAllShorts();
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function attachBottomNav() {
  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchStack(btn.dataset.stack));
  });
}
