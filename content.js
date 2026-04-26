(function () {
  "use strict";

  const extApi = typeof browser !== "undefined" ? browser : chrome;
  const DEFAULT_SETTINGS = {
    initialVolume: 100,
    hideDelayMs: 2500,
    enabledInstagram: true,
  };
  const i18n = {
    controlsGroup: "Controles de video",
    progressLabel: "Progresso do video",
    muteToggleLabel: "Ativar ou desativar som",
    volumeLabel: "Volume",
  };
  let settings = { ...DEFAULT_SETTINGS };

  function getMessage(key, fallback) {
    try {
      return extApi?.i18n?.getMessage?.(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadI18n() {
    i18n.controlsGroup = getMessage("controlsGroupLabel", i18n.controlsGroup);
    i18n.progressLabel = getMessage("progressLabel", i18n.progressLabel);
    i18n.muteToggleLabel = getMessage("muteToggleLabel", i18n.muteToggleLabel);
    i18n.volumeLabel = getMessage("volumeLabel", i18n.volumeLabel);
  }

  function getStorageSettings() {
    return new Promise((resolve) => {
      const storage = extApi?.storage?.local;
      if (!storage || typeof storage.get !== "function") {
        resolve({});
        return;
      }

      try {
        if (storage.get.length <= 1) {
          Promise.resolve(storage.get(DEFAULT_SETTINGS))
            .then((result) => resolve(result || {}))
            .catch(() => resolve({}));
          return;
        }

        storage.get(DEFAULT_SETTINGS, (result) => {
          resolve(result || {});
        });
      } catch {
        resolve({});
      }
    });
  }

  function shouldRunOnCurrentSite() {
    const host = location.hostname;
    if (host.includes("instagram.com")) return settings.enabledInstagram;
    return false;
  }

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function setSliderVar(el, pct) {
    el.style.setProperty("--val", `${pct}%`);
  }

  function getVolLevel(muted, vol) {
    if (muted || vol === 0) return 0;
    if (vol < 0.5) return 1;
    return 2;
  }

  function createSvgPath(d, extraAttrs = {}) {
    const NS = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    Object.entries(extraAttrs).forEach(([key, value]) => {
      path.setAttribute(key, value);
    });
    return path;
  }

  function createVolIcon(level) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("reel-vol-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "white");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");

    svg.appendChild(createSvgPath("M3 9v6h4l5 5V4L7 9H3z"));

    if (level === 0) {
      svg.appendChild(
        createSvgPath("M15 10l4 4m0-4l-4 4", {
          stroke: "currentColor",
          "stroke-width": "2",
          "stroke-linecap": "round",
          fill: "none",
        }),
      );
      return svg;
    }

    svg.appendChild(
      createSvgPath(
        "M16.5 12A4.5 4.5 0 0 0 14 8.07v7.86A4.5 4.5 0 0 0 16.5 12z",
      ),
    );

    if (level === 2) {
      svg.appendChild(
        createSvgPath(
          "M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
        ),
      );
    }

    return svg;
  }

  function findSafeContainer(video) {
    let current = video.parentElement;
    while (current && current.tagName !== "BODY") {
      if (
        current.querySelector(
          '[aria-label="Press to play"], [aria-label="Video player"]',
        )
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return video.closest('div[style*="--x-height"]') || video.parentElement;
  }

  function buildControls(video) {
    video._reelCtrl = true;

    if (!video.dataset.reelInitialVolumeApplied) {
      const configuredVolume = Math.max(
        0,
        Math.min(100, Number(settings.initialVolume)),
      );
      video.volume = configuredVolume / 100;
      video.muted = configuredVolume === 0;
      video.dataset.reelInitialVolumeApplied = "true";
    }

    const container = findSafeContainer(video);
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    const bar = document.createElement("div");
    bar.className = "reel-controls-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", i18n.controlsGroup);

    const rowTop = document.createElement("div");
    rowTop.className = "reel-ctrl-row";

    const progressSlider = document.createElement("input");
    progressSlider.type = "range";
    progressSlider.className = "reel-slider reel-slider-progress";
    progressSlider.min = "0";
    progressSlider.max = "100";
    progressSlider.step = "0.1";
    progressSlider.value = "0";
    progressSlider.setAttribute("aria-label", i18n.progressLabel);

    const timeLabel = document.createElement("span");
    timeLabel.className = "reel-ctrl-time";
    timeLabel.setAttribute("aria-live", "off");
    timeLabel.textContent = "0:00 / 0:00";

    rowTop.append(progressSlider, timeLabel);

    const rowBottom = document.createElement("div");
    rowBottom.className = "reel-ctrl-row";

    const volBtn = document.createElement("button");
    volBtn.type = "button";
    volBtn.className = "reel-vol-btn vol-btn";
    volBtn.setAttribute("aria-label", i18n.muteToggleLabel);
    volBtn.setAttribute("aria-pressed", video.muted ? "true" : "false");
    volBtn.appendChild(createVolIcon(getVolLevel(video.muted, video.volume)));

    const volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.className = "reel-slider reel-slider-volume";
    volumeSlider.min = "0";
    volumeSlider.max = "100";
    volumeSlider.step = "1";
    volumeSlider.value = String(video.muted ? 0 : video.volume * 100);
    volumeSlider.setAttribute("aria-label", i18n.volumeLabel);

    rowBottom.append(volBtn, volumeSlider);
    bar.append(rowTop, rowBottom);

    ["click", "mousedown", "pointerdown", "touchstart"].forEach((evt) => {
      bar.addEventListener(evt, (e) => e.stopPropagation());
    });

    container.appendChild(bar);

    let isScrubbing = false;
    let isVolScrubbing = false;
    let hideTimeout;

    function updateVolButtonIcon() {
      volBtn.replaceChildren(
        createVolIcon(getVolLevel(video.muted, video.volume)),
      );
    }

    function resetHideTimer() {
      bar.classList.remove("fade-out");
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(
        () => {
          if (!isScrubbing && !isVolScrubbing) {
            bar.classList.add("fade-out");
          }
        },
        Number(settings.hideDelayMs) || DEFAULT_SETTINGS.hideDelayMs,
      );
    }

    container.addEventListener("mousemove", resetHideTimer);
    container.addEventListener("mouseenter", resetHideTimer);
    container.addEventListener("mouseleave", () => {
      if (!isScrubbing && !isVolScrubbing) {
        bar.classList.add("fade-out");
      }
    });

    resetHideTimer();

    video.addEventListener("timeupdate", () => {
      if (isScrubbing) return;
      const pct = (video.currentTime / video.duration) * 100 || 0;
      progressSlider.value = pct;
      setSliderVar(progressSlider, pct);
      timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
    });

    progressSlider.addEventListener("input", (e) => {
      isScrubbing = true;
      resetHideTimer();
      const pct = e.target.value;
      setSliderVar(progressSlider, pct);
      if (video.duration) {
        timeLabel.textContent = `${fmt((pct / 100) * video.duration)} / ${fmt(video.duration)}`;
      }
    });

    progressSlider.addEventListener("change", (e) => {
      isScrubbing = false;
      if (video.duration) {
        video.currentTime = (e.target.value / 100) * video.duration;
      }
      resetHideTimer();
    });

    volumeSlider.addEventListener("input", (e) => {
      isVolScrubbing = true;
      resetHideTimer();
      const val = e.target.value;
      setSliderVar(volumeSlider, val);
      video.volume = val / 100;
      video.muted = val == 0;
      updateVolButtonIcon();
    });

    volumeSlider.addEventListener("change", () => {
      isVolScrubbing = false;
      resetHideTimer();
    });

    volBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      if (!video.muted && video.volume === 0) {
        video.volume = 1;
        volumeSlider.value = 100;
        setSliderVar(volumeSlider, 100);
      }
      updateVolButtonIcon();
      volBtn.setAttribute("aria-pressed", video.muted ? "true" : "false");
      resetHideTimer();
    });

    video.addEventListener("volumechange", () => {
      if (isVolScrubbing) return;
      const displayVol = video.muted ? 0 : video.volume * 100;
      volumeSlider.value = displayVol;
      setSliderVar(volumeSlider, displayVol);
      updateVolButtonIcon();
      volBtn.setAttribute("aria-pressed", video.muted ? "true" : "false");
    });

    const obs = new MutationObserver(() => {
      if (!document.contains(video)) {
        bar.remove();
        clearTimeout(hideTimeout);
        obs.disconnect();
        video._reelCtrl = false;
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function isReelVideo(video) {
    const rect = video.getBoundingClientRect();
    return rect.height > 200 || video.offsetHeight > 200;
  }

  function processVideos() {
    if (!shouldRunOnCurrentSite()) return;
    document.querySelectorAll("video").forEach((video) => {
      if (!video._reelCtrl && isReelVideo(video)) {
        buildControls(video);
      }
    });
  }

  function init() {
    loadI18n();
    getStorageSettings().then((stored) => {
      settings = { ...DEFAULT_SETTINGS, ...stored };
      if (!shouldRunOnCurrentSite()) return;

      const observer = new MutationObserver(processVideos);
      observer.observe(document.body, { childList: true, subtree: true });
      processVideos();
    });
  }

  init();
})();
