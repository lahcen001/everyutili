(function () {
  "use strict";

  const SITE_URL = "https://everyutili.com";
  const RECENTS_KEY = "everyutili_recent_visits";
  const PINS_KEY = "everyutili_pinned_slugs";
  const MAX_RECENTS = 8;
  const MAX_PINS = 12;

  // ---------------------------------------------------------- i18n
  // See newtab.js for the full rationale — same pattern, kept in sync.
  const SITE_LOCALES = ["en", "es", "fr", "de", "pt", "ar", "ja", "hi", "zh-CN", "ru", "it", "id"];

  function tr(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  function resolveSiteLocale() {
    const uiLang = chrome.i18n.getUILanguage();
    if (SITE_LOCALES.includes(uiLang)) return uiLang;
    const base = uiLang.split("-")[0];
    if (base === "zh") return uiLang.toLowerCase() === "zh-tw" ? "en" : "zh-CN";
    if (SITE_LOCALES.includes(base)) return base;
    return "en";
  }

  const SITE_LOCALE = resolveSiteLocale();

  function toolUrl(tool) {
    return `${SITE_URL}/${SITE_LOCALE}/tools/${tool.category}/${tool.slug}`;
  }

  function iconSvg(category) {
    const path = EVERYUTILI_CATEGORY_ICONS[category] || "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }

  const CATEGORY_LABEL_KEYS = {
    media: "categoryMedia",
    document: "categoryDocument",
    developer: "categoryDeveloper",
    financial: "categoryFinancial",
  };

  function categoryLabel(slug) {
    return CATEGORY_LABEL_KEYS[slug] ? tr(CATEGORY_LABEL_KEYS[slug]) : slug;
  }

  function pinIconSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/></svg>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------------------------------------------------- storage helpers
  //
  // Wrapped the same way as newtab.js: check chrome.runtime.lastError and
  // fall back to a safe default rather than letting a storage hiccup break
  // rendering or silently drop a write.

  function safeGet(key, fallback, callback) {
    try {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          callback(fallback);
          return;
        }
        callback(result[key] === undefined ? fallback : result[key]);
      });
    } catch {
      callback(fallback);
    }
  }

  function safeSet(key, value) {
    try {
      chrome.storage.local.set({ [key]: value }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Storage unavailable — UI already reflects the change locally.
    }
  }

  function getRecents(callback) {
    safeGet(RECENTS_KEY, [], (value) => {
      const list = Array.isArray(value)
        ? value.filter((r) => r && typeof r.slug === "string")
        : [];
      callback(list);
    });
  }

  function getPins(callback) {
    safeGet(PINS_KEY, [], (value) => {
      const list = Array.isArray(value) ? value.filter((s) => typeof s === "string") : [];
      callback(list);
    });
  }

  function recordVisit(slug) {
    getRecents((recents) => {
      const filtered = recents.filter((r) => r.slug !== slug);
      const next = [{ slug, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
      safeSet(RECENTS_KEY, next);
    });
  }

  function togglePin(slug) {
    getPins((pins) => {
      const isPinned = pins.includes(slug);
      const next = isPinned ? pins.filter((s) => s !== slug) : [...pins, slug].slice(-MAX_PINS);
      safeSet(PINS_KEY, next);
      renderList();
    });
  }

  const toastEl = document.getElementById("popup-toast");
  const toastLabelEl = document.getElementById("popup-toast-label");
  let toastTimer = null;

  function showToast(label) {
    clearTimeout(toastTimer);
    toastLabelEl.textContent = label;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 1500);
  }

  function setItemOpening(el) {
    if (!el) return;
    el.classList.add("is-opening");
    const iconBox = el.querySelector(".icon-box");
    if (iconBox && !iconBox.querySelector(".spinner")) {
      const spinner = document.createElement("span");
      spinner.className = "spinner spinner-sm";
      iconBox.appendChild(spinner);
    }
  }

  function openTool(tool, sourceEl) {
    setItemOpening(sourceEl);
    showToast(tr("popupOpeningTool", [tool.name]));
    recordVisit(tool.slug);
    chrome.tabs.create({ url: toolUrl(tool) });
  }

  const state = {
    query: "",
    category: "all",
    pinnedSlugs: [],
  };

  const pillsEl = document.getElementById("popup-pills");
  const listEl = document.getElementById("popup-list");
  const emptyEl = document.getElementById("popup-empty");
  const searchInput = document.getElementById("popup-search");
  const clearBtn = document.getElementById("popup-clear");

  function renderPills() {
    const slugs = ["all", ...EVERYUTILI_CATEGORIES.map((c) => c.slug)];
    pillsEl.innerHTML = "";
    for (const slug of slugs) {
      const btn = document.createElement("button");
      btn.className = "pill" + (state.category === slug ? " active" : "");
      btn.dataset.category = slug;
      btn.textContent = slug === "all" ? tr("categoryAll") : categoryLabel(slug);
      btn.addEventListener("click", () => {
        state.category = slug;
        renderPills();
        renderList();
      });
      pillsEl.appendChild(btn);
    }
  }

  function popupItem(tool, isPinned) {
    const row = document.createElement("div");
    row.className = "popup-item";
    row.addEventListener("click", () => openTool(tool, row));

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "card-action pin-btn pin-btn-sm" + (isPinned ? " active" : "");
    pinBtn.setAttribute("aria-label", isPinned ? tr("unpinTool", [tool.name]) : tr("pinTool", [tool.name]));
    pinBtn.innerHTML = pinIconSvg();
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePin(tool.slug);
    });

    row.innerHTML = `
      <span class="icon-box" data-category="${tool.category}">${iconSvg(tool.category)}</span>
      <span class="popup-item-text">
        <span class="name">${escapeHtml(tool.name)}</span>
      </span>
    `;
    row.appendChild(pinBtn);
    return row;
  }

  function renderList() {
    getPins((pins) => {
      state.pinnedSlugs = pins;
      const pinnedSet = new Set(pins);

      const q = state.query.trim().toLowerCase();
      const inCategory = (t) => state.category === "all" || t.category === state.category;

      // Same fuzzy/keyword scorer as the new tab search (search.js) so a
      // query like "convert to jpg" finds "PNG to JPG" here too, instead of
      // requiring an exact name/slug substring.
      let list;
      if (!q) {
        list = EVERYUTILI_TOOLS.filter(inCategory);
      } else {
        list = EVERYUTILI_TOOLS.filter(inCategory)
          .map((t) => ({ tool: t, score: EveryUtiliSearch.scoreMatch(t, q) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score || b.tool.priority - a.tool.priority)
          .map((r) => r.tool);
      }

      // Pinned tools float to the top of the (filtered/ranked) list, in pin order.
      list = [
        ...list.filter((t) => pinnedSet.has(t.slug)),
        ...list.filter((t) => !pinnedSet.has(t.slug)),
      ];

      listEl.innerHTML = "";
      if (list.length === 0) {
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;

      const fragment = document.createDocumentFragment();
      for (const tool of list) {
        fragment.appendChild(popupItem(tool, pinnedSet.has(tool.slug)));
      }
      listEl.appendChild(fragment);
    });
  }

  searchInput.addEventListener("input", (e) => {
    state.query = e.target.value;
    clearBtn.hidden = state.query.length === 0;
    renderList();
  });

  clearBtn.addEventListener("click", () => {
    state.query = "";
    searchInput.value = "";
    clearBtn.hidden = true;
    searchInput.focus();
    renderList();
  });

  // ---------------------------------------------------------- init

  function applyStaticI18n() {
    document.getElementById("popup-open-site").textContent = tr("popupOpenSite");
    searchInput.placeholder = tr("searchPlaceholderPopup");
    clearBtn.setAttribute("aria-label", tr("clearSearchAriaLabel"));
    emptyEl.textContent = tr("noToolsMatch");
  }

  applyStaticI18n();
  renderPills();
  renderList();
  searchInput.focus();
})();
