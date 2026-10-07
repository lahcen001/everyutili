// Language support shared by newtab.js and popup.js. Plain script (no bundler):
// load it after tools-data.js and before search.js / newtab.js / popup.js.
//
// The language is the one chosen in Settings → Language, or — by default
// ("System default") — the browser's own UI language, then the browser's
// preferred web languages, and English if none of those is supported.
// Strings come from _locales/<lang>/messages.json (read directly, so a
// language can be picked independently of Chrome's UI language); tool names
// and search keywords come from i18n/tools.<lang>.json, generated from the
// website's translations by `npm run sync:extension-tools`.
(function () {
  "use strict";

  const SETTINGS_KEY = "everyutili_settings";

  // `dir` is the folder name under _locales (Chrome uses underscores);
  // `code` is the everyutili.com URL segment.
  const LANGUAGES = [
    { code: "en", dir: "en", native: "English" },
    { code: "es", dir: "es", native: "Español" },
    { code: "fr", dir: "fr", native: "Français" },
    { code: "de", dir: "de", native: "Deutsch" },
    { code: "pt", dir: "pt", native: "Português" },
    { code: "ar", dir: "ar", native: "العربية", rtl: true },
    { code: "ja", dir: "ja", native: "日本語" },
    { code: "hi", dir: "hi", native: "हिन्दी" },
    { code: "zh-CN", dir: "zh_CN", native: "简体中文" },
    { code: "ru", dir: "ru", native: "Русский" },
    { code: "it", dir: "it", native: "Italiano" },
    { code: "id", dir: "id", native: "Bahasa Indonesia" },
  ];

  const state = {
    code: "en",
    preference: "auto",
    messages: {},
    fallback: {},
    categories: {},
  };

  function findLanguage(tag) {
    if (!tag) return null;
    const lower = String(tag).replace(/_/g, "-").toLowerCase();
    const exact = LANGUAGES.find((l) => l.code.toLowerCase() === lower);
    if (exact) return exact;
    const base = lower.split("-")[0];
    if (base === "zh") {
      // Simplified Chinese only — Traditional (TW/HK/Hant) isn't translated.
      return /^zh-(tw|hk|mo|hant)/.test(lower) ? null : LANGUAGES.find((l) => l.code === "zh-CN");
    }
    return LANGUAGES.find((l) => l.code === base) || null;
  }

  function systemLanguage() {
    const candidates = [];
    try {
      candidates.push(chrome.i18n.getUILanguage());
    } catch (e) {
      /* ignore */
    }
    if (navigator.languages) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
    for (const tag of candidates) {
      const found = findLanguage(tag);
      if (found) return found;
    }
    return LANGUAGES[0];
  }

  function readSettings(callback) {
    try {
      chrome.storage.local.get(SETTINGS_KEY, (result) => {
        if (chrome.runtime.lastError) return callback({});
        const value = result && result[SETTINGS_KEY];
        callback(value && typeof value === "object" ? value : {});
      });
    } catch (e) {
      callback({});
    }
  }

  function fetchJson(url) {
    return fetch(url).then((response) => (response.ok ? response.json() : Promise.reject(new Error(url))));
  }

  function applyToolLanguage(data) {
    for (const tool of EVERYUTILI_TOOLS) {
      // Keep the English text so people can still search in English.
      if (tool.enName === undefined) {
        tool.enName = tool.name;
        tool.enKeywords = tool.keywords || [];
      }
      const entry = data && data.tools && data.tools[tool.slug];
      if (entry) {
        tool.name = entry.n;
        tool.tagline = entry.t;
        tool.keywords = entry.k || [];
      }
    }
    state.categories = (data && data.categories) || {};
  }

  /** Resolves once the chosen language's strings are loaded. Never rejects: any failure leaves English in place. */
  function init() {
    return new Promise((resolve) => {
      readSettings((settings) => {
        const pref = typeof settings.language === "string" ? settings.language : "auto";
        const chosen = pref !== "auto" ? findLanguage(pref) : null;
        const language = chosen || systemLanguage();
        state.preference = chosen ? chosen.code : "auto";
        state.code = language.code;

        const english = LANGUAGES[0];
        const loads = [fetchJson(`_locales/${language.dir}/messages.json`).catch(() => ({}))];
        if (language.code !== english.code) {
          loads.push(fetchJson(`_locales/${english.dir}/messages.json`).catch(() => ({})));
          loads.push(fetchJson(`i18n/tools.${language.code}.json`).catch(() => null));
        }
        Promise.all(loads).then(([messages, fallback, toolData]) => {
          state.messages = messages || {};
          state.fallback = fallback || {};
          if (toolData) applyToolLanguage(toolData);
          document.documentElement.lang = language.code;
          document.documentElement.dir = language.rtl ? "rtl" : "ltr";
          document.documentElement.classList.remove("i18n-pending");
          resolve();
        });
      });
    });
  }

  function tr(key, substitutions) {
    const entry = state.messages[key] || state.fallback[key];
    if (!entry || typeof entry.message !== "string") return key;
    const subs = substitutions === undefined ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    let text = entry.message;
    const placeholders = entry.placeholders || {};
    // $NAME$ → the placeholder's content ($1, $2…) → the matching substitution
    text = text.replace(/\$([A-Za-z0-9_@]+)\$/g, (match, name) => {
      const ph = placeholders[name.toLowerCase()] || placeholders[name];
      if (!ph || typeof ph.content !== "string") return match;
      return ph.content.replace(/\$([1-9])/g, (m, n) => (subs[Number(n) - 1] !== undefined ? String(subs[Number(n) - 1]) : ""));
    });
    return text.replace(/\$([1-9])/g, (m, n) => (subs[Number(n) - 1] !== undefined ? String(subs[Number(n) - 1]) : m));
  }

  function categoryLabel(slug) {
    if (state.categories[slug]) return state.categories[slug];
    const found = EVERYUTILI_CATEGORIES.find((c) => c.slug === slug);
    return found ? found.label : slug;
  }

  /** Saves the language preference ("auto" or a language code), keeping the other settings. */
  function setLanguage(value, callback) {
    readSettings((settings) => {
      const next = { ...settings, language: value === "auto" || findLanguage(value) ? value : "auto" };
      try {
        chrome.storage.local.set({ [SETTINGS_KEY]: next }, () => {
          void chrome.runtime.lastError;
          callback && callback();
        });
      } catch (e) {
        callback && callback();
      }
    });
  }

  window.EveryUtiliI18n = {
    LANGUAGES,
    init,
    tr,
    categoryLabel,
    setLanguage,
    get code() {
      return state.code;
    },
    /** "auto" or the language code the user picked */
    get preference() {
      return state.preference;
    },
  };
})();
