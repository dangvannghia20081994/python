// Home stack: search results, suggestions, detail view.

import { $, results, detailEl, heroEl, resultsHeaderEl } from "./dom.js";
import { playHistory } from "./state.js";
import { escapeHtml, fmtDur, fmtViews, fmtUploadDate, normalizeQuery, loaderHTML } from "./util.js";
import { apiSearch, apiDetail } from "./api.js";
import { openVideoInline, playInline, preserveInlineVideoBeforeTeardown } from "./video.js";
import { openPlPopover } from "./panels.js";

const FALLBACK_QUERY = "nhạc remix tiktok";
const detailCache = new Map();

export function renderResults(items) {
  results.innerHTML = "";
  if (!items.length) {
    results.innerHTML = `<div class="loading">Không có kết quả.</div>`;
    return;
  }
  for (const it of items) {
    const card = document.createElement("div");
    card.className = "card";
    const dur = it.duration ? fmtDur(it.duration) : "";
    card.innerHTML = `
      <div class="thumb">
        <img src="${it.thumbnail || ""}" alt="" loading="lazy">
        <button class="thumb-play" title="Xem video"><span class="thumb-play-icon">▶</span></button>
        ${dur ? `<div class="duration-badge">${dur}</div>` : ""}
      </div>
      <div class="meta">
        <a class="title" href="/watch?id=${encodeURIComponent(it.id)}" data-act="detail" title="Xem video">${escapeHtml(it.title || "(không tiêu đề)")}</a>
        <div class="uploader">${escapeHtml(it.uploader || "")}</div>
      </div>
      <div class="actions">
        <button data-act="playlist" title="Thêm vào playlist">+ Playlist</button>
      </div>`;
    const thumbEl = card.querySelector(".thumb");
    const playInThis = (e) => { e?.stopPropagation?.(); playInline(it, thumbEl); };
    // Click thumb (img or ▶ overlay) → play inline in this card. Click title → open detail page.
    card.querySelector(".thumb-play").onclick = playInThis;
    card.querySelector(".thumb img").onclick = playInThis;
    card.querySelector('[data-act="detail"]').onclick = (e) => { e.preventDefault(); navigateToDetail(it); };
    card.querySelector('[data-act="playlist"]').onclick = (e) => { e.stopPropagation(); openPlPopover(e.currentTarget, it); };
    results.appendChild(card);
  }
}

export function showSkeleton(count = 8) {
  results.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "skel-card";
    s.innerHTML = `
      <div class="skel-thumb"></div>
      <div class="skel-meta">
        <div class="skel-line"></div>
        <div class="skel-line short"></div>
      </div>`;
    results.appendChild(s);
  }
}

function hideSuggestionsHeader() {
  resultsHeaderEl.classList.add("hidden");
  heroEl.classList.add("hidden");
}
function showHero() { heroEl.classList.remove("hidden"); }

function pickSeed() {
  if (playHistory.length > 0) return { item: playHistory[0], reason: "xem gần nhất" };
  return null;
}

export async function loadSuggestions() {
  detailEl.classList.add("hidden");
  detailEl.innerHTML = "";
  results.classList.remove("hidden");
  const seed = pickSeed();
  const q = normalizeQuery(seed ? seed.item.title : FALLBACK_QUERY);
  resultsHeaderEl.querySelector("#results-header-text").innerHTML = seed
    ? `Gợi ý theo bài ${escapeHtml(seed.reason)}: <b>${escapeHtml(seed.item.title || "")}</b>`
    : `Gợi ý: <b>${escapeHtml(FALLBACK_QUERY)}</b>`;
  resultsHeaderEl.classList.remove("hidden");
  showHero();
  showSkeleton();
  try {
    const data = await apiSearch(q);
    const items = (data.items || []).filter((it) => !seed || it.id !== seed.item.id);
    renderResults(items);
  } catch (err) {
    results.innerHTML = `<div class="error">Lỗi tải gợi ý: ${escapeHtml(err.message)}</div>`;
  }
}

