// debates.js — Timeline, content loading, and rendering for debates.html

'use strict';

let manifest = null;        // Loaded from data/manifest.json
let currentDayId = null;    // ID of the currently displayed day
const dayCache = {};         // In-memory cache: { id: debateData }

// ============================================================
// Entry point
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Use pre-bundled data (works on file://) if available, otherwise fetch
    if (window.__DEBATES_MANIFEST__) {
      manifest = window.__DEBATES_MANIFEST__;
    } else {
      manifest = await fetchJSON('data/manifest.json');
    }
  } catch (err) {
    showFatalError('Could not load debate index. Make sure you have run scripts/build_bundle.py and that data/debates-bundle.js exists.', err);
    return;
  }

  buildTimeline(manifest.days);
  initTimelineScrollButtons();

  // Determine starting day from URL hash, or default to first
  const hashId = getHashId();
  const startDay = manifest.days.find(d => d.id === hashId) || manifest.days[0];
  await loadDay(startDay.id);

  // Keyboard navigation
  document.addEventListener('keydown', handleKeyNav);

  // Browser back/forward
  window.addEventListener('hashchange', async () => {
    const id = getHashId();
    if (id && id !== currentDayId) {
      await loadDay(id);
    }
  });
});

// ============================================================
// URL hash helpers
// ============================================================
function getHashId() {
  const hash = window.location.hash.slice(1);
  if (hash && manifest && manifest.days.find(d => d.id === hash)) {
    return hash;
  }
  return null;
}

function setHash(id) {
  history.replaceState(null, '', `#${id}`);
}

// ============================================================
// Timeline construction
// ============================================================
function buildTimeline(days) {
  const inner = document.getElementById('timeline-inner');
  if (!inner) return;

  const byMonth = groupByMonth(days);

  for (const [month, monthDays] of Object.entries(byMonth)) {
    const group = document.createElement('div');
    group.className = 'timeline-month-group';

    const label = document.createElement('span');
    label.className = 'timeline-month-label';
    label.textContent = monthName(Number(month));
    group.appendChild(label);

    const daysRow = document.createElement('div');
    daysRow.className = 'timeline-days';

    for (const day of monthDays) {
      const btn = document.createElement('button');
      btn.className = 'timeline-day';
      btn.dataset.id = day.id;
      btn.title = day.notable ? `${day.label} — ${day.notable}` : day.label;
      btn.setAttribute('aria-label', day.notable ? `${day.label}, 1787 — ${day.notable}` : `${day.label}, 1787`);

      // Show just the day number (e.g. "28" from "May 28")
      const parts = day.label.split(' ');
      btn.textContent = parts[parts.length - 1];

      if (day.notable) btn.classList.add('notable');

      daysRow.appendChild(btn);
    }

    group.appendChild(daysRow);
    inner.appendChild(group);
  }

  // Click handler (event delegation)
  inner.addEventListener('click', e => {
    const btn = e.target.closest('.timeline-day');
    if (btn) loadDay(btn.dataset.id);
  });
}

// ============================================================
// Timeline scroll arrow buttons
// ============================================================
function initTimelineScrollButtons() {
  const scrollable = document.getElementById('timeline-scrollable');
  const leftBtn = document.getElementById('timeline-scroll-left');
  const rightBtn = document.getElementById('timeline-scroll-right');
  if (!scrollable || !leftBtn || !rightBtn) return;

  leftBtn.addEventListener('click', () => {
    scrollable.scrollBy({ left: -240, behavior: 'smooth' });
  });
  rightBtn.addEventListener('click', () => {
    scrollable.scrollBy({ left: 240, behavior: 'smooth' });
  });
}

// ============================================================
// Load & render a day
// ============================================================
async function loadDay(id) {
  if (!id) return;
  currentDayId = id;

  setActiveTimeline(id);
  setHash(id);
  showLoading(true);

  let data;
  try {
    data = await getDay(id);
  } catch (err) {
    showLoading(false);
    showContentError(`Could not load debate for ${id}.`, err);
    return;
  }

  renderDay(data);
  showLoading(false);

  // Scroll content area back to top
  const contentArea = document.getElementById('debates-content');
  if (contentArea) contentArea.scrollTop = 0;

  // Preload adjacent days in the background
  const idx = manifest.days.findIndex(d => d.id === id);
  const prev = manifest.days[idx - 1];
  const next = manifest.days[idx + 1];
  if (prev && !dayCache[prev.id]) getDay(prev.id).catch(() => {});
  if (next && !dayCache[next.id]) getDay(next.id).catch(() => {});
}

async function getDay(id) {
  if (dayCache[id]) return dayCache[id];
  const meta = manifest.days.find(d => d.id === id);
  if (!meta) throw new Error(`Unknown day ID: ${id}`);
  // Use pre-bundled data if available, otherwise fetch the individual JSON file
  const data = (window.__DEBATES_DATA__ && window.__DEBATES_DATA__[id])
    ? window.__DEBATES_DATA__[id]
    : await fetchJSON(`data/${meta.file}`);
  dayCache[id] = data;
  return data;
}

