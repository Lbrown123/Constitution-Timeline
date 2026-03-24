/**
 * delegate-popup.js
 *
 * Hover-preview popup for .delegate-link elements inside debates.html.
 * Shows the delegate's portrait, name, state, occupation/age, a brief bio
 * snippet, and a "View full profile" link.
 *
 * Data is loaded in priority order:
 *   1. window.__ATTENDEES_DATA__[id]   – full profile object (from bundle)
 *   2. window.__ATTENDEES_MANIFEST__   – card-only metadata (from bundle)
 *   3. fetch('data/attendee_{id}.json') – HTTP fallback (GitHub Pages)
 *
 * The popup is a single shared <div id="delegate-popup"> injected into
 * <body> by this script.  It is repositioned on every trigger.
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var LINK_CLASS   = 'delegate-link';
  var HIDE_DELAY   = 160;   // ms — grace period when mouse moves toward popup
  var POPUP_GAP    = 10;    // px between popup edge and triggering element

  // ── State ─────────────────────────────────────────────────────────────────
  var popup        = null;
  var hideTimer    = null;
  var shouldHide   = false;
  var signedBadgeEl = null;  // cached — className is mutated on each populate()
  var stateBadgeEl  = null;  // cached — className is mutated on each populate()
  var cache        = {};   // id → delegate data object

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectPopup();
    popup         = document.getElementById('delegate-popup');
    signedBadgeEl = popup.querySelector('.dlg-popup__badge--signed');
    stateBadgeEl  = popup.querySelector('.dlg-popup__badge--state-size');

    // Pre-fill cache from any bundle globals present on the page
    if (window.__ATTENDEES_DATA__) {
      Object.keys(window.__ATTENDEES_DATA__).forEach(function (id) {
        cache[id] = window.__ATTENDEES_DATA__[id];
      });
    }
    if (Array.isArray(window.__ATTENDEES_MANIFEST__)) {
      window.__ATTENDEES_MANIFEST__.forEach(function (d) {
        if (!cache[d.id]) cache[d.id] = d;
      });
    }

    // Event delegation — handles links in dynamically rendered debate content
    document.addEventListener('mouseover',  onDocMouseOver);
    document.addEventListener('mouseout',   onDocMouseOut);
    document.addEventListener('focusin',    onDocFocusIn);
    document.addEventListener('focusout',   onDocFocusOut);

    popup.addEventListener('mouseenter', cancelHide);
    popup.addEventListener('mouseleave', scheduleHide);
  });

  // ── Popup HTML skeleton ───────────────────────────────────────────────────
  function injectPopup() {
    var el = document.createElement('div');
    el.id              = 'delegate-popup';
    el.className       = 'dlg-popup';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    el.hidden          = true;
    el.innerHTML = [
      '<img class="dlg-popup__photo" src="" alt="" width="68" height="85">',
      '<div class="dlg-popup__info">',
        '<div class="dlg-popup__name"></div>',
        '<div class="dlg-popup__state"></div>',
        '<div class="dlg-popup__meta"></div>',
        '<div class="dlg-popup__badges">',
          '<span class="dlg-popup__badge dlg-popup__badge--signed"></span>',
          '<span class="dlg-popup__badge dlg-popup__badge--state-size"></span>',
        '</div>',
        '<a  class="dlg-popup__link" href="#">View full profile &#8594;</a>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
  }

  // ── Mouse / focus event handlers ──────────────────────────────────────────
  function onDocMouseOver(e) {
    var link = closest(e.target, '.' + LINK_CLASS);
    if (!link) return;
    cancelHide();
    triggerPopup(link);
  }

  function onDocMouseOut(e) {
    var link = closest(e.target, '.' + LINK_CLASS);
    if (!link) return;
    var to = e.relatedTarget;
    // Don't hide if mouse is moving into the popup itself
    if (to && (popup === to || popup.contains(to))) return;
    scheduleHide();
  }

  function onDocFocusIn(e) {
    var link = closest(e.target, '.' + LINK_CLASS);
    if (!link) return;
    cancelHide();
    triggerPopup(link);
  }

  function onDocFocusOut(e) {
    var link = closest(e.target, '.' + LINK_CLASS);
    if (!link) return;
    scheduleHide();
  }

  // ── Core trigger ──────────────────────────────────────────────────────────
  function triggerPopup(linkEl) {
    var id = linkEl.dataset.attendeeId;
    if (!id) return;

    getDelegate(id, function (data) {
      if (!data) return;
      populate(data);
      position(linkEl);
      showPopup();
    });
  }

  // ── Show / hide ───────────────────────────────────────────────────────────
  function showPopup() {
    shouldHide = false;
    cancelHide();
    popup.hidden = false;
    popup.removeAttribute('aria-hidden');
    // rAF ensures the display:block renders before the transition starts
    requestAnimationFrame(function () {
      popup.classList.add('is-visible');
    });
  }

  function hidePopup() {
    shouldHide = true;
    popup.classList.remove('is-visible');
    popup.setAttribute('aria-hidden', 'true');
    popup.addEventListener('transitionend', function onEnd() {
      popup.removeEventListener('transitionend', onEnd);
      if (shouldHide) popup.hidden = true;
    });
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePopup, HIDE_DELAY);
  }

  function cancelHide() {
    clearTimeout(hideTimer);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  /**
   * Fetch delegate data and invoke cb(data).
   * Tries cache → bundle globals → HTTP fetch, in that order.
   */
  function getDelegate(id, cb) {
    if (cache[id]) { cb(cache[id]); return; }

    // Try to load the full profile via HTTP (GitHub Pages / localhost)
    fetch('data/attendees/attendee_' + id + '.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        cache[id] = data;
        cb(data);
      })
      .catch(function () { cb(null); });
  }

  // ── Populate ──────────────────────────────────────────────────────────────
  function populate(d) {
    // Photo
    var photo = popup.querySelector('.dlg-popup__photo');
    photo.src = d.photoCard || 'images/attendees/placeholder.webp';
    photo.alt = d.name || '';

    // Name
    popup.querySelector('.dlg-popup__name').textContent = d.name || '';

    // State name (no size label — the badge handles that)
    popup.querySelector('.dlg-popup__state').textContent = d.state || '';

    // Occupation · age
    var parts = [];
    if (d.occupationCategory) parts.push(d.occupationCategory);
    if (d.ageAtConvention)    parts.push('age\u00a0' + d.ageAtConvention);
    popup.querySelector('.dlg-popup__meta').textContent = parts.join(' \u00b7 ');

    // Signed / unsigned badge
    var signedBadge = signedBadgeEl;
    if (d.signedConstitution) {
      signedBadge.textContent = '\u2714 Signed';
      signedBadge.className   = 'dlg-popup__badge dlg-popup__badge--signed';
    } else {
      signedBadge.textContent = '\u2717 Did not sign';
      signedBadge.className   = 'dlg-popup__badge dlg-popup__badge--unsigned';
    }

    // Big state / small state badge
    var stateBadge = stateBadgeEl;
    if (d.stateSize === 'big') {
      stateBadge.textContent = 'Large State';
      stateBadge.className   = 'dlg-popup__badge dlg-popup__badge--big-state';
    } else {
      stateBadge.textContent = 'Small State';
      stateBadge.className   = 'dlg-popup__badge dlg-popup__badge--small-state';
    }

    // Profile link
    popup.querySelector('.dlg-popup__link').href = 'attendee.html#' + d.id;
  }

  // ── Position ──────────────────────────────────────────────────────────────
  /**
   * Position the popup near linkEl, preferring above it.
   * Falls back to below if there isn't enough vertical space above.
   * Clamps horizontally so the popup never overflows the viewport.
   */
  function position(linkEl) {
    // Temporarily show (without transition) to measure its natural size
    popup.style.transition = 'none';
    popup.hidden = false;

    var pr = popup.getBoundingClientRect();
    var lr = linkEl.getBoundingClientRect();
    var vw = window.innerWidth  || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    // Horizontal: align left edge with link, shift left if it overflows
    var left = lr.left;
    if (left + pr.width + 8 > vw) left = vw - pr.width - 8;
    if (left < 8) left = 8;

    // Vertical: prefer above, fall back to below
    var top = lr.top - pr.height - POPUP_GAP;
    if (top < 8) top = lr.bottom + POPUP_GAP;

    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';

    // Re-hide and restore transition before show() adds .is-visible
    popup.hidden = true;
    // Restore transition after a microtask so it doesn't apply to the move
    setTimeout(function () {
      popup.style.transition = '';
    }, 0);
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  /**
   * Polyfill-safe Element.closest() traversal.
   * Returns the nearest ancestor (or self) matching the CSS selector,
   * or null if none found.
   */
  function closest(el, selector) {
    if (!el || el === document) return null;
    if (el.matches && el.matches(selector)) return el;
    return closest(el.parentNode, selector);
  }

})();