export function attachHomeSearch() {
  const form = $("search-form-home");
  if (!form) return;
  const qInput = form.querySelector(".q-input");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = normalizeQuery(qInput.value);
    qInput.value = q;
    if (!q) return;
    if (location.pathname !== "/") window.history.pushState({ view: "home" }, "", "/");
    detailEl.classList.add("hidden");
    detailEl.innerHTML = "";
    results.classList.remove("hidden");
    hideSuggestionsHeader();
    showSkeleton();
    try {
      const data = await apiSearch(q);
      renderResults(data.items || []);
    } catch (err) {
      results.innerHTML = `<div class="error">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
  });
  $("results-refresh").onclick = loadSuggestions;
}

function showDetailView() {
  detailEl.classList.remove("hidden");
  heroEl.classList.add("hidden");
  resultsHeaderEl.classList.add("hidden");
  results.classList.add("hidden");
}

export function showListView() {
  detailEl.classList.add("hidden");
  preserveInlineVideoBeforeTeardown();
  detailEl.innerHTML = "";
  results.classList.remove("hidden");
}

function renderDetail(info, related) {
  const dur = info.duration ? fmtDur(info.duration) : "";
  const views = info.view_count ? `${fmtViews(info.view_count)} lượt xem` : "";
  const date = fmtUploadDate(info.upload_date);
  const desc = (info.description || "").trim();
  detailEl.innerHTML = `
    <div class="detail-card">
      <button class="detail-back" id="detail-back-btn" title="Quay lại">← Quay lại</button>
      <div class="detail-hero">
        <div class="detail-thumb" id="detail-media">
          <img src="${info.thumbnail || ""}" alt="">
          <button class="detail-play-overlay" id="detail-play-btn" title="Xem video">
            <span class="thumb-play-icon">▶</span>
          </button>
          ${dur ? `<div class="duration-badge">${dur}</div>` : ""}
        </div>
        <div class="detail-info">
          <h2 class="detail-title">${escapeHtml(info.title || "")}</h2>
          <div class="detail-uploader">${escapeHtml(info.uploader || "")}</div>
          <div class="detail-stats">
            ${views ? `<span>👁 ${escapeHtml(views)}</span>` : ""}
            ${date ? `<span>📅 ${escapeHtml(date)}</span>` : ""}
            ${dur ? `<span>⏱ ${escapeHtml(dur)}</span>` : ""}
          </div>
          <div class="detail-actions">
            <button class="detail-action" data-act="playlist">+ Playlist</button>
          </div>
        </div>
      </div>
      ${desc ? `<div class="detail-desc"><div class="detail-section-title">Mô tả</div><pre>${escapeHtml(desc)}</pre></div>` : ""}
      <div class="detail-related">
        <div class="detail-section-title">Gợi ý tiếp theo</div>
        <div class="detail-related-grid"></div>
      </div>
    </div>`;
  const item = {
    id: info.id, title: info.title, uploader: info.uploader,
    duration: info.duration, thumbnail: info.thumbnail,
  };
  detailEl.querySelector("#detail-back-btn").onclick = () => window.history.back();
  detailEl.querySelector("#detail-play-btn").onclick = () => openVideoInline(item);
  detailEl.querySelector('[data-act="playlist"]').onclick = (e) => openPlPopover(e.currentTarget, item);

  const grid = detailEl.querySelector(".detail-related-grid");
  if (related && related.length) {
    for (const r of related) {
      const rdur = r.duration ? fmtDur(r.duration) : "";
      const row = document.createElement("div");
      row.className = "related-row";
      row.innerHTML = `
        <div class="related-thumb">
          <img src="${r.thumbnail || ""}" alt="" loading="lazy">
          ${rdur ? `<span class="related-dur">${rdur}</span>` : ""}
        </div>
        <div class="related-meta">
          <a class="related-title" href="/watch?id=${encodeURIComponent(r.id)}">${escapeHtml(r.title || "")}</a>
          <div class="related-uploader">${escapeHtml(r.uploader || "")}</div>
        </div>
        <button class="related-play" title="Xem video">▶</button>`;
      const goDetail = (e) => { e?.preventDefault?.(); navigateToDetail(r); };
      row.querySelector(".related-title").onclick = goDetail;
      row.querySelector(".related-thumb").onclick = goDetail;
      row.querySelector(".related-play").onclick = goDetail;
      grid.appendChild(row);
    }
  } else {
    grid.innerHTML = `<div class="panel-empty">Chưa có gợi ý.</div>`;
  }
}

export async function loadDetailById(id) {
  preserveInlineVideoBeforeTeardown();
  showDetailView();
  detailEl.innerHTML = `<div class="loading">${loaderHTML("Đang tải chi tiết...")}</div>`;
  if (detailCache.has(id)) {
    const cached = detailCache.get(id);
    renderDetail(cached.info, cached.related);
    return;
  }
  try {
    const data = await apiDetail(id);
    detailCache.set(id, data);
    renderDetail(data.info, data.related || []);
  } catch (err) {
    detailEl.innerHTML = `<div class="error">Lỗi tải chi tiết: ${escapeHtml(err.message)}</div>`;
  }
}

export function navigateToDetail(item) {
  const url = `/watch?id=${encodeURIComponent(item.id)}`;
  window.history.pushState({ view: "detail", id: item.id }, "", url);
  document.title = `${item.title || "Detail"} — Lucy Music`;
  loadDetailById(item.id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function navigateToHome(push = false) {
  if (push) window.history.pushState({ view: "home" }, "", "/");
  showListView();
  loadSuggestions();
}
