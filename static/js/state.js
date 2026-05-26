// Client-side state: playlists + watch history. Audio playback removed; only video remains.

const PLAYLISTS_KEY = "lucy-music-playlists-v1";
const HISTORY_KEY = "lucy-music-history-v1";
const HISTORY_LIMIT = 200;

export const playlists = [];     // [{ id, name, items: [...] }]
export const playHistory = [];   // [{ ...item, playedAt }], newest first
export const expandedPlaylists = new Set();

export function loadPlaylists() {
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    playlists.length = 0;
    if (Array.isArray(arr)) playlists.push(...arr);
  } catch (_) { playlists.length = 0; }
}

export function savePlaylists() {
  try { localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists)); } catch (_) {}
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    playHistory.length = 0;
    if (Array.isArray(arr)) playHistory.push(...arr);
  } catch (_) { playHistory.length = 0; }
}

export function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(playHistory)); } catch (_) {}
}

export function pushHistoryItem(item) {
  if (!item || !item.id) return false;
  if (playHistory.length && playHistory[0].id === item.id) {
    playHistory[0].playedAt = Date.now();
    saveHistory();
    return false;
  }
  playHistory.unshift({
    id: item.id,
    title: item.title,
    uploader: item.uploader,
    thumbnail: item.thumbnail,
    duration: item.duration,
    playedAt: Date.now(),
  });
  if (playHistory.length > HISTORY_LIMIT) playHistory.length = HISTORY_LIMIT;
  saveHistory();
  return true;
}

export function clearHistory() {
  playHistory.length = 0;
  saveHistory();
}
