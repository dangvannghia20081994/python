// Thanh điều khiển kiểu YouTube cho player ở trang xem (detail).
// Bám vào <video> singleton (videoEl). Mỗi lần mở detail mới, control được dựng lại trong host #detail-media.
// initControls() gắn listener cấp videoEl 1 lần; chúng đọc `cur` (bộ control hiện hành) để cập nhật UI.

import { videoEl } from "./dom.js";
import { videoStreamUrl } from "./api.js";
import { hasNext, hasPrev, playNext, playPrev } from "./queue.js";

let cur = null;   // { host, root, refs..., item, formats, itag } của control đang hiển thị
let inited = false;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---- Cập nhật UI từ trạng thái videoEl (gọi bởi các event được gắn 1 lần) ----
function syncPlayState() {
  if (!cur) return;
  const playing = !videoEl.paused && !videoEl.ended;
  cur.root.classList.toggle("is-playing", playing);
  cur.root.classList.toggle("is-paused", !playing);
  cur.btnPlay.innerHTML = playing ? ICON.pause : ICON.play;
  cur.btnBig.innerHTML = videoEl.ended ? ICON.replay : ICON.play;
}

function syncProgress() {
  if (!cur) return;
  const dur = videoEl.duration || 0;
  const pct = dur ? (videoEl.currentTime / dur) * 100 : 0;
  cur.played.style.width = pct + "%";
  cur.knob.style.left = pct + "%";
  cur.cur.textContent = fmtTime(videoEl.currentTime);
  cur.dur.textContent = fmtTime(dur);
}

function syncBuffered() {
  if (!cur || !videoEl.duration) return;
  let end = 0;
  try {
    for (let i = 0; i < videoEl.buffered.length; i++) {
      if (videoEl.buffered.start(i) <= videoEl.currentTime) end = videoEl.buffered.end(i);
    }
  } catch (_) { /* buffered có thể throw khi chưa sẵn sàng */ }
  cur.buffered.style.width = (end / videoEl.duration) * 100 + "%";
}

function syncVolume() {
  if (!cur) return;
  const muted = videoEl.muted || videoEl.volume === 0;
  cur.btnMute.innerHTML = muted ? ICON.muted : videoEl.volume > 0.5 ? ICON.volHigh : ICON.volLow;
  cur.volRange.value = muted ? 0 : videoEl.volume;
}

function syncRate() {
  if (!cur) return;
  cur.root.querySelectorAll('[data-speed]').forEach((el) => {
    el.classList.toggle("active", parseFloat(el.dataset.speed) === videoEl.playbackRate);
  });
}

function syncNavButtons() {
  if (!cur) return;
  cur.btnPrev.disabled = !hasPrev();
  cur.btnNext.disabled = !hasNext();
}

// ---- Auto-hide thanh điều khiển khi không hoạt động ----
function showControls() {
  if (!cur) return;
  cur.root.classList.remove("ctl-idle");
  clearTimeout(cur.idleTimer);
  if (!videoEl.paused) {
    cur.idleTimer = setTimeout(() => cur && cur.root.classList.add("ctl-idle"), 2600);
  }
}

// ---- Tua bằng chuột/cảm ứng trên thanh progress ----
function seekToClientX(clientX) {
  if (!cur || !videoEl.duration) return;
  const rect = cur.bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  videoEl.currentTime = ratio * videoEl.duration;
  syncProgress();
}

// ---- Đổi chất lượng: giữ nguyên vị trí + trạng thái phát ----
function switchQuality(itag, labelEl) {
  if (!cur || !cur.item) return;
  const t = videoEl.currentTime;
  const wasPlaying = !videoEl.paused;
  cur.itag = itag || null;
  cur.host.classList.add("loading");
  videoEl.src = videoStreamUrl(cur.item.id, cur.itag);
  const restore = () => {
    try { videoEl.currentTime = t; } catch (_) {}
    if (wasPlaying) videoEl.play().catch(() => {});
    videoEl.removeEventListener("loadedmetadata", restore);
  };
  videoEl.addEventListener("loadedmetadata", restore);
  videoEl.load();
  // cập nhật nhãn nút quality
  if (cur.qualityLabel) cur.qualityLabel.textContent = labelEl ? labelEl.textContent : "Auto";
  cur.root.querySelectorAll('[data-itag]').forEach((el) => el.classList.toggle("active", el === labelEl));
  closeMenu();
}

function closeMenu() {
  if (cur) cur.root.querySelector(".vctl-menu")?.classList.add("hidden");
}

async function toggleFullscreen() {
  if (!cur) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await cur.host.requestFullscreen();
  } catch (err) { console.warn("fullscreen failed:", err); }
}

