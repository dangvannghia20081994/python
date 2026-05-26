// History stack: playlists + watch history + popover.

import { $, plistEl, plistEmpty, historyEl, historyEmpty, popover, popoverList, popoverInput, popoverForm } from "./dom.js";
import { playlists, playHistory, expandedPlaylists, savePlaylists, clearHistory } from "./state.js";
import { escapeHtml, fmtRelTime, uid } from "./util.js";
import { navigateToDetail } from "./pages.js";

// ===== Playlists =====
export function renderPlaylists() {
  plistEl.innerHTML = "";
  if (playlists.length === 0) { plistEmpty.style.display = ""; return; }
  plistEmpty.style.display = "none";
  for (const pl of playlists) {
    const wrap = document.createElement("div");
    const row = document.createElement("div");
    row.className = "pl-row";
    row.innerHTML = `
      <span class="pl-name" title="Bấm để xem bài">${escapeHtml(pl.name)}</span>
      <span class="pl-count">${pl.items.length}</span>
      <button data-act="rename" title="Đổi tên">✎</button>
      <button data-act="delete" title="Xoá">✕</button>`;
    row.querySelector(".pl-name").onclick = () => {
      if (expandedPlaylists.has(pl.id)) expandedPlaylists.delete(pl.id);
      else expandedPlaylists.add(pl.id);
      renderPlaylists();
    };
    row.querySelector('[data-act="rename"]').onclick = (e) => {
      e.stopPropagation();
      const name = prompt("Đổi tên playlist:", pl.name);
      if (name && name.trim()) { pl.name = name.trim(); savePlaylists(); renderPlaylists(); }
    };
    row.querySelector('[data-act="delete"]').onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Xoá playlist "${pl.name}"?`)) return;
      const i = playlists.findIndex((p) => p.id === pl.id);
      if (i >= 0) playlists.splice(i, 1);
      expandedPlaylists.delete(pl.id);
      savePlaylists();
      renderPlaylists();
    };
    wrap.appendChild(row);
    if (expandedPlaylists.has(pl.id)) {
      const songs = document.createElement("div");
      songs.className = "pl-songs";
      if (pl.items.length === 0) {
        songs.innerHTML = `<div class="panel-empty" style="padding:8px">Playlist trống.</div>`;
      } else {
        pl.items.forEach((it, idx) => {
          const s = document.createElement("div");
          s.className = "pl-song";
          s.innerHTML = `
            <span class="pl-song-title" title="${escapeHtml(it.title || "")}">${escapeHtml(it.title || "(không tiêu đề)")}</span>
            <button data-act="remove" title="Bỏ khỏi playlist">✕</button>`;
          s.querySelector(".pl-song-title").onclick = () => navigateToDetail(it);
          s.querySelector('[data-act="remove"]').onclick = () => {
            pl.items.splice(idx, 1);
            savePlaylists();
            renderPlaylists();
          };
          songs.appendChild(s);
        });
      }
      wrap.appendChild(songs);
    }
    plistEl.appendChild(wrap);
  }
}

export function createPlaylist(name, firstItem = null) {
  const pl = { id: uid(), name: name.trim(), items: firstItem ? [firstItem] : [] };
  playlists.push(pl);
  savePlaylists();
  renderPlaylists();
  return pl;
}

// ===== History =====
export function renderHistory() {
  historyEl.innerHTML = "";
  if (playHistory.length === 0) { historyEmpty.style.display = ""; return; }
  historyEmpty.style.display = "none";
  for (const it of playHistory) {
    const row = document.createElement("div");
    row.className = "history-row";
    row.innerHTML = `
      <img src="${it.thumbnail || ""}" alt="">
      <div class="history-meta">
        <div class="history-title">${escapeHtml(it.title || "")}</div>
        <div class="history-time">${fmtRelTime(it.playedAt)}</div>
      </div>`;
    row.onclick = () => navigateToDetail(it);
    historyEl.appendChild(row);
  }
}

// ===== Playlist popover (per-card "+ Playlist") =====
let popoverItem = null;

export function openPlPopover(anchor, item) {
  popoverItem = item;
  const r = anchor.getBoundingClientRect();
  popover.classList.remove("hidden");
  const w = 240;
  let left = r.right - w;
  let top = r.bottom + 6;
  if (left < 8) left = 8;
  if (top + 200 > window.innerHeight) top = r.top - 200 - 6;
  popover.style.left = left + "px";
  popover.style.top = top + "px";

  popoverList.innerHTML = "";
  if (playlists.length === 0) {
    popoverList.innerHTML = `<div class="pl-popover-empty">Chưa có playlist nào</div>`;
  } else {
    for (const pl of playlists) {
      const btn = document.createElement("button");
      btn.className = "pl-pick"; btn.type = "button";
      const exists = pl.items.some((x) => x.id === item.id);
      btn.textContent = `${pl.name} ${exists ? "✓" : ""}`;
      btn.disabled = exists;
      btn.onclick = () => {
        pl.items.push({
          id: item.id, title: item.title, uploader: item.uploader,
          thumbnail: item.thumbnail, duration: item.duration,
        });
        savePlaylists();
        renderPlaylists();
        closePlPopover();
      };
      popoverList.appendChild(btn);
    }
  }
  popoverInput.value = "";
  setTimeout(() => popoverInput.focus(), 0);
}

export function closePlPopover() {
  popover.classList.add("hidden");
  popoverItem = null;
}

export function attachPanels() {
  popoverForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = popoverInput.value.trim();
    if (!name || !popoverItem) return;
    createPlaylist(name, {
      id: popoverItem.id, title: popoverItem.title, uploader: popoverItem.uploader,
      thumbnail: popoverItem.thumbnail, duration: popoverItem.duration,
    });
    closePlPopover();
  });
  document.addEventListener("click", (e) => {
    if (popover.classList.contains("hidden")) return;
    if (popover.contains(e.target)) return;
    if (e.target.closest('[data-act="playlist"]')) return;
    closePlPopover();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !popover.classList.contains("hidden")) closePlPopover();
  });

  $("pl-create-btn").onclick = () => {
    const name = prompt("Tên playlist mới:");
    if (name && name.trim()) createPlaylist(name);
  };
  $("history-clear-btn").onclick = () => {
    if (!confirm("Xoá toàn bộ lịch sử?")) return;
    clearHistory();
    renderHistory();
  };
}
