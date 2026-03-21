# The 1787 Constitutional Convention

An interactive website presenting James Madison's daily notes from the Constitutional Convention of 1787. A modern redesign of the [Yale Avalon Project archive](https://avalon.law.yale.edu/subject_menus/debcont.asp).

## Features

- Persistent bottom timeline bar — click any date to jump to that day's notes
- Sidebar navigation grouped by month
- Keyboard navigation (← → arrow keys, Home/End)
- Bookmarkable URLs via URL hash (e.g. `debates.html#debates_529`)
- Collapsible attendee lists and editorial footnotes
- Responsive design (mobile-friendly horizontal timeline scroll)

## Project Structure

```
Convention Website/
├── index.html          # Landing page
├── debates.html        # Main reader (single-page app)
├── css/styles.css      # All styles
├── js/main.js          # Shared utilities
├── js/debates.js       # Timeline + debate loader
├── data/
│   ├── manifest.json   # Index of all 87 debate days
│   └── debates_*.json  # One JSON file per debate day
└── scripts/
    └── fetch_debates.js  # Node.js scraper (local dev only)
```

## Setup

### 1. Fetch the debate content

The `data/` folder needs to be populated by running the scraper. This only needs to be done once (or when you want to refresh the content).

**Requirements:** Node.js 18 or later (uses built-in `fetch`).

```bash
node scripts/fetch_debates.js
```

This will:
- Fetch all 87 debate day pages from the Yale Avalon Project
- Save each as a JSON file in `data/`
- Generate `data/manifest.json`
- Take approximately 2–3 minutes (polite 1.5s delay between requests)

To re-fetch everything from scratch:
```bash
node scripts/fetch_debates.js --force
```

To regenerate `manifest.json` only (without re-fetching pages):
```bash
node scripts/fetch_debates.js --manifest-only
```

### 2. Run locally

Because the site uses `fetch()` to load JSON files, you need a local HTTP server — opening `index.html` directly in a browser (`file://` protocol) will not work.

**Option A — Python (no install needed):**
```bash
python3 -m http.server 8000
```
Then open: http://localhost:8000

**Option B — Node.js:**
```bash
npx serve .
```

## Deployment

### GitHub Pages

1. Push the repository to GitHub (include the `data/` folder with all JSON files)
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch**, branch: `main`, folder: `/ (root)`
4. The site will be live at `https://yourusername.github.io/your-repo-name/`

The `.nojekyll` file in the root ensures GitHub Pages serves files as-is without Jekyll processing.

### Netlify

**Option A — Drag and drop:**
Drag the project folder onto [app.netlify.com](https://app.netlify.com).

**Option B — Connect repo:**
1. Connect your GitHub repo in Netlify
2. Build command: *(leave blank)*
3. Publish directory: `.` (root)

No build step is needed.

## Content Source

Text comes from:
> *Notes of Debates in the Federal Convention of 1787 Reported by James Madison*
> Edited by Gaillard Hunt and James Brown Scott
> Oxford University Press, 1920
> Archived by the [Yale Law School Avalon Project](https://avalon.law.yale.edu/)

This site is for educational purposes.
