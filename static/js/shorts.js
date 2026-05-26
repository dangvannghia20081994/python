// Shorts stack: vertical scroll-snap feed with its own search.

import { $ } from "./dom.js";
import { escapeHtml, loaderHTML, normalizeQuery } from "./util.js";
import { videoStreamUrl } from "./api.js";
import { openPlPopover } from "./panels.js";
import { pushHistoryItem } from "./state.js";
import { renderHistory } from "./panels.js";

const FALLBACK_QUERY = "#shorts";
let observer = null;
// Always start muted on each page load — browsers only allow unmuted autoplay after a user gesture
// inside the current document. Persisting "unmuted" across reloads causes play() to be blocked → frozen poster.
let currentMuted = true;
let lastQuery = FALLBACK_QUERY;
let hasLoaded = false;

function applyMuted(muted) {
  currentMuted = muted;
  document.querySelectorAll(".short-video").forEach((v) => (v.muted = muted));
  document.querySelectorAll('[data-act="mute"]').forEach((b) => (b.textContent = muted ? "🔇" : "🔊"));
  document.querySelectorAll(".short-unmute-hint").forEach((h) => h.classList.toggle("hidden", !muted));
}

function safePlay(video) {
  // Always try muted first to satisfy autoplay policy; tap-to-unmute handles sound.
  if (!video.muted && currentMuted) video.muted = true;
  return video.play().catch((err) => {
    // If even muted play fails, the user hasn't interacted yet — force-mute then retry once.
    if (!video.muted) {
      video.muted = true;
      return video.play().catch((err2) => console.warn("short play blocked:", err2));
    }
    console.warn("short play blocked:", err);
  });
}

function buildSlide(it) {
  const slide = document.createElement("div");
  slide.className = "short-slide";
  slide.dataset.id = it.id;
  slide.innerHTML = `
    <video class="short-video" loop playsinline preload="metadata" ${currentMuted ? "muted" : ""}
           poster="${it.thumbnail || ""}"></video>
    <button class="short-unmute-hint ${currentMuted ? "" : "hidden"}" type="button" aria-label="Bật tiếng">
      <span>🔇 Chạm để bật tiếng</span>
    </button>
    <div class="short-overlay">
      <div class="short-meta">
        <div class="short-title">${escapeHtml(it.title || "")}</div>
        <div class="short-uploader">@${escapeHtml(it.uploader || "")}</div>
      </div>
    </div>
    <div class="short-actions">
      <button data-act="mute" title="Bật/tắt tiếng">${currentMuted ? "🔇" : "🔊"}</button>
      <button data-act="playlist" title="+ Playlist">⊕</button>
    </div>`;
  const video = slide.querySelector(".short-video");
  slide._item = it;
  // Tap on video: if muted → unmute (browser autoplay-with-sound becomes allowed after this gesture).
  // Otherwise toggle play/pause. Always retry play to recover from any blocked initial autoplay.
  video.addEventListener("click", () => {
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    if (video.muted) {
      applyMuted(false);
      video.play().catch((e) => console.warn("unmute play failed:", e));
    } else if (video.paused) {
      video.play().catch((e) => console.warn("play failed:", e));
    } else {
      video.pause();
    }
  });
  slide.querySelector(".short-unmute-hint").onclick = (e) => {
    e.stopPropagation();
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    applyMuted(false);
    video.play().catch((err) => console.warn("hint unmute failed:", err));
  };
  slide.querySelector('[data-act="mute"]').onclick = (e) => {
    e.stopPropagation();
    if (!video.src) video.src = videoStreamUrl(slide._item.id);
    applyMuted(!currentMuted);
    video.play().catch((err) => console.warn("toggle mute play failed:", err));
  };
  slide.querySelector('[data-act="playlist"]').onclick = (e) => { e.stopPropagation(); openPlPopover(e.currentTarget, it); };
  return slide;
}

function setupObserver(feed) {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const slide = e.target;
      const video = slide.querySelector(".short-video");
      if (!video) continue;
      if (e.intersectionRatio > 0.6) {
        if (!video.src) video.src = videoStreamUrl(slide._item.id);
        video.muted = currentMuted;
        safePlay(video);
        if (pushHistoryItem(slide._item)) renderHistory();
      } else {
        video.pause();
      }
    }
  }, { root: feed.parentElement, threshold: [0, 0.25, 0.6, 1] });
  document.querySelectorAll(".short-slide").forEach((s) => observer.observe(s));
}

async function loadShortsFeed(q = FALLBACK_QUERY) {
  const r = await fetch(`/api/shorts?q=${encodeURIComponent(q)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "shorts failed");
  return data.items || [];
}

async function refreshShorts(q = FALLBACK_QUERY) {
  const feed = $("shorts-feed");
  lastQuery = q;
  feed.innerHTML = `<div class="shorts-loading">${loaderHTML("Đang tải Shorts...")}</div>`;
  try {
    const items = await loadShortsFeed(q);
    if (items.length === 0) {
      feed.innerHTML = `<div class="shorts-empty">Không có Shorts phù hợp với "${escapeHtml(q)}".</div>`;
      return;
    }
    feed.innerHTML = "";
    for (const it of items) feed.appendChild(buildSlide(it));
    setupObserver(feed);
    hasLoaded = true;
  } catch (err) {
    feed.innerHTML = `<div class="shorts-empty">Lỗi: ${escapeHtml(err.message)}</div>`;
  }
}

export function pauseAllShorts() {
  document.querySelectorAll(".short-video").forEach((v) => v.pause());
}

export function ensureShortsLoaded() {
  if (!hasLoaded) refreshShorts(FALLBACK_QUERY);
}

export function attachShorts() {
  const form = $("search-form-shorts");
  if (!form) return;
  const qInput = form.querySelector(".q-input");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = normalizeQuery(qInput.value) || FALLBACK_QUERY;
    qInput.value = q === FALLBACK_QUERY ? "" : q;
    refreshShorts(q);
  });
}