// ============================================================
// Render a day's content into the DOM
// ============================================================
function renderDay(data) {
  const idx = manifest.days.findIndex(d => d.id === data.id);
  const meta = manifest.days[idx];

  // Day counter
  const counter = document.getElementById('day-counter');
  if (counter) counter.textContent = `Day ${idx + 1} of ${manifest.days.length}`;

  // Notable badge
  const badge = document.getElementById('day-notable-badge');
  if (badge) {
    if (meta && meta.notable) {
      badge.textContent = meta.notable;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Title
  const titleEl = document.getElementById('day-title');
  if (titleEl) titleEl.textContent = data.title || meta.label;

  // Debate body
  const bodyEl = document.getElementById('debate-body');
  if (bodyEl) {
    bodyEl.innerHTML = data.contentHtml || '<p><em>No content available for this day.</em></p>';
  }

  // Prev/Next navigation
  updateDayNav(idx);

  // Update page title
  document.title = `${data.title || meta.label} — The 1787 Convention`;
}

// ============================================================
// Prev / Next navigation
// ============================================================
function updateDayNav(currentIdx) {
  const prevBtn = document.getElementById('prev-day');
  const nextBtn = document.getElementById('next-day');
  const prevLabel = document.getElementById('prev-day-label');
  const nextLabel = document.getElementById('next-day-label');

  const prev = manifest.days[currentIdx - 1];
  const next = manifest.days[currentIdx + 1];

  if (prevBtn) {
    prevBtn.disabled = !prev;
    if (prevLabel) prevLabel.textContent = prev ? prev.label : 'Previous';
    prevBtn.onclick = prev ? () => loadDay(prev.id) : null;
  }

  if (nextBtn) {
    nextBtn.disabled = !next;
    if (nextLabel) nextLabel.textContent = next ? next.label : 'Next';
    nextBtn.onclick = next ? () => loadDay(next.id) : null;
  }
}

// ============================================================
// Active state helpers
// ============================================================
function setActiveTimeline(id) {
  document.querySelectorAll('.timeline-day.active').forEach(el => el.classList.remove('active'));
  const btn = document.querySelector(`.timeline-day[data-id="${id}"]`);
  if (btn) {
    btn.classList.add('active');
    // Scroll the button into the center of the scrollable timeline
    const scrollable = document.getElementById('timeline-scrollable');
    if (scrollable) {
      const btnLeft = btn.offsetLeft;
      const btnWidth = btn.offsetWidth;
      const scrollableWidth = scrollable.offsetWidth;
      scrollable.scrollTo({
        left: btnLeft - (scrollableWidth / 2) + (btnWidth / 2),
        behavior: 'smooth',
      });
    }
  }
}

// ============================================================
// Keyboard navigation
// ============================================================
function handleKeyNav(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const idx = manifest.days.findIndex(d => d.id === currentDayId);

  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = manifest.days[idx - 1];
    if (prev) loadDay(prev.id);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = manifest.days[idx + 1];
    if (next) loadDay(next.id);
  } else if (e.key === 'Home') {
    e.preventDefault();
    loadDay(manifest.days[0].id);
  } else if (e.key === 'End') {
    e.preventDefault();
    loadDay(manifest.days[manifest.days.length - 1].id);
  }
}

// ============================================================
// Loading states
// ============================================================
function showLoading(visible) {
  const loading = document.getElementById('day-loading');
  const content = document.getElementById('day-content');
  if (loading) loading.classList.toggle('visible', visible);
  if (content) content.classList.toggle('hidden', visible);
}

function showFatalError(message, err) {
  const content = document.getElementById('debates-content');
  if (!content) return;
  content.innerHTML = `
    <div class="debates-content__inner">
      <div class="error-message">
        <strong>Unable to load debates</strong>
        ${message}
        ${err ? `<br><small style="opacity:0.6;margin-top:0.5rem;display:block;">${err.message}</small>` : ''}
      </div>
    </div>
  `;
  showLoading(false);
}

function showContentError(message, err) {
  const bodyEl = document.getElementById('debate-body');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="error-message">
        <strong>Could not load this day's notes</strong>
        ${message}
        ${err ? `<br><small style="opacity:0.6;margin-top:0.5rem;display:block;">${err.message}</small>` : ''}
      </div>
    `;
  }
}

// ============================================================
// Utility helpers
// ============================================================
function groupByMonth(days) {
  const groups = {};
  for (const day of days) {
    const m = String(day.month);
    if (!groups[m]) groups[m] = [];
    groups[m].push(day);
  }
  return groups;
}

const MONTH_NAMES = {
  5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September'
};

function monthName(num) {
  return MONTH_NAMES[num] || String(num);
}
