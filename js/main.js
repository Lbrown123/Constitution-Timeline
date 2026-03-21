// main.js — Shared utilities for all pages

/**
 * Fetch and parse JSON from a local path.
 * Throws a descriptive error on failure.
 */
async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Highlight the nav link matching the current page.
 */
function initNav() {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav__links a').forEach(link => {
    const href = link.getAttribute('href').split('#')[0];
    if (href === currentFile) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Run nav init on every page
document.addEventListener('DOMContentLoaded', initNav);
