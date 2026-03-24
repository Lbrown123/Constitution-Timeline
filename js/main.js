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

/**
 * Hamburger menu toggle for mobile nav.
 */
function initNavToggle() {
  const toggle = document.querySelector('.site-nav__toggle');
  const nav = document.querySelector('.site-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('site-nav--open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close when a nav link is clicked
  nav.querySelectorAll('.site-nav__links a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('site-nav--open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close when clicking outside the nav
  document.addEventListener('click', e => {
    if (!nav.contains(e.target)) {
      nav.classList.remove('site-nav--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Run nav init on every page
document.addEventListener('DOMContentLoaded', () => { initNav(); initNavToggle(); });
