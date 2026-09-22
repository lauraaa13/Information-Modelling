/**
 * main.js — core logic shared by every page of the site
 * (Renzo Renzi Virtual Exhibition)
 *
 * No framework: a single global `Exhibition` object exposed on window,
 * loaded with <script src="js/main.js"></script> before each page's own
 * script (index/map/item/...).
 *
 * What this file does:
 *  1. Loads data/items.json and data/narratives.json
 *  2. Resolves an item / a narrative by id
 *  3. Computes the previous/next item within a narrative (prev/next)
 *  4. Handles theme switching (6 typographic themes) with persistence
 *  5. Handles selection of the "text type" (length/competence/tone grid)
 *
 * What it does NOT do (on purpose, for now):
 *  - it knows nothing about the map/room placement (depends on the
 *    museum floor plan, not chosen yet)
 *  - it knows nothing about the second narrative (not decided yet)
 *  - it does not render HTML: each page stays responsible for its own DOM,
 *    main.js only provides data and helper functions
 */

const Exhibition = (function () {
  "use strict";

  const DATA_PATHS = {
    items: "data/items.json",
    narratives: "data/narratives.json",
  };

  const THEME_STORAGE_KEY = "exhibition:theme";
  const TEXT_PREF_STORAGE_KEY = "exhibition:textPreference";

  // The 6 typographic themes, in historical-period order.
  // 'cssFile' must match the file in css/ (to be created by River).
  const THEMES = [
    { id: "theme-1", period: "1500–1800", label: "Baroque theatre / opera / carnival masks", cssFile: "css/theme-1.css" },
    { id: "theme-2", period: "19th century", label: "Melodrama theatre", cssFile: "css/theme-2.css" },
    { id: "theme-3", period: "First half of the 20th century", label: "Telefoni bianchi & Italian neorealism", cssFile: "css/theme-3.css" },
    { id: "theme-4", period: "Second half of the 20th century", label: "Fellini (and his collaboration with Renzi)", cssFile: "css/theme-4.css" },
    { id: "theme-5", period: "Late 20th – early 21st century (print)", label: "Commedia all'italiana", cssFile: "css/theme-5.css" },
    { id: "theme-6", period: "2035 (print + screen + ?)", label: "Interactive cinema", cssFile: "css/theme-6.css" },
  ];

  const DEFAULT_THEME_ID = "theme-3"; // opening theme, see project document

  let _cache = null; // { items: Map, narratives: Map } once loaded

  /** Loads (once) items.json + narratives.json and caches them. */
  async function load() {
    if (_cache) return _cache;

    const [itemsRes, narrativesRes] = await Promise.all([
      fetch(DATA_PATHS.items),
      fetch(DATA_PATHS.narratives),
    ]);

    if (!itemsRes.ok) throw new Error(`Could not load ${DATA_PATHS.items} (${itemsRes.status})`);
    if (!narrativesRes.ok) throw new Error(`Could not load ${DATA_PATHS.narratives} (${narrativesRes.status})`);

    const itemsJson = await itemsRes.json();
    const narrativesJson = await narrativesRes.json();

    const itemsById = new Map(itemsJson.items.map((it) => [it.id, it]));
    const narrativesById = new Map(narrativesJson.narratives.map((n) => [n.id, n]));

    _cache = { itemsById, narrativesById };
    return _cache;
  }

  /** Returns the item with this id, or null. Requires load() to have resolved. */
  function getItem(id) {
    if (!_cache) throw new Error("Exhibition.load() has not completed yet");
    return _cache.itemsById.get(id) || null;
  }

  /** Returns the narrative with this id, or null. */
  function getNarrative(id) {
    if (!_cache) throw new Error("Exhibition.load() has not completed yet");
    return _cache.narrativesById.get(id) || null;
  }

  /** Returns the array of items (full objects, not just ids) of a narrative, in their order. */
  function getNarrativeItems(narrativeId) {
    const narrative = getNarrative(narrativeId);
    if (!narrative) return [];
    return narrative.order
      .map((id) => getItem(id))
      .filter((it) => it !== null); // ignore any orphan ids in narratives.json
  }

  /**
   * Computes the item adjacent to currentItemId within narrativeId.
   * direction: 1 for "next", -1 for "prev".
   * Returns null if we are already at the first/last item (no wraparound,
   * on purpose: the UI can disable the button instead of looping).
   */
  function getAdjacentItem(narrativeId, currentItemId, direction) {
    const narrative = getNarrative(narrativeId);
    if (!narrative) return null;
    const idx = narrative.order.indexOf(currentItemId);
    if (idx === -1) return null;
    const targetId = narrative.order[idx + direction];
    return targetId ? getItem(targetId) : null;
  }

  function getNextItem(narrativeId, currentItemId) {
    return getAdjacentItem(narrativeId, currentItemId, 1);
  }

  function getPrevItem(narrativeId, currentItemId) {
    return getAdjacentItem(narrativeId, currentItemId, -1);
  }

  // ---------------------------------------------------------------------
  // Typographic themes
  // ---------------------------------------------------------------------

  function getThemes() {
    return THEMES;
  }

  function getCurrentTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.find((t) => t.id === stored) || THEMES.find((t) => t.id === DEFAULT_THEME_ID);
  }

  /** Applies the theme to the current document and remembers it for the next pages. */
  function setTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) {
      console.warn(`Unknown theme: ${themeId}`);
      return;
    }
    document.documentElement.setAttribute("data-theme", theme.id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    } catch (e) {
      // localStorage can fail (Safari private mode, storage full...): don't block the UI for this
      console.warn("Could not save the theme preference", e);
    }
  }

  /** Call this at the start of a page, before rendering, to avoid a flash of the wrong theme. */
  function applyStoredTheme() {
    const theme = getCurrentTheme();
    document.documentElement.setAttribute("data-theme", theme.id);
    return theme;
  }

  // ---------------------------------------------------------------------
  // "Text type" selectors (length / competence / tone grid)
  // ---------------------------------------------------------------------
  // Each item.texts is an array of { length, competence, tone, content }.
  // The exact keys (allowed values for length/competence/tone) are to be
  // confirmed with Claudia based on the final grid — reasonable defaults
  // are used below, easy to change in a single place.

  const TEXT_AXES_DEFAULTS = {
    length: "medium",
    competence: "general",
    tone: "neutral",
  };

  /**
   * Finds the best text for an item given partial filters,
   * e.g. findText(item, { length: "short" }).
   * If no exact match is found, returns the first available text
   * (better to show something than nothing).
   */
  function findText(item, filters = {}) {
    if (!item || !Array.isArray(item.texts) || item.texts.length === 0) return null;
    const wanted = { ...TEXT_AXES_DEFAULTS, ...filters };
    const exact = item.texts.find(
      (t) => t.length === wanted.length && t.competence === wanted.competence && t.tone === wanted.tone
    );
    return exact || item.texts[0];
  }

  function getTextPreference() {
    try {
      const raw = localStorage.getItem(TEXT_PREF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { ...TEXT_AXES_DEFAULTS };
    } catch (e) {
      return { ...TEXT_AXES_DEFAULTS };
    }
  }

  function setTextPreference(partialPrefs) {
    const current = getTextPreference();
    const updated = { ...current, ...partialPrefs };
    try {
      localStorage.setItem(TEXT_PREF_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save the text preference", e);
    }
    return updated;
  }

  // ---------------------------------------------------------------------
  // URL helpers — navigation state passed via query string,
  // e.g. item.html?narrative=timeline&item=il-primo-fellini
  // ---------------------------------------------------------------------

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function buildItemUrl(narrativeId, itemId) {
    const params = new URLSearchParams({ narrative: narrativeId, item: itemId });
    return `item.html?${params.toString()}`;
  }

  // Public API
  return {
    load,
    getItem,
    getNarrative,
    getNarrativeItems,
    getNextItem,
    getPrevItem,
    getThemes,
    getCurrentTheme,
    setTheme,
    applyStoredTheme,
    findText,
    getTextPreference,
    setTextPreference,
    getQueryParam,
    buildItemUrl,
  };
})();