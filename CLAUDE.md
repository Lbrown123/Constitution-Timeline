# CLAUDE.md — 1787 Constitutional Convention Website

## Overview
Static site presenting Madison's and Rufus King's daily Convention notes + delegate profiles. Served via GitHub Pages. All content stored as JSON; `data/data-bundle.js` bundles it for `file://` use.

## Data Loading Architecture
Every page uses a two-path strategy:
1. **Bundle (`file://`)** — reads JS globals injected by `data/data-bundle.js`
2. **HTTP** — fetches individual JSON files via `fetch()`

| Page | Bundle globals | HTTP fallback |
|------|---------------|---------------|
| `debates.html` | `window.__DEBATES_MANIFEST__`, `window.__DEBATES_DATA__` | `data/manifest.json`, `data/debates/debates_*.json` |
| `attendees.html` | `window.__ATTENDEES_MANIFEST__` | `data/attendees/attendees.json` |
| `attendee.html` | `window.__ATTENDEES_DATA__[id]`, `window.__BOOKS_DATA__` | `data/attendees/attendee_{id}.json`, `data/books.json` |
| `books.html` | `window.__BOOKS_DATA__` | `data/books.json` |

**Always run `python3 scripts/build_bundle.py` after editing any JSON file.**

## Data Pipelines
```
# Debates
fetch_debates.py   →  data/debates/debates_*.json + data/manifest.json
fetch_king_notes.py→  adds kingContentHtml + kingWordCount to debates_*.json; sets hasKingNotes in manifest
link_delegates.py  →  rewrites contentHtml, kingContentHtml, summary with <a class="delegate-link"> tags
build_bundle.py    →  data/data-bundle.js  (sets __DEBATES_MANIFEST__ + __DEBATES_DATA__)

# Attendees
fetch_attendees.py  →  data/attendees/*.json + images/attendees/*.webp
build_bundle.py     →  appends __ATTENDEES_MANIFEST__ + __ATTENDEES_DATA__ to bundle

# Books (manual only)
data/books.json  →  build_bundle.py  →  __BOOKS_DATA__ in bundle
```

## Key Files

| File | Role |
|------|------|
| `debates.html` | Debate reader (hash-based SPA) with Madison/King toggle |
| `css/styles.css` | All styles (§1–18 debates/shared; §14a notes toggle; §19–20 attendees; §21 popup; §22 books) |
| `js/debates.js` | Timeline nav + debate day renderer + notes source toggle |
| `js/delegate-popup.js` | Hover/focus popup for `.delegate-link` elements |
| `data/manifest.json` | Index of all debate entries; `hasKingNotes: true` on days with King's notes |
| `data/debates/debates_*.json` | One JSON file per debate day |
| `data/books.json` | **Manually maintained** book recommendations |
| `data/data-bundle.js` | **Auto-generated** — never edit manually |
| `scripts/fetch_king_notes.py` | Scrapes King's notes; writes `kingContentHtml` to debate JSONs |
| `scripts/link_delegates.py` | Wraps delegate names in `contentHtml`, `kingContentHtml`, `summary` |
| `scripts/build_bundle.py` | Bundles all JSON into `data-bundle.js` |

## JSON Schemas

**`data/debates/debates_*.json`** key fields: `id`, `dates[]`, `label`, `title`, `summary`, `contentHtml` (optional — if absent, notes section + bottom nav hidden), `kingContentHtml` (optional — King's notes for that day), `footnotes[]`

**`data/manifest.json`** day entries include `hasKingNotes: true` when `kingContentHtml` exists for that day. The UI uses this flag to show/hide the Madison/King toggle without loading the full day JSON.

**`data/attendees/attendees.json`** entries: `id`, `name`, `state`, `stateSize`, `occupationCategory`, `ageAtConvention`, `ageDecade`, `signedConstitution`, `photoCard`, `photoProfile`

**`data/books.json`**: `{ "general": [...], "delegates": { "id": { "name": "...", "books": [...] } } }`

## Rules & Gotchas
- `data-bundle.js` is auto-generated — never edit it manually
- `data/books.json` is manually maintained — never auto-generate it
- After scraping King's notes: run `link_delegates.py` then `build_bundle.py`
- Delegate `id` must be consistent across `attendees.json`, `attendee_{id}.json`, image filenames, and `books.json` keys
- The first manifest entry (`context`) has `summary` only and no `contentHtml`; Day 0, Day 1 = May 14
- The notes toggle is hidden via `style.display` (not the `hidden` attribute) because `.notes-toggle { display: flex }` overrides the UA stylesheet
