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

**Requirements:** Python 3.7+ (no third-party packages needed).

```bash
python3 scripts/fetch_debates.py
```

This will:
- Fetch all 83 debate day pages from the Yale Avalon Project
- Save each as a JSON file in `data/`
- Generate `data/manifest.json`
- Take approximately 2–3 minutes (polite 1.5s delay between requests)

To re-fetch everything from scratch:
```bash
python3 scripts/fetch_debates.py --force
```

### 2. Build the bundle (required for file:// access)

```bash
python3 scripts/build_bundle.py
```

This bundles all the JSON files into `data/debates-bundle.js`, which allows the site to work when opened directly in a browser without a local HTTP server. The bundle is ~1.9MB and is loaded via a `<script>` tag in `debates.html`.

You only need to re-run this if you re-scrape the content.

### 3. Open the site

**Option A — Open directly (no server needed):**
Just open `index.html` in your browser. The bundled data loads fine on `file://`.

**Option B — Local HTTP server (also works):**
```bash
python3 -m http.server 8000
```
Then open: http://localhost:8000

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
