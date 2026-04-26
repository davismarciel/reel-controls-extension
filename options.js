(() => {
  "use strict";

  const extApi = typeof browser !== "undefined" ? browser : chrome;
  const DEFAULT_SETTINGS = {
    initialVolume: 100,
    hideDelayMs: 2500,
    enabledInstagram: true,
  };

  const form = document.getElementById("settings-form");
  const enabledInstagram = document.getElementById("enabledInstagram");
  const initialVolume = document.getElementById("initialVolume");
  const initialVolumeValue = document.getElementById("initialVolumeValue");
  const hideDelayMs = document.getElementById("hideDelayMs");
  const resetBtn = document.getElementById("reset-btn");
  const status = document.getElementById("status");

  function t(key, fallback = "") {
    try {
      return extApi?.i18n?.getMessage?.(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const msg = t(key, "");
      if (msg) el.textContent = msg;
    });
  }

  function storageGet(defaults) {
    return new Promise((resolve) => {
      const storage = extApi?.storage?.local;
      if (!storage || typeof storage.get !== "function") {
        resolve({ ...defaults });
        return;
      }

      try {
        if (storage.get.length <= 1) {
          Promise.resolve(storage.get(defaults))
            .then((result) => resolve({ ...defaults, ...(result || {}) }))
            .catch(() => resolve({ ...defaults }));
          return;
        }

        storage.get(defaults, (result) => {
          resolve({ ...defaults, ...(result || {}) });
        });
      } catch {
        resolve({ ...defaults });
      }
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      const storage = extApi?.storage?.local;
      if (!storage || typeof storage.set !== "function") {
        resolve();
        return;
      }

      try {
        if (storage.set.length <= 1) {
          Promise.resolve(storage.set(value)).then(resolve).catch(reject);
          return;
        }

        storage.set(value, () => {
          const err = extApi?.runtime?.lastError;
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function render(settings) {
    enabledInstagram.checked = Boolean(settings.enabledInstagram);

    const volume = clampInt(
      settings.initialVolume,
      0,
      100,
      DEFAULT_SETTINGS.initialVolume,
    );
    initialVolume.value = String(volume);
    initialVolumeValue.value = `${volume}%`;

    const delay = clampInt(
      settings.hideDelayMs,
      1000,
      10000,
      DEFAULT_SETTINGS.hideDelayMs,
    );
    hideDelayMs.value = String(delay);
  }

  function readForm() {
    return {
      enabledInstagram: enabledInstagram.checked,
      initialVolume: clampInt(
        initialVolume.value,
        0,
        100,
        DEFAULT_SETTINGS.initialVolume,
      ),
      hideDelayMs: clampInt(
        hideDelayMs.value,
        1000,
        10000,
        DEFAULT_SETTINGS.hideDelayMs,
      ),
    };
  }

  function setStatus(message) {
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = "";
    }, 2200);
  }

  initialVolume.addEventListener("input", () => {
    const volume = clampInt(
      initialVolume.value,
      0,
      100,
      DEFAULT_SETTINGS.initialVolume,
    );
    initialVolumeValue.value = `${volume}%`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = readForm();
    render(next);
    await storageSet(next);
    setStatus(t("savedSuccess", "Settings saved successfully."));
  });

  resetBtn.addEventListener("click", async () => {
    render(DEFAULT_SETTINGS);
    await storageSet(DEFAULT_SETTINGS);
    setStatus(t("resetSuccess", "Settings restored to defaults."));
  });

  async function init() {
    applyI18n();
    const stored = await storageGet(DEFAULT_SETTINGS);
    render(stored);
  }

  init();
})();