async function togglePip() {
  try {
    if (document.pictureInPictureElement === videoEl) await document.exitPictureInPicture();
    else await videoEl.requestPictureInPicture();
  } catch (err) { console.warn("PIP failed:", err); }
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" fill="currentColor"/></svg>',
  volHigh: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>',
  volLow: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor"/></svg>',
  muted: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 9v6h4l5 5V4L7 9zm18.5-1.5L20 6l-2.5 2.5L15 6l-1.5 1.5L16 10l-2.5 2.5L15 14l2.5-2.5L20 14l1.5-1.5L19 10z" fill="currentColor"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.4 4a6.5 6.5 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a6.6 6.6 0 0 0-1.7-1l-.4-2.5H9.2L8.8 6a6.6 6.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a6.5 6.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h5.6l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z" fill="currentColor"/></svg>',
  pip: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M19 7h-8v6h8V7zm2-4H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H3V5h18v14z" fill="currentColor"/></svg>',
  fsOpen: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M7 14H5v5h5v-2H7zM5 10h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" fill="currentColor"/></svg>',
  fsClose: '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z" fill="currentColor"/></svg>',
};

function buildMenu(formats) {
  const speedItems = SPEEDS.map(
    (s) => `<button class="vctl-menu-item" data-speed="${s}">${s === 1 ? "Bình thường" : s + "x"}</button>`
  ).join("");
  const qualityItems = [
    `<button class="vctl-menu-item active" data-itag="">Auto</button>`,
    ...formats.map((f) => `<button class="vctl-menu-item" data-itag="${f.itag}">${f.label}</button>`),
  ].join("");
  const qualitySection = `
    <div class="vctl-menu-sec">
      <div class="vctl-menu-title">Chất lượng</div>
      ${qualityItems}
    </div>`;
  return `
    <div class="vctl-menu hidden" role="menu">
      <div class="vctl-menu-sec">
        <div class="vctl-menu-title">Tốc độ phát</div>
        ${speedItems}
      </div>
      ${formats.length ? qualitySection : ""}
    </div>`;
}

export function mountControls(host, { item, formats = [] } = {}) {
  if (!host) return;
  initControls();
  // Xoá control cũ nếu còn sót trong host (detail re-render thường đã xoá innerHTML, nhưng đề phòng).
  host.querySelector(":scope > .vctl")?.remove();

  const root = document.createElement("div");
  root.className = "vctl is-paused";
  root.innerHTML = `
    <button class="vctl-big" data-act="bigplay" aria-label="Phát">${ICON.play}</button>
    <div class="vctl-gradient"></div>
    <div class="vctl-bar">
      <div class="vctl-progress" data-act="seek">
        <div class="vctl-track"></div>
        <div class="vctl-buffered"></div>
        <div class="vctl-played"></div>
        <div class="vctl-knob"></div>
      </div>
      <div class="vctl-row">
        <button class="vctl-btn" data-act="prev" title="Trước" aria-label="Bài trước">${ICON.prev}</button>
        <button class="vctl-btn vctl-play" data-act="play" title="Phát/Dừng (k)" aria-label="Phát/Dừng">${ICON.play}</button>
        <button class="vctl-btn" data-act="next" title="Tiếp theo" aria-label="Bài tiếp">${ICON.next}</button>
        <div class="vctl-vol">
          <button class="vctl-btn" data-act="mute" title="Tắt/Bật tiếng (m)" aria-label="Tắt tiếng">${ICON.volHigh}</button>
          <input class="vctl-vol-range" type="range" min="0" max="1" step="0.05" value="1" aria-label="Âm lượng">
        </div>
        <span class="vctl-time"><span class="vctl-cur">0:00</span> / <span class="vctl-dur">0:00</span></span>
        <div class="vctl-spacer"></div>
        <div class="vctl-settings">
          <button class="vctl-btn" data-act="settings" title="Cài đặt" aria-label="Cài đặt">${ICON.settings}<span class="vctl-quality-label"></span></button>
          ${buildMenu(formats)}
        </div>
        <button class="vctl-btn" data-act="pip" title="Trình phát thu nhỏ" aria-label="Picture-in-Picture">${ICON.pip}</button>
        <button class="vctl-btn" data-act="fs" title="Toàn màn hình (f)" aria-label="Toàn màn hình">${ICON.fsOpen}</button>
      </div>
    </div>`;
  host.appendChild(root);

  cur = {
    host, root, item, formats, itag: null, idleTimer: 0,
    btnBig: root.querySelector('[data-act="bigplay"]'),
    btnPlay: root.querySelector('[data-act="play"]'),
    btnPrev: root.querySelector('[data-act="prev"]'),
    btnNext: root.querySelector('[data-act="next"]'),
    btnMute: root.querySelector('[data-act="mute"]'),
    btnFs: root.querySelector('[data-act="fs"]'),
    volRange: root.querySelector(".vctl-vol-range"),
    bar: root.querySelector(".vctl-progress"),
    played: root.querySelector(".vctl-played"),
    buffered: root.querySelector(".vctl-buffered"),
    knob: root.querySelector(".vctl-knob"),
    cur: root.querySelector(".vctl-cur"),
    dur: root.querySelector(".vctl-dur"),
    qualityLabel: root.querySelector(".vctl-quality-label"),
  };

  // ---- Wiring nút bấm (gắn trên element mới mỗi lần mount) ----
  const toggle = () => { if (videoEl.paused) videoEl.play().catch(() => {}); else videoEl.pause(); };
  cur.btnPlay.onclick = toggle;
  cur.btnBig.onclick = toggle;
  cur.btnPrev.onclick = () => playPrev();
  cur.btnNext.onclick = () => playNext();
  cur.btnMute.onclick = () => { videoEl.muted = !videoEl.muted; };
  cur.btnFs.onclick = toggleFullscreen;
  root.querySelector('[data-act="pip"]').onclick = togglePip;
  cur.volRange.oninput = () => { videoEl.muted = false; videoEl.volume = parseFloat(cur.volRange.value); };

  const settingsBtn = root.querySelector('[data-act="settings"]');
  const menu = root.querySelector(".vctl-menu");
  settingsBtn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
  menu.onclick = (e) => e.stopPropagation();
  menu.querySelectorAll("[data-speed]").forEach((el) => {
    el.onclick = () => { videoEl.playbackRate = parseFloat(el.dataset.speed); closeMenu(); };
  });
  menu.querySelectorAll("[data-itag]").forEach((el) => {
    el.onclick = () => switchQuality(el.dataset.itag, el);
  });

  // ---- Tua bằng pointer ----
  let scrubbing = false;
  cur.bar.addEventListener("pointerdown", (e) => {
    scrubbing = true; cur.root.classList.add("scrubbing");
    seekToClientX(e.clientX); cur.bar.setPointerCapture(e.pointerId); e.preventDefault();
  });
  cur.bar.addEventListener("pointermove", (e) => { if (scrubbing) seekToClientX(e.clientX); });
  cur.bar.addEventListener("pointerup", () => { scrubbing = false; cur.root.classList.remove("scrubbing"); });
  cur.bar.addEventListener("pointercancel", () => { scrubbing = false; cur.root.classList.remove("scrubbing"); });

  // ---- Auto-hide ----
  host.addEventListener("pointermove", showControls);
  host.addEventListener("pointerleave", () => { if (!videoEl.paused && cur) cur.root.classList.add("ctl-idle"); });

  // Khởi tạo trạng thái UI ngay
  syncPlayState(); syncProgress(); syncBuffered(); syncVolume(); syncRate(); syncNavButtons();
  showControls();
}

