// Shared DOM helpers and cached element references.
export const $ = (id) => document.getElementById(id);
export const $$ = (sel) => document.querySelectorAll(sel);

// Main content
export const results = $("results");

// Video player elements
export const videoPip = $("video-pip");
export const videoEl = $("video");
export const videoTitle = $("video-title");
export const videoClose = $("video-close");
export const videoPop = $("video-pop");
export const videoLoading = $("video-loading");
export const videoHeader = $("video-pip-header");
export const videoResize = $("video-resize");
export const videoMiniHost = $("video-mini-host");
export const videoMiniClose = $("video-mini-close");

// Side panel
export const plistEl = $("playlists");
export const plistEmpty = $("playlists-empty");
export const historyEl = $("history");
export const historyEmpty = $("history-empty");

// Popover (add-to-playlist)
export const popover = $("pl-popover");
export const popoverList = $("pl-popover-list");
export const popoverInput = $("pl-popover-input");
export const popoverForm = $("pl-popover-create");

// Detail / hero / results header
export const detailEl = $("detail-view");
export const heroEl = $("hero");
export const resultsHeaderEl = $("results-header");
