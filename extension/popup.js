(function () {
  "use strict";

  const SITE_URL = "https://everyutili.com";
  const LOCALE = "en";
  const RECENTS_KEY = "everyutili_recent_visits";
  const PINS_KEY = "everyutili_pinned_slugs";
  const MAX_RECENTS = 8;
  const MAX_PINS = 12;

  function toolUrl(tool) {
    return `${SITE_URL}/${LOCALE}/tools/${tool.category}/${tool.slug}`;
  }

  function iconSvg(category) {
    const path = EVERYUTILI_CATEGORY_ICONS[category] || "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
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
    showToast(`Opening ${tool.name}…`);
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
    const pills = [{ slug: "all", label: "All" }, ...EVERYUTILI_CATEGORIES];
    pillsEl.innerHTML = "";
    for (const cat of pills) {
      const btn = document.createElement("button");
      btn.className = "pill" + (state.category === cat.slug ? " active" : "");
      btn.dataset.category = cat.slug;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        state.category = cat.slug;
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
    pinBtn.setAttribute("aria-label", isPinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`);
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
      let list = EVERYUTILI_TOOLS.filter((t) => {
        const matchesCategory = state.category === "all" || t.category === state.category;
        const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.slug.includes(q);
        return matchesCategory && matchesQuery;
      });

      // Pinned tools float to the top of the (filtered) list, in pin order.
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

  renderPills();
  renderList();
  searchInput.focus();
})();
