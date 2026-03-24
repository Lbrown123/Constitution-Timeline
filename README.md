# The 1787 Constitutional Convention

An interactive website presenting James Madison's daily notes from the Constitutional Convention of 1787. A modern redesign of the [Yale Avalon Project archive](https://avalon.law.yale.edu/subject_menus/debcont.asp).

## Features

- Persistent bottom timeline bar — click any date to jump to that day's notes
- Keyboard navigation (← → arrow keys, Home/End)
- Bookmarkable URLs via URL hash (e.g. `debates.html#debates_529`)
- Delegate name links in debate text — hover for a popup profile card
- Filterable grid of all 55 delegates with portraits
- Individual delegate profile pages with Wikipedia bios
- "Further Reading" book recommendations per delegate
- Responsive design (mobile-friendly)

## Project Structure

```
Convention Website/
├── index.html              # Landing page
├── debates.html            # Debate reader (hash-based SPA)
├── attendees.html          # Filterable delegate grid
├── attendee.html           # Individual delegate profile (hash-based)
├── books.html              # Further Reading page
├── css/styles.css          # All styles
├── js/
│   ├── main.js             # Shared utilities (fetchJSON, initNav)
│   ├── debates.js          # Timeline nav + debate renderer
│   ├── delegate-popup.js   # Hover popup for delegate links
│   └── books.js            # Shared book-card renderer
├── data/
│   ├── manifest.json       # Index of all debate entries
│   ├── debates-bundle.js   # Auto-generated bundle (do not edit)
│   ├── debates/            # One JSON file per debate day
│   ├── attendees/          # Delegate card + full profile JSONs
│   └── books.json          # Manually maintained book recommendations
├── images/
│   ├── attendees/          # Delegate portraits (.webp)
│   └── books/              # Book cover art
└── scripts/
    ├── fetch_debates.py    # Scrapes Yale Avalon for debate data
    ├── fetch_debates.js    # Node.js equivalent of above
    ├── fetch_attendees.py  # Scrapes Wikipedia for delegate data + photos
    ├── link_delegates.py   # Wraps delegate names in debate HTML with links
    └── build_bundle.py     # Bundles all JSON into debates-bundle.js
```

## Setup & Local Development

### 1. Fetch debate content

```bash
python3 scripts/fetch_debates.py
```

Scrapes all debate day pages from Yale Avalon, writes `data/debates/debates_*.json` and `data/manifest.json`. Takes ~2–3 minutes (polite 1.5s delay between requests). To re-fetch everything from scratch: add `--force`.

### 2. Fetch delegate data

```bash
python3 scripts/fetch_attendees.py
```

Scrapes Wikipedia for all 55 delegates, writes `data/attendees/attendees.json`, `data/attendees/attendee_*.json`, and portrait images to `images/attendees/*.webp`. Flags:

| Flag | Effect |
|------|--------|
| *(none)* | Fetch delegates whose JSON + card image don't already exist |
| `--force` | Re-fetch all 55 delegates |
| `--photos-only` | Re-download only missing portrait images (skips page scraping) |

> Wikimedia rate-limits bulk downloads. If you get 429 errors, wait a few minutes and retry with `--photos-only`.

### 3. Link delegate names

```bash
python3 scripts/link_delegates.py
```

Scans every debate day's `contentHtml` and wraps delegate name mentions with `<a class="delegate-link" data-attendee-id="…">` tags. These power the hover popup and click-through navigation. Run this after any re-scrape or after modifying the pattern table in the script itself.

Flags: `--dry-run` (preview changes without writing), `--stats` (print per-delegate link counts).

### 4. Build the bundle

```bash
python3 scripts/build_bundle.py
```

Bundles all JSON files into `data/debates-bundle.js` as JS globals. Required for the site to work when opened directly from the filesystem (`file://`). **Run this after any change to JSON data files.**

### 5. Open the site

**Option A — Open directly (no server needed):**
Open `index.html` in your browser. The bundle handles `file://` access.

**Option B — Local HTTP server:**
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Common Update Tasks

### Edit a debate day's summary
1. Open `data/debates/debates_MMDD.json`
2. Edit the `summary` field (HTML is supported — `<strong>`, `<em>`, `<p>`, etc.)
3. Run `python3 scripts/build_bundle.py`

### Re-scrape all debate data
```bash
python3 scripts/fetch_debates.py --force
python3 scripts/link_delegates.py
python3 scripts/build_bundle.py
```

