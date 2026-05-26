// Voice search via Web Speech API — wired to every `.voice-btn[data-voice]` in the page,
// each linked to its own search form by matching `data-voice` to the form's `data-stack-form`.

import { $ } from "./dom.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function attachVoiceSearch() {
  const buttons = document.querySelectorAll(".voice-btn[data-voice]");
  const modal = $("voice-modal");
  const transcriptEl = $("voice-transcript");
  const cancelBtn = $("voice-cancel");
  if (!buttons.length || !modal) return;

  if (!SpeechRecognition) {
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.title = "Trình duyệt không hỗ trợ nhận diện giọng nói";
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
    });
    return;
  }

  let recognition = null;
  let aborted = false;
  let activeBtn = null;
  let activeQInput = null;
  let activeForm = null;

  function openModal() {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    transcriptEl.textContent = "Hãy nói tên video hoặc nghệ sĩ";
    transcriptEl.style.color = "#cfcfd9";
    activeBtn?.classList.add("listening");
    document.body.classList.add("voice-listening");
    requestAnimationFrame(() => modal.scrollIntoView({ block: "start", behavior: "auto" }));
  }
  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    activeBtn?.classList.remove("listening");
    document.body.classList.remove("voice-listening");
  }

  function start(btn) {
    if (recognition) return;
    const stackKey = btn.dataset.voice;
    activeBtn = btn;
    activeForm = document.querySelector(`[data-stack-form="${stackKey}"]`);
    activeQInput = activeForm?.querySelector(".q-input");
    if (!activeForm || !activeQInput) return;

    aborted = false;
    recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      transcriptEl.textContent = (final + interim).trim() || "Đang nghe...";
      transcriptEl.style.color = final ? "#fff" : "#cfcfd9";
      if (final) {
        const text = final.trim();
        activeQInput.value = text;
        recognition.stop();
        setTimeout(() => {
          closeModal();
          if (text) activeForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }, 250);
      }
    };
    recognition.onerror = (e) => {
      let msg = "Có lỗi xảy ra";
      if (e.error === "not-allowed") msg = "Vui lòng cấp quyền sử dụng microphone";
      else if (e.error === "no-speech") msg = "Không nghe thấy giọng nói";
      else if (e.error === "audio-capture") msg = "Không tìm thấy microphone";
      else if (e.error === "network") msg = "Lỗi mạng — kiểm tra kết nối";
      transcriptEl.textContent = msg;
      transcriptEl.style.color = "#ff7a7a";
      setTimeout(closeModal, 1500);
    };
    recognition.onend = () => {
      recognition = null;
      if (aborted) closeModal();
    };
    openModal();
    try { recognition.start(); }
    catch (err) {
      transcriptEl.textContent = "Không khởi động được nhận diện";
      transcriptEl.style.color = "#ff7a7a";
      setTimeout(closeModal, 1200);
    }
  }

  function cancel() {
    if (recognition) {
      aborted = true;
      try { recognition.abort(); } catch (_) {}
    } else {
      closeModal();
    }
  }

  buttons.forEach((btn) => btn.addEventListener("click", () => start(btn)));
  cancelBtn.addEventListener("click", cancel);
  modal.addEventListener("click", (e) => { if (e.target === modal) cancel(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) cancel();
  });
}
