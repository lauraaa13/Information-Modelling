# Architecture notes — Renzo Renzi Virtual Exhibition

Starting point for the "Architecture & Data" part (Laura). Bring this to the
meeting so Claudia and River can confirm the parts that concern them.

## Files created

- `data/items.json` — all 15 items with the fields already confirmed in the
  project document (title, creator, type, chosen metadata standard and
  rationale, holding institution, rights holder). Fields not yet known
  (date, images, texts, map position) are `null`/`[]` with a `_todo` comment
  next to them.
- `data/narratives.json` — the "timeline" narrative (required) with a first
  ordering of the items; the second narrative is an empty structure, ready
  to be filled in once it's decided.
- `js/main.js` — loads both JSON files, resolves item/narrative by id,
  computes prev/next within a narrative, handles theme switching (with
  localStorage persistence) and text-type selection. No external
  dependencies.
- `item.html` — a working skeleton that shows how the three files above fit
  together. It is not the final design (that's River's job), but the
  data/id structure underneath it can stay.

## Why this structure

- **items.json and narratives.json kept separate**: an item exists once with
  its fixed metadata; narratives are just ordered lists of ids. That way the
  same item can appear in more than one itinerary (required: the timeline +
  at least one other narrative) without duplicating data, and adding a
  narrative never touches items.json.
- **texts as an array of tagged objects** (`{length, competence, tone,
  content}`) instead of fixed fields: this adapts to whatever grid Claudia
  settles on (3 or 9 variants), and `Exhibition.findText()` picks the right
  text given the current filters, with a fallback if the exact combination
  is missing.
- **navigation via query string** (`item.html?narrative=timeline&item=...`):
  each page stays an independent static file (no framework, as required),
  URLs are shareable/bookmarkable, and prev/next is just a lookup in the
  current narrative's `order` array.
- **theme persisted in localStorage**: the visitor picks a typographic theme
  and it stays set while moving from one static page to the next.

## What I did NOT decide (needs the group)

1. **Item ↔ graphic theme relationship.** The requirement says "6 themes for
   groups of 3", inspired by historical periods. Is this a theme-skin the
   visitor freely picks on every page (as "switchable typographic themes" +
   a selector on every page seem to suggest), or does every item have a
   "suggested" default theme tied to its real-world period? If a
   `suggestedTheme` field per item is needed, it's a 5-minute add, but River
   should weigh in.
2. **Second narrative.** Still open on the group's TO DO list. The structure
   in narratives.json is ready to receive it as soon as it's chosen.
3. **Real chronology of the timeline.** The order currently in
   `narratives.json` is a placeholder (the order of the list in the project
   document), NOT a real chronological sequence — I don't have confirmed
   dates for every item. It needs to be corrected with the real dates
   (Claudia / Anna Fiaccarini).
4. **Map position** (`mapPosition`) — blocked by the choice of museum floor
   plan, still to be made.
5. **Exact text grid** (allowed values for length/competence/tone) — I set
   reasonable defaults in `main.js` (`TEXT_AXES_DEFAULTS`), to be aligned
   with whatever Claudia decides.

## Suggested next steps for you

1. Bring these files to the meeting, get points 1-5 above confirmed.
2. Once Claudia has first drafts of the texts, fill in `texts` for 2-3 items
   as a test, to validate that `findText()` behaves as expected.
3. Once the museum is chosen, add `map.html` following the same pattern as
   `item.html` (load data, draw the positions on the floor plan).
4. Remember Vitali's rule: declare any LLM use, and make sure you can
   explain every line — worth re-reading `main.js` carefully before the
   meeting rather than just pasting it in.
