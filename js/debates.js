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
    showFatalError('Could not load debate index. Make sure you have run scripts/build_bundle.py and that data/data-bundle.js exists.', err);
    return;
  }

  buildTimeline(manifest.days);
  initTimelineScrollButtons();
  initTimelineStickyMonth();

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
// Sticky month label overlay
// ============================================================
function initTimelineStickyMonth() {
  const scrollable = document.getElementById('timeline-scrollable');
  const overlay = document.getElementById('timeline-sticky-month');
  if (!scrollable || !overlay) return;

  // Align overlay top with actual native label position (robust across browsers).
  // Subtract border-top because absolute `top` is measured from the padding edge, not the border edge.
  const bar = document.getElementById('timeline-bar');
  const firstLabel = document.querySelector('.timeline-month-label');
  if (bar && firstLabel) {
    const barRect = bar.getBoundingClientRect();
    const labelRect = firstLabel.getBoundingClientRect();
    const barBorderTop = parseFloat(getComputedStyle(bar).borderTopWidth) || 0;
    overlay.style.top = (labelRect.top - barRect.top - barBorderTop) + 'px';
  }

  let rafId = null;

  function update() {
    rafId = null;
    const scrollableRect = scrollable.getBoundingClientRect();
    const leftEdge = scrollableRect.left;

    const groups = Array.from(document.querySelectorAll('.timeline-month-group'));
    if (!groups.length) return;

    // Current group = first group that has any content visible at or past the left edge
    let currentGroup = null;
    for (const group of groups) {
      if (group.getBoundingClientRect().right > leftEdge) {
        currentGroup = group;
        break;
      }
    }
    if (!currentGroup) return;

    const nativeLabel = currentGroup.querySelector('.timeline-month-label');
    const nativeLabelRect = nativeLabel.getBoundingClientRect();

    // If the native label is still visible, hide the overlay
    if (nativeLabelRect.right >= leftEdge) {
      overlay.style.opacity = '0';
      return;
    }

    // Native label has scrolled off — show overlay with current month name
    overlay.textContent = nativeLabel.textContent;
    overlay.style.opacity = '1';

    // Push overlay leftward as the next month's group scrolls in
    const currentIdx = groups.indexOf(currentGroup);
    const nextGroup = groups[currentIdx + 1];
    let pushX = 0;
    if (nextGroup) {
      const nextGroupX = nextGroup.getBoundingClientRect().left;
      const overlayWidth = overlay.offsetWidth;
      const overlayLeft = overlay.getBoundingClientRect().left;
      const pushStart = overlayLeft + overlayWidth;
      if (nextGroupX < pushStart) {
        pushX = nextGroupX - pushStart; // negative: slides overlay out to the left
      }
    }

    overlay.style.transform = `translateX(${pushX}px)`;
  }

  function onScroll() {
    if (!rafId) rafId = requestAnimationFrame(update);
  }

  scrollable.addEventListener('scroll', onScroll, { passive: true });
  update();
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
  if (counter) counter.textContent = `Day ${idx} of ${manifest.days.length - 1}`;

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

  // Day of week
  const dowEl = document.getElementById('day-dayofweek');
  if (dowEl) dowEl.textContent = getDayOfWeek(data.dates && data.dates[0]);

  // Full date with year
  const dateEl = document.getElementById('day-date');
  if (dateEl) dateEl.textContent = formatFullDate(data.dates && data.dates[0], data.title || meta.label);

  // Summary title (hidden on pages without Madison's Notes)
  const summaryTitle = document.querySelector('.day-summary .day-section-title');
  if (summaryTitle) summaryTitle.style.display = data.contentHtml ? '' : 'none';

  // Summary
  const summaryEl = document.getElementById('day-summary-text');
  if (summaryEl) {
    if (data.summary) {
      summaryEl.innerHTML = data.summary;
      summaryEl.classList.remove('day-summary-placeholder');
    } else {
      summaryEl.textContent = 'A brief summary of this day\'s proceedings will be added here.';
      summaryEl.classList.add('day-summary-placeholder');
    }
  }

  // Debate body and bottom nav (hidden on pages without notes)
  const notesSection = document.querySelector('.day-notes-section');
  const bottomNav = document.querySelector('.day-nav:not(.day-nav--top)');
  const bodyEl = document.getElementById('debate-body');
  if (data.contentHtml) {
    if (notesSection) notesSection.style.display = '';
    if (bottomNav) bottomNav.style.display = '';
    if (bodyEl) bodyEl.innerHTML = stripLeadingH4(data.contentHtml);
  } else {
    if (notesSection) notesSection.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
  }

  // Prev/Next navigation
  updateDayNav(idx);

  // Update page title
  const pageDate = formatFullDate(data.dates && data.dates[0], data.title || meta.label);
  document.title = `${pageDate} — The 1787 Convention`;
}

// ============================================================
// Prev / Next navigation
// ============================================================
function updateDayNav(currentIdx) {
  const prev = manifest.days[currentIdx - 1];
  const next = manifest.days[currentIdx + 1];

  for (const suffix of ['', '-top']) {
    const prevBtn   = document.getElementById(`prev-day${suffix}`);
    const nextBtn   = document.getElementById(`next-day${suffix}`);
    const prevLabel = document.getElementById(`prev-day-label${suffix}`);
    const nextLabel = document.getElementById(`next-day-label${suffix}`);

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
  0: 'Intro', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September'
};

function monthName(num) {
  return MONTH_NAMES[num] || String(num);
}

// ============================================================
// Date formatting helpers
// ============================================================
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES_LONG = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];

function getDayOfWeek(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return DAY_NAMES[new Date(year, month - 1, day).getDay()];
}

function formatFullDate(isoDate, fallback) {
  if (!isoDate) return fallback || '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${MONTH_NAMES_LONG[month - 1]} ${day}, ${year}`;
}

function stripLeadingH4(html) {
  return html.replace(/^\s*<[Hh]4[^>]*>[^<]*<\/[Hh]4>\s*/, '').trim();
}
