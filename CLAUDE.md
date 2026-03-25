# CLAUDE.md — 1787 Constitutional Convention Website

## Overview
Static site presenting James Madison's daily Convention notes + biographical profiles of all 55 delegates. Served via GitHub Pages. All content is stored as JSON; `data/data-bundle.js` bundles it for `file://` use.

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
fetch_debates.py  →  data/debates/debates_*.json + data/manifest.json
link_delegates.py →  rewrites contentHtml to wrap delegate names in <a class="delegate-link"> tags
build_bundle.py   →  data/data-bundle.js  (sets __DEBATES_MANIFEST__ + __DEBATES_DATA__)

# Attendees
fetch_attendees.py  →  data/attendees/*.json + images/attendees/*.webp
build_bundle.py     →  appends __ATTENDEES_MANIFEST__ + __ATTENDEES_DATA__ to bundle

# Books (manual only)
data/books.json  →  build_bundle.py  →  __BOOKS_DATA__ in bundle
```

## Key Files

| File | Role |
|------|------|
| `index.html` | Landing page |
| `debates.html` | Debate reader (hash-based SPA) |
| `attendees.html` | Filterable delegate grid |
| `attendee.html` | Individual delegate profile (hash-based) |
| `css/styles.css` | All styles (§1–18 debates/shared; §19–20 attendees; §21 popup; §22 books) |
| `js/debates.js` | Timeline nav + debate day renderer |
| `js/delegate-popup.js` | Hover/focus popup for `.delegate-link` elements |
| `js/books.js` | Shared book-card renderer (`loadBooksData`, `renderBooksInto`, `renderBooksForDelegate`) |
| `data/manifest.json` | Index of all debate entries (context page + debate days) |
| `data/debates/debates_*.json` | One JSON file per debate day |
| `data/attendees/attendees.json` | Card-level metadata for all 55 delegates |
| `data/attendees/attendee_*.json` | Full delegate profile (bio HTML + convention HTML) |
| `data/books.json` | **Manually maintained** book recommendations |
| `data/data-bundle.js` | **Auto-generated** — never edit manually |
| `scripts/fetch_debates.py` | Scrapes Yale Avalon for debate data |
| `scripts/fetch_attendees.py` | Scrapes Wikipedia for delegate bios + photos |
| `scripts/link_delegates.py` | Wraps delegate name mentions in debate HTML with `<a>` links |
| `scripts/build_bundle.py` | Bundles all JSON into `data-bundle.js` |

## JSON Schemas

**`data/debates/debates_*.json`** key fields: `id`, `dates[]`, `label`, `title`, `summary` (HTML supported), `contentHtml` (optional — if absent, Madison's Notes section + bottom nav are hidden), `footnotes[]`

**`data/attendees/attendees.json`** entries: `id`, `name`, `state`, `stateSize` (`"big"`/`"small"`), `occupationCategory`, `ageAtConvention`, `ageDecade`, `signedConstitution`, `photoCard`, `photoProfile`

**`data/attendees/attendee_{id}.json`**: all card fields plus `introHtml`, `conventionHtml` (Wikipedia content, HTML)

**`data/books.json`**: `{ "general": [...], "delegates": { "id": { "name": "...", "books": [...] } } }`. Book entries: `title`, `author`, `cover` (optional path), `description` (HTML ok), `link`.

## Rules & Gotchas
- `data-bundle.js` is auto-generated — never edit it manually
- `data/books.json` is manually maintained — never auto-generate it
- Run `link_delegates.py` after re-scraping debates; always follow with `build_bundle.py`
- Delegate `id` must be consistent across `attendees.json`, `attendee_{id}.json`, image filenames, and `books.json` keys
- The first manifest entry (`context`) is a special non-debate page with `summary` only and no `contentHtml`; Day numbering starts at 0 for it, Day 1 = May 14
- `delegate-popup.js` is currently only loaded on `debates.html`; it's self-contained and can be added to other pages via a `<script>` tag