### Refresh all delegate profiles from Wikipedia
```bash
python3 scripts/fetch_attendees.py --force
python3 scripts/build_bundle.py
```

### Edit a delegate's bio manually
1. Open `data/attendees/attendee_{id}.json` (e.g. `attendee_james_madison.json`)
2. Edit `introHtml` or `conventionHtml` (HTML is supported)
3. Run `python3 scripts/build_bundle.py`

### Add or edit a book recommendation
1. Open `data/books.json`
2. Add a book to `general` (not delegate-specific) or to a delegate's `books` array under `delegates`
3. Run `python3 scripts/build_bundle.py`

To add a delegate entry that doesn't exist yet:
```json
"james_madison_jr": {
  "name": "James Madison Jr.",
  "books": []
}
```
The key must match the delegate's `id` in `data/attendees/attendees.json`.

Book entry format:
```json
{
  "title": "James Madison: A Life Reconsidered",
  "author": "Lynne Cheney",
  "cover": "images/books/madison_cheney.jpg",
  "description": "A thorough biography drawing on new research.",
  "link": "https://bookshop.org/p/books/..."
}
```
`cover` is optional. Store cover images in `images/books/` (~200×300px recommended).

### Add a new debate day
1. Add an entry to the `DAYS` list in both `scripts/fetch_debates.py` and `scripts/fetch_debates.js`
2. Run `python3 scripts/fetch_debates.py`
3. Run `python3 scripts/link_delegates.py`
4. Run `python3 scripts/build_bundle.py`

### Add a non-debate page (like the Context intro)
1. Create `data/debates/{id}.json` with `id`, `label`, `title`, `summary` — no `contentHtml`
2. Add it to `manifest.json` with `"month": 0` (groups under "Intro")
3. Run `python3 scripts/build_bundle.py`

---

## Delegate Name Linking Details

`scripts/link_delegates.py` uses a `RAW_PATTERNS` table mapping regex strings to delegate IDs. All patterns are case-insensitive (handles "Mr. Madison" and "Mr. MADISON"). The script is idempotent — it strips existing `.delegate-link` tags before each run.

**Disambiguation rules baked into the pattern table:**
- "Mr. Morris" (unqualified) → Gouverneur Morris (spoke far more often than Robert Morris)
- "Mr. Martin" → Luther Martin
- "Mr. Houston" → William Houston (Georgia)
- "Genl. Pinkney" → Charles Cotesworth Pinckney; plain "Mr. Pinkney/Pinckney" → Charles Pinckney

**Known spelling variants in Madison's source text:** `Dickenson` (Dickinson), `Ghorum` (Gorham), `Rutlidge` (Rutledge), `Pinkney` (Pinckney), `Sharman` (Sherman), `Elseworth`/`Elsewth` (Ellsworth), `Carrol` (Carroll), `M'Clurg`/`M'Henry` (McClurg/McHenry).

---

## Attendees Feature Notes

### Big State / Small State classification
Based on the historical Convention divide over representation:
- **Big states** (proportional representation): Virginia, Pennsylvania, Massachusetts, New York, North Carolina, South Carolina, Georgia
- **Small states** (equal state representation): Connecticut, Delaware, New Jersey, New Hampshire, Maryland

### Portrait photos
- 46 of 55 delegates have portraits from Wikimedia Commons (public domain, WebP quality 82)
- 9 delegates use `images/attendees/placeholder.webp` (no Wikipedia portrait): Richard Bassett, George Read, William Houston, William L. Pierce, John Langdon, William C. Houston, Robert Yates, Pierce Butler, Charles Pinckney
- Card portraits: 200×250px (`{id}.webp`); profile portraits: 350px wide (`{id}_lg.webp`)

---

## Deployment

### GitHub Pages
1. Push the repo to GitHub (include `data/` and `images/` folders)
2. Go to **Settings → Pages**, set source to branch `main`, folder `/ (root)`
3. Live at `https://yourusername.github.io/your-repo-name/`

The `.nojekyll` file in the root prevents Jekyll processing.

### Netlify
Drag the project folder onto [app.netlify.com](https://app.netlify.com), or connect the GitHub repo with build command blank and publish directory `.`. No build step needed.

---

## Content Source

> *Notes of Debates in the Federal Convention of 1787 Reported by James Madison*
> Edited by Gaillard Hunt and James Brown Scott — Oxford University Press, 1920
> Archived by the [Yale Law School Avalon Project](https://avalon.law.yale.edu/)

This site is for educational purposes.
