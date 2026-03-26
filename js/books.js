/**
 * books.js — Shared book-rendering module.
 * Used by books.html (main Further Reading page) and attendee.html (profile page).
 *
 * Exposes:
 *   loadBooksData()                — returns the full books.json object
 *   renderBooksInto(books, container) — renders an array of book entries into a DOM container
 *   renderBooksForDelegate(id, container) — conditionally appends a Further Reading section
 */
(function () {
  'use strict';

  var booksDataCache = null;

  // -----------------------------------------------------------
  // Data loading (bundle-first, fetch-fallback)
  // -----------------------------------------------------------
  function loadBooksData() {
    if (booksDataCache) return Promise.resolve(booksDataCache);
    if (window.__BOOKS_DATA__ && typeof window.__BOOKS_DATA__ === 'object') {
      booksDataCache = window.__BOOKS_DATA__;
      return Promise.resolve(booksDataCache);
    }
    return fetch('data/books.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load books.json');
        return r.json();
      })
      .then(function (data) {
        booksDataCache = data;
        return data;
      });
  }

  // -----------------------------------------------------------
  // Render a single manual book card → DOM element
  // -----------------------------------------------------------
  function renderManualCard(book) {
    var card = document.createElement('div');
    card.className = 'book-card book-card--manual';
    if (book.audience && book.audience.length > 0) {
      card.dataset.audience = book.audience.join(' ');
    }
    if (book.category) {
      card.dataset.category = book.category;
    }

    // Cover
    var coverDiv = document.createElement('div');
    coverDiv.className = 'book-card__cover';
    if (book.cover) {
      var img = document.createElement('img');
      img.src = book.cover;
      img.alt = 'Cover of ' + (book.title || 'book');
      img.loading = 'lazy';
      if (book.link) {
        var coverLink = document.createElement('a');
        coverLink.href = book.link;
        coverLink.target = '_blank';
        coverLink.rel = 'noopener';
        coverLink.appendChild(img);
        coverDiv.appendChild(coverLink);
      } else {
        coverDiv.appendChild(img);
      }
    } else {
      var ph = document.createElement('div');
      ph.className = 'book-card__cover--placeholder';
      ph.textContent = 'No cover';
      coverDiv.appendChild(ph);
    }
    card.appendChild(coverDiv);

    // Info
    var info = document.createElement('div');
    info.className = 'book-card__info';

    var title = document.createElement('h3');
    title.className = 'book-card__title';
    title.textContent = book.title || '';
    info.appendChild(title);

    if (book.author) {
      var author = document.createElement('p');
      author.className = 'book-card__author';
      author.textContent = book.author;
      info.appendChild(author);
    }

    if (book.audience && book.audience.length > 0) {
      var audienceDiv = document.createElement('div');
      audienceDiv.className = 'book-card__audiences';
      for (var a = 0; a < book.audience.length; a++) {
        var badge = document.createElement('span');
        badge.className = 'book-card__audience-badge book-card__audience-badge--' + book.audience[a];
        badge.textContent = book.audience[a] === 'kids' ? 'For Kids' : book.audience[a] === 'teens' ? 'For Teens' : 'For Adults';
        audienceDiv.appendChild(badge);
      }
      info.appendChild(audienceDiv);
    }

    if (book.description) {
      var desc = document.createElement('div');
      desc.className = 'book-card__description';
      desc.innerHTML = book.description;
      info.appendChild(desc);
    }

    if (book.link) {
      var link = document.createElement('a');
      link.className = 'book-card__buy-link';
      link.href = book.link;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Buy Now \u2192';
      info.appendChild(link);
    }

    card.appendChild(info);
    return card;
  }

  // -----------------------------------------------------------
  // Render an array of book entries into a container
  // -----------------------------------------------------------
  function renderBooksInto(books, container) {
    if (!books || books.length === 0) return;

    for (var i = 0; i < books.length; i++) {
      container.appendChild(renderManualCard(books[i]));
    }
  }

  // -----------------------------------------------------------
  // Render a "Further Reading" section for a delegate profile
  // Only appends if books exist for that delegate
  // -----------------------------------------------------------
  function renderBooksForDelegate(delegateId, container) {
    return loadBooksData().then(function (data) {
      var delegates = data.delegates || {};
      var entry = delegates[delegateId];
      if (!entry || !entry.books || entry.books.length === 0) return;

      var section = document.createElement('section');
      section.className = 'profile-section';

      var heading = document.createElement('h2');
      heading.className = 'profile-section-title';
      heading.textContent = 'Further Reading';
      section.appendChild(heading);

      renderBooksInto(entry.books, section);

      container.appendChild(section);
    }).catch(function () {
      // Silently fail — books section just won't appear
    });
  }

  // -----------------------------------------------------------
  // Expose globally
  // -----------------------------------------------------------
  window.loadBooksData = loadBooksData;
  window.renderBooksInto = renderBooksInto;
  window.renderBooksForDelegate = renderBooksForDelegate;
})();