export function unmountControls() {
  if (cur) { clearTimeout(cur.idleTimer); cur.root.remove(); }
  cur = null;
}

// Gắn listener cấp videoEl + phím tắt — chỉ 1 lần.
function initControls() {
  if (inited) return;
  inited = true;
  videoEl.addEventListener("play", () => { syncPlayState(); showControls(); });
  videoEl.addEventListener("pause", syncPlayState);
  videoEl.addEventListener("ended", syncPlayState);
  videoEl.addEventListener("timeupdate", () => { syncProgress(); syncBuffered(); });
  videoEl.addEventListener("progress", syncBuffered);
  videoEl.addEventListener("loadedmetadata", () => { syncProgress(); syncNavButtons(); });
  videoEl.addEventListener("volumechange", syncVolume);
  videoEl.addEventListener("ratechange", syncRate);

  document.addEventListener("fullscreenchange", () => {
    if (cur) cur.btnFs.innerHTML = document.fullscreenElement ? ICON.fsClose : ICON.fsOpen;
  });
  // Click ra ngoài → đóng menu cài đặt
  document.addEventListener("click", () => closeMenu());

  // Phím tắt — chỉ khi control đang hiển thị và không gõ trong ô nhập.
  document.addEventListener("keydown", (e) => {
    if (!cur || !document.contains(cur.root)) return;
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    switch (e.key) {
      case " ": case "k":
        e.preventDefault();
        if (videoEl.paused) videoEl.play().catch(() => {}); else videoEl.pause();
        break;
      case "ArrowLeft": videoEl.currentTime = Math.max(0, videoEl.currentTime - 5); break;
      case "ArrowRight": videoEl.currentTime = Math.min(videoEl.duration || 1e9, videoEl.currentTime + 5); break;
      case "j": videoEl.currentTime = Math.max(0, videoEl.currentTime - 10); break;
      case "l": videoEl.currentTime = Math.min(videoEl.duration || 1e9, videoEl.currentTime + 10); break;
      case "ArrowUp": e.preventDefault(); videoEl.muted = false; videoEl.volume = Math.min(1, videoEl.volume + 0.1); break;
      case "ArrowDown": e.preventDefault(); videoEl.volume = Math.max(0, videoEl.volume - 0.1); break;
      case "m": videoEl.muted = !videoEl.muted; break;
      case "f": toggleFullscreen(); break;
      case "N": playNext(); break;
      case "P": playPrev(); break;
      default: return;
    }
    showControls();
  });
}
