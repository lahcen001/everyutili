(function () {
  "use strict";

  const SITE_URL = "https://everyutili.com";
  const RECENTS_KEY = "everyutili_recent_visits";
  const PINS_KEY = "everyutili_pinned_slugs";
  const QUERIES_KEY = "everyutili_recent_queries";
  const SETTINGS_KEY = "everyutili_settings";
  const MAX_RECENTS = 8;
  const MAX_PINS = 12;
  const MAX_QUERIES = 5;
  const MAX_RESULTS = 8;
  const GOOGLE_PREFIX = /^g\s+/i;
  const NAV_TIMEOUT_MS = 8000;

  // Whether the "browse all tools" drawer has ever been opened (and its
  // ~80-tool, backdrop-blurred DOM built) this page load — see setDrawerOpen.
  let drawerRendered = false;

  // ---------------------------------------------------------- i18n
  //
  // chrome.i18n.getMessage reads extension/_locales/<lang>/messages.json,
  // auto-selected by Chrome's own UI language (no per-page detection code
  // needed). tr() is a thin wrapper so call sites read like a normal i18n
  // call (named tr, not t, since `t` is this file's usual loop variable for
  // a single tool object — e.g. `EVERYUTILI_TOOLS.map((t) => ...)`); no
  // collision either way since a shadowed `t` never itself gets called as a
  // function, but a distinct name keeps it unambiguous while skimming code.
  // SITE_LOCALES maps the UI language down to one of the 12 locale
  // segments everyutili.com actually serves (e.g. "en-US" -> "en"), falling
  // back to English for any language the site doesn't have a translation for.
  const SITE_LOCALES = ["en", "es", "fr", "de", "pt", "ar", "ja", "hi", "zh-CN", "ru", "it", "id"];

  function tr(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  function resolveSiteLocale() {
    const uiLang = chrome.i18n.getUILanguage(); // e.g. "en-US", "zh-CN", "pt-BR"
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

  function toolBySlug(slug) {
    return EVERYUTILI_TOOLS.find((t) => t.slug === slug);
  }

  function iconSvg(category, extraClass) {
    const path = EVERYUTILI_CATEGORY_ICONS[category] || "";
    return `<svg class="${extraClass || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function googleSearchUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  // ---------------------------------------------------------- storage helpers
  //
  // Every chrome.storage call is wrapped to check chrome.runtime.lastError
  // (e.g. storage briefly unavailable, extension context invalidated) and
  // falls back to a safe default instead of throwing or silently returning
  // undefined into render code. Stored arrays are also defensively filtered
  // in case of a manually-edited or future-schema-mismatched value.

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
      // Storage unavailable — the UI already reflects the change locally,
      // so this is a silent no-op rather than a user-facing error.
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

  function getRecentQueries(callback) {
    safeGet(QUERIES_KEY, [], (value) => {
      const list = Array.isArray(value) ? value.filter((s) => typeof s === "string") : [];
      callback(list);
    });
  }

  function getSettings(callback) {
    safeGet(SETTINGS_KEY, {}, (value) => {
      const settings = value && typeof value === "object" ? value : {};
      callback({
        defaultEngine: settings.defaultEngine === "google" ? "google" : "tools",
        clockFormat: ["auto", "12h", "24h"].includes(settings.clockFormat)
          ? settings.clockFormat
          : "auto",
      });
    });
  }

  function recordVisit(slug) {
    getRecents((recents) => {
      const filtered = recents.filter((r) => r.slug !== slug);
      const next = [{ slug, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
      safeSet(RECENTS_KEY, next);
    });
  }

  function removeRecent(slug) {
    getRecents((recents) => {
      const next = recents.filter((r) => r.slug !== slug);
      safeSet(RECENTS_KEY, next);
      renderQuickShelf();
    });
  }

  function togglePin(slug) {
    getPins((pins) => {
      const isPinned = pins.includes(slug);
      const next = isPinned ? pins.filter((s) => s !== slug) : [...pins, slug].slice(-MAX_PINS);
      safeSet(PINS_KEY, next);
      renderQuickShelf();
      // Only re-render the drawer if it's already been built (lazily, on
      // first open) — otherwise this would force the ~80-tool DOM/blur
      // build to happen on page load again the moment anything gets pinned.
      if (drawerRendered) renderDrawer();
    });
  }

  function recordQuery(query) {
    const trimmed = query.trim();
    if (!trimmed) return;
    getRecentQueries((queries) => {
      const filtered = queries.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_QUERIES);
      safeSet(QUERIES_KEY, next);
    });
  }

  // ---------------------------------------------------------- navigation

  const navOverlay = document.getElementById("nav-overlay");
  const navOverlayLabel = document.getElementById("nav-overlay-label");
  let navTimeoutId = null;

  function showNavOverlay(label, stalledLabel) {
    navOverlayLabel.textContent = label;
    navOverlay.hidden = false;
    requestAnimationFrame(() => navOverlay.classList.add("visible"));

    clearTimeout(navTimeoutId);
    if (stalledLabel) {
      navTimeoutId = setTimeout(() => {
        navOverlayLabel.textContent = stalledLabel;
      }, NAV_TIMEOUT_MS);
    }
  }

  // Navigation succeeding unloads this page entirely, so there's nothing to
  // clean up on success — the timeout only ever fires if we're still here.

  function setCardOpening(el) {
    if (!el) return;
    el.classList.add("is-opening");
    const iconBox = el.querySelector(".icon-box");
    if (iconBox && !iconBox.querySelector(".spinner")) {
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      iconBox.appendChild(spinner);
    }
  }

  function openTool(tool, sourceEl) {
    setCardOpening(sourceEl);
    showNavOverlay(tr("openingTool", [tool.name]), tr("stillOpeningCheckConnection"));
    recordVisit(tool.slug);
    window.location.href = toolUrl(tool);
  }

  function openGoogle(query, sourceEl) {
    setCardOpening(sourceEl);
    showNavOverlay(tr("searchingGoogle"), tr("stillSearchingCheckConnection"));
    window.location.href = googleSearchUrl(query);
  }

  // ---------------------------------------------------------- clock & date

  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const greetingEl = document.getElementById("greeting");
  const systemUses24h = Intl.DateTimeFormat(undefined, { hour: "numeric" })
    .resolvedOptions().hourCycle?.startsWith("h2") ?? false;

  let clockFormatPref = "auto";

  function tick() {
    const now = new Date();
    const hour12 = clockFormatPref === "12h" ? true : clockFormatPref === "24h" ? false : !systemUses24h;
    clockEl.textContent = now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12,
    });
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const hour = now.getHours();
    greetingEl.textContent =
      hour < 5
        ? tr("greetingNight")
        : hour < 12
          ? tr("greetingMorning")
          : hour < 18
            ? tr("greetingAfternoon")
            : tr("greetingEvening");
  }
  tick();
  setInterval(tick, 1000 * 15);

  // ---------------------------------------------------------- settings

  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  const defaultEngineButtons = {
    tools: document.getElementById("default-engine-tools"),
    google: document.getElementById("default-engine-google"),
  };
  const clockFormatButtons = {
    auto: document.getElementById("clock-auto"),
    "12h": document.getElementById("clock-12h"),
    "24h": document.getElementById("clock-24h"),
  };
  let settingsOpen = false;

  function setSettingsOpen(open) {
    settingsOpen = open;
    settingsToggle.setAttribute("aria-expanded", String(open));
    settingsPanel.hidden = !open;
  }

  settingsToggle.addEventListener("click", () => setSettingsOpen(!settingsOpen));
  document.addEventListener("click", (e) => {
    if (settingsOpen && !e.target.closest(".settings-shell")) {
      setSettingsOpen(false);
    }
  });

  function selectRadioGroup(buttons, value) {
    for (const key of Object.keys(buttons)) {
      buttons[key].classList.toggle("active", key === value);
      buttons[key].setAttribute("aria-checked", String(key === value));
    }
  }

  defaultEngineButtons.tools.addEventListener("click", () => {
    selectRadioGroup(defaultEngineButtons, "tools");
    persistSettings({ defaultEngine: "tools" });
  });
  defaultEngineButtons.google.addEventListener("click", () => {
    selectRadioGroup(defaultEngineButtons, "google");
    persistSettings({ defaultEngine: "google" });
  });
  clockFormatButtons.auto.addEventListener("click", () => {
    selectRadioGroup(clockFormatButtons, "auto");
    clockFormatPref = "auto";
    tick();
    persistSettings({ clockFormat: "auto" });
  });
  clockFormatButtons["12h"].addEventListener("click", () => {
    selectRadioGroup(clockFormatButtons, "12h");
    clockFormatPref = "12h";
    tick();
    persistSettings({ clockFormat: "12h" });
  });
  clockFormatButtons["24h"].addEventListener("click", () => {
    selectRadioGroup(clockFormatButtons, "24h");
    clockFormatPref = "24h";
    tick();
    persistSettings({ clockFormat: "24h" });
  });

  function persistSettings(partial) {
    getSettings((current) => {
      safeSet(SETTINGS_KEY, { ...current, ...partial });
    });
  }

  // ---------------------------------------------------------- quick shelf

  function pinIconSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/></svg>`;
  }

  function removeIconSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  }

  function renderQuickShelf() {
    const section = document.getElementById("quick-section");
    const grid = document.getElementById("quick-grid");

    getPins((pins) => {
      getRecents((recents) => {
        const pinnedTools = pins.map(toolBySlug).filter(Boolean);
        const pinnedSlugs = new Set(pinnedTools.map((t) => t.slug));
        const recentTools = recents
          .map((r) => toolBySlug(r.slug))
          .filter((t) => t && !pinnedSlugs.has(t.slug));

        let tools;
        let source;
        if (pinnedTools.length > 0 || recentTools.length > 0) {
          tools = [...pinnedTools, ...recentTools].slice(0, 8);
          source = "personal";
        } else {
          tools = EVERYUTILI_TOOLS.slice(0, 6);
          source = "default";
        }

        if (tools.length === 0) {
          section.hidden = true;
          return;
        }
        section.hidden = false;
        grid.innerHTML = "";

        for (const tool of tools) {
          const isPinned = pinnedSlugs.has(tool.slug);
          const isRecentOnly = source === "personal" && !isPinned;

          const pill = document.createElement("div");
          pill.className = "quick-pill glass";
          pill.title = tool.name;
          pill.addEventListener("click", () => openTool(tool, pill));

          const pinBtn = document.createElement("button");
          pinBtn.type = "button";
          pinBtn.className = "card-action pin-btn" + (isPinned ? " active" : "");
          pinBtn.setAttribute("aria-label", isPinned ? tr("unpinTool", [tool.name]) : tr("pinTool", [tool.name]));
          pinBtn.innerHTML = pinIconSvg();
          pinBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePin(tool.slug);
          });

          pill.innerHTML = `
            <span class="icon-box" data-category="${tool.category}">${iconSvg(tool.category)}</span>
            <span class="name">${escapeHtml(tool.name)}</span>
          `;
          pill.appendChild(pinBtn);

          if (isRecentOnly) {
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "card-action remove-btn";
            removeBtn.setAttribute("aria-label", tr("removeFromRecents", [tool.name]));
            removeBtn.innerHTML = removeIconSvg();
            removeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              removeRecent(tool.slug);
            });
            pill.appendChild(removeBtn);
          }

          grid.appendChild(pill);
        }
      });
    });
  }

  // ---------------------------------------------------------- drawer

  function renderDrawer() {
    const container = document.getElementById("drawer-categories");

    getPins((pins) => {
      const pinnedSet = new Set(pins);
      container.innerHTML = "";

      for (const cat of EVERYUTILI_CATEGORIES) {
        const tools = EVERYUTILI_TOOLS.filter((t) => t.category === cat.slug);

        const block = document.createElement("div");
        block.innerHTML = `
          <div class="drawer-cat-head">
            <span class="dot" style="background: var(--cat-${cat.slug})"></span>
            <h3>${escapeHtml(categoryLabel(cat.slug))}</h3>
            <span class="count">${tools.length}</span>
          </div>
        `;

        const grid = document.createElement("div");
        grid.className = "drawer-tool-grid";
        for (const tool of tools) {
          const isPinned = pinnedSet.has(tool.slug);
          const row = document.createElement("div");
          row.className = "drawer-tool glass";
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
            <span class="name">${escapeHtml(tool.name)}</span>
          `;
          row.appendChild(pinBtn);
          grid.appendChild(row);
        }
        block.appendChild(grid);
        container.appendChild(block);
      }
    });
  }

  const drawerToggle = document.getElementById("drawer-toggle");
  const drawerPanel = document.getElementById("drawer-panel");
  const drawerLabel = document.getElementById("drawer-toggle-label");
  let drawerOpen = false;

  function setDrawerOpen(open) {
    drawerOpen = open;
    // Build the drawer's DOM lazily, on first open, not at page load. Every
    // row carries `.glass` (a 20px backdrop-filter), so eagerly rendering
    // all ~80 tools meant ~80 simultaneous blur compositing layers sitting
    // in the DOM on every single new tab — collapsed to 0 height via
    // grid-template-rows, but still laid out and painted, not display:none —
    // which kept GPU/CPU usage elevated even while the new tab sat idle and
    // the drawer was never opened.
    if (open && !drawerRendered) {
      renderDrawer();
      drawerRendered = true;
    }
    drawerToggle.setAttribute("aria-expanded", String(open));
    drawerPanel.classList.toggle("open", open);
    drawerLabel.textContent = open
      ? tr("hideAllTools")
      : tr("browseAllTools", [String(EVERYUTILI_TOOLS.length)]);
  }

  drawerToggle.addEventListener("click", () => setDrawerOpen(!drawerOpen));

  // ---------------------------------------------------------- engine switch

  const searchInput = document.getElementById("search-input");
  const engineToolsBtn = document.getElementById("engine-tools");
  const engineGoogleBtn = document.getElementById("engine-google");
  const hintEnter = document.getElementById("hint-enter");
  let engine = "tools";

  // Tracks whether the user has actually touched the search box yet, so the
  // recent-query chips only ever appear from a genuine user-initiated focus
  // or clear — not from the page's own initial autofocus or from internal
  // runSearch("") calls fired during setup (e.g. applying saved settings).
  let userHasInteracted = false;

  function setEngine(next) {
    engine = next;
    engineToolsBtn.classList.toggle("active", engine === "tools");
    engineToolsBtn.setAttribute("aria-selected", String(engine === "tools"));
    engineGoogleBtn.classList.toggle("active", engine === "google");
    engineGoogleBtn.setAttribute("aria-selected", String(engine === "google"));
    hintEnter.textContent = engine === "google" ? tr("hintSearchGoogle") : tr("hintOpenTool");
    searchInput.placeholder = engine === "google"
      ? tr("searchPlaceholderGoogle")
      : tr("searchPlaceholderDefault");
    runSearch(searchInput.value);
  }

  engineToolsBtn.addEventListener("click", () => setEngine("tools"));
  engineGoogleBtn.addEventListener("click", () => setEngine("google"));

  // ---------------------------------------------------------- fuzzy search

  // levenshtein/initials/scoreMatch live in search.js (shared with popup.js).
  const { scoreMatch } = window.EveryUtiliSearch;

  const resultsEl = document.getElementById("search-results");
  const recentQueriesEl = document.getElementById("recent-queries");
  let activeIndex = -1;
  let currentResults = [];

  function effectiveQuery(raw) {
    return GOOGLE_PREFIX.test(raw) ? raw.replace(GOOGLE_PREFIX, "") : raw;
  }

  function runSearch(rawQuery) {
    const forcedGoogle = GOOGLE_PREFIX.test(rawQuery);
    const q = effectiveQuery(rawQuery).trim().toLowerCase();

    if (!q) {
      closeResults();
      if (userHasInteracted) showRecentQueries();
      return;
    }
    hideRecentQueries();

    if (engine === "google" || forcedGoogle) {
      currentResults = [{ __google: true, query: effectiveQuery(rawQuery).trim() }];
      activeIndex = 0;
      renderResults();
      openResults();
      return;
    }

    currentResults = EVERYUTILI_TOOLS.map((t) => ({ tool: t, score: scoreMatch(t, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.tool.priority - a.tool.priority)
      .slice(0, MAX_RESULTS)
      .map((r) => r.tool);

    activeIndex = currentResults.length > 0 ? 0 : -1;
    renderResults();
    openResults();
  }

  function openResults() {
    resultsEl.hidden = false;
    requestAnimationFrame(() => resultsEl.classList.add("open"));
  }

  function closeResults() {
    resultsEl.classList.remove("open");
    resultsEl.hidden = true;
    currentResults = [];
    activeIndex = -1;
  }

  function showRecentQueries() {
    getRecentQueries((queries) => {
      if (queries.length === 0) {
        hideRecentQueries();
        return;
      }
      recentQueriesEl.innerHTML = "";
      for (const q of queries) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "query-chip";
        chip.textContent = q;
        chip.addEventListener("click", () => {
          searchInput.value = q;
          searchInput.focus();
          runSearch(q);
        });
        recentQueriesEl.appendChild(chip);
      }
      recentQueriesEl.hidden = false;
    });
  }

  function hideRecentQueries() {
    recentQueriesEl.hidden = true;
  }

  function renderResults() {
    if (currentResults.length === 0) {
      resultsEl.innerHTML = `<div class="results-empty">${escapeHtml(tr("noToolsMatch"))}</div>`;
      return;
    }

    if (currentResults[0] && currentResults[0].__google) {
      const query = currentResults[0].query;
      resultsEl.innerHTML = "";
      const row = document.createElement("div");
      row.className = "result-row google-row active";
      row.addEventListener("click", () => {
        recordQuery(query);
        openGoogle(query, row);
      });
      row.innerHTML = `
        <span class="icon-box" data-category="google">
          <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M21.35 11.1H12v2.8h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95S8.78 6.1 12 6.1c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.6 14.55 2.6 12 2.6 6.98 2.6 2.9 6.7 2.9 11.7s4.08 9.1 9.1 9.1c5.25 0 8.74-3.7 8.74-8.9 0-.6-.07-1.05-.15-1.5Z"/></svg>
        </span>
        <span class="result-row-text">
          <span class="name">${escapeHtml(tr("searchGoogleFor", [query]))}</span>
          <span class="tagline">${escapeHtml(tr("opensInThisTab"))}</span>
        </span>
      `;
      resultsEl.appendChild(row);
      return;
    }

    resultsEl.innerHTML = "";
    currentResults.forEach((tool, i) => {
      const row = document.createElement("div");
      row.className = "result-row" + (i === activeIndex ? " active" : "");
      row.addEventListener("mouseenter", () => {
        activeIndex = i;
        highlightActive();
      });
      row.addEventListener("click", () => openTool(tool, row));
      row.innerHTML = `
        <span class="icon-box" data-category="${tool.category}">${iconSvg(tool.category)}</span>
        <span class="result-row-text">
          <span class="name">${escapeHtml(tool.name)}</span>
          <span class="tagline">${escapeHtml(tool.tagline)}</span>
        </span>
        <span class="badge" data-category="${tool.category}">${categoryLabel(tool.category)}</span>
      `;
      resultsEl.appendChild(row);
    });
  }

  function highlightActive() {
    const rows = resultsEl.querySelectorAll(".result-row");
    rows.forEach((row, i) => row.classList.toggle("active", i === activeIndex));
    const active = rows[activeIndex];
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function submitCurrent() {
    if (currentResults.length === 0) return;
    const activeRow = resultsEl.querySelector(".result-row.active");
    const first = currentResults[0];
    if (first && first.__google) {
      recordQuery(first.query);
      openGoogle(first.query, activeRow);
      return;
    }
    const tool = currentResults[activeIndex];
    if (tool) {
      recordQuery(searchInput.value);
      openTool(tool, activeRow);
    }
  }

  // "g <query>" always routes to Google regardless of the active engine pill
  // (handled inside runSearch via GOOGLE_PREFIX), so the input handler stays
  // a plain passthrough.
  searchInput.addEventListener("input", (e) => runSearch(e.target.value));

  searchInput.addEventListener("pointerdown", () => {
    userHasInteracted = true;
  });
  searchInput.addEventListener("keydown", () => {
    userHasInteracted = true;
  }, { capture: true, once: true });
  searchInput.addEventListener("focus", () => {
    if (userHasInteracted && !searchInput.value.trim()) showRecentQueries();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setEngine(engine === "tools" ? "google" : "tools");
      return;
    }
    if (e.ctrlKey && (e.key === "g" || e.key === "G")) {
      e.preventDefault();
      setEngine(engine === "tools" ? "google" : "tools");
      return;
    }

    if (resultsEl.hidden || currentResults.length === 0) {
      if (e.key === "Escape") {
        searchInput.value = "";
        closeResults();
        hideRecentQueries();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!(currentResults[0] && currentResults[0].__google)) {
        activeIndex = (activeIndex + 1) % currentResults.length;
        highlightActive();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!(currentResults[0] && currentResults[0].__google)) {
        activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
        highlightActive();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      submitCurrent();
    } else if (e.key === "Escape") {
      searchInput.value = "";
      closeResults();
      hideRecentQueries();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-shell")) {
      closeResults();
      hideRecentQueries();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ---------------------------------------------------------- init

  // Every static-markup string in newtab.html (the English fallback text
  // baked into the HTML so the page never shows blank while JS parses)
  // gets swapped for chrome.i18n's message in the user's Chrome UI language.
  function applyStaticI18n() {
    document.getElementById("offline-badge-label").textContent = tr("offlineBadge");
    settingsToggle.setAttribute("aria-label", tr("settingsAriaLabel"));
    document.getElementById("settings-default-search-label").textContent = tr("settingsDefaultSearch");
    document.getElementById("settings-default-search-group").setAttribute("aria-label", tr("settingsDefaultSearch"));
    document.getElementById("settings-clock-format-label").textContent = tr("settingsClockFormat");
    document.getElementById("settings-clock-format-group").setAttribute("aria-label", tr("settingsClockFormat"));
    defaultEngineButtons.tools.textContent = tr("engineEveryUtili");
    defaultEngineButtons.google.textContent = tr("engineGoogle");
    clockFormatButtons.auto.textContent = tr("clockAuto");
    clockFormatButtons["12h"].textContent = tr("clock12h");
    clockFormatButtons["24h"].textContent = tr("clock24h");

    document.getElementById("engine-tools-label").textContent = tr("engineEveryUtili");
    document.getElementById("engine-google-label").textContent = tr("engineGoogle");
    document.getElementById("engine-switch").setAttribute("aria-label", tr("hintSwitchEngine"));
    document.getElementById("hint-navigate").textContent = tr("hintNavigate");
    document.getElementById("hint-switch-engine").textContent = tr("hintSwitchEngine");
    document.getElementById("hint-clear").textContent = tr("hintClear");
    document.getElementById("quick-access-title").textContent = tr("quickAccessTitle");
  }

  applyStaticI18n();

  getSettings((settings) => {
    engine = settings.defaultEngine;
    setEngine(engine);
    clockFormatPref = settings.clockFormat;
    tick();
    selectRadioGroup(defaultEngineButtons, settings.defaultEngine);
    selectRadioGroup(clockFormatButtons, settings.clockFormat);
  });

  drawerLabel.textContent = tr("browseAllTools", [String(EVERYUTILI_TOOLS.length)]);
  renderQuickShelf();
  searchInput.focus();
})();
