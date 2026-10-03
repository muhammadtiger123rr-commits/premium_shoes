/* AERON — Shop page (Django version)
   Django renders 8 styles per page and does the filtering, so the sidebar
   controls are links/queries back to this view and the pager below the grid is
   a real set of page links. The category page has no backend for its filters,
   so it keeps the original client-side show/hide behaviour. */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var CAT = params.get('cat') || '';
  var PAGE_SIZE = 8;

  var grid = document.getElementById('grid');
  /* data-mode="page" means the grid holds one server-side page and the
     sidebar already carries the active filters; anything else (the category
     page) still gets every card and filters them here. */
  var SERVER = !!(grid && grid.dataset.mode === 'page');

  var state = {
    q: params.get('q') || '',
    sizes: SERVER ? params.getAll('size') : [],
    colors: SERVER ? params.getAll('color') : [],
    priceMax: parseInt(params.get('price') || '250', 10) || 250,
    sort: params.get('sort') || 'featured',
    visible: PAGE_SIZE
  };

  UI.mountChrome(
    CAT === 'sale' ? 'sale' :
    ['men', 'women', 'kids', 'running'].indexOf(CAT) !== -1 ? CAT : 'shop'
  );

  var fi = document.getElementById('filterIcon');
  if (fi) fi.innerHTML = UI.icon('filter');
  var fc = document.getElementById('filtersClose');
  if (fc) fc.innerHTML = UI.icon('x');

  var emptyState = document.getElementById('emptyState');

  /* ---------------- server mode: every control is a query ---------------- */
  /* Remembered across the reload so the search box only takes the focus back
     when the reload was triggered by typing in it. */
  var FOCUS_KEY = 'aeron.shop.searchFocus';

  /* Rebuild the shop URL with one filter changed, then reload it. The page is
     always dropped, because a changed filter belongs on page 1 of the new
     result set. */
  function go(changes) {
    var p = new URLSearchParams(location.search);
    p.delete('page');
    Object.keys(changes).forEach(function (k) {
      p.delete(k);
      (changes[k] || []).forEach(function (v) { p.append(k, v); });
    });
    var qs = p.toString();
    try {
      sessionStorage.setItem(
        FOCUS_KEY,
        document.activeElement === document.getElementById('fSearch') ? '1' : '0'
      );
    } catch (e) { /* safe to ignore */ }
    location.href = location.pathname + (qs ? '?' + qs : '');
  }

  function wireServerFilters() {
    var search = document.getElementById('fSearch');
    var price = document.getElementById('fPrice');
    var priceVal = document.getElementById('fPriceVal');
    var sort = document.getElementById('sortSel');

    /* Live search, debounced as before. The reload replaces the field, so the
       caret goes back to the end of the query — typing straight through keeps
       working. */
    var searchT;
    search.addEventListener('input', function (e) {
      clearTimeout(searchT);
      var q = e.target.value.trim();
      searchT = setTimeout(function () { go({ q: q ? [q] : [] }); }, 220);
    });

    /* The slider fires per pixel, so let it settle before asking the server
       for the next page. */
    var priceT;
    price.addEventListener('input', function (e) {
      var max = parseInt(e.target.value, 10);
      priceVal.textContent = 'Up to ' + Store.money(max);
      clearTimeout(priceT);
      priceT = setTimeout(function () { go({ price: [max] }); }, 280);
    });

    sort.addEventListener('change', function (e) {
      go({ sort: e.target.value === 'featured' ? [] : [e.target.value] });
    });

    /* The size/colour chips and the two "clear" links are plain anchors to this
       same view, so they need no handler here. */
    var backFromSearch = false;
    try {
      backFromSearch = sessionStorage.getItem(FOCUS_KEY) === '1';
      sessionStorage.removeItem(FOCUS_KEY);
    } catch (e) { /* safe to ignore */ }
    if (backFromSearch && search.value) {
      search.focus({ preventScroll: true });
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  /* ---------------- client mode (category page) ---------------- */
  var loadWrap = document.getElementById('loadWrap');

  function allCards() {
    return Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
  }

  /* Read the data-* attributes Django wrote on each card. */
  function info(card) {
    var d = card.dataset;
    var colors = [];
    (d.colors || '').split(',').filter(Boolean).forEach(function (pair) {
      var i = pair.indexOf(':');
      colors.push(i === -1 ? { fam: pair, hex: '' } : { fam: pair.slice(0, i), hex: pair.slice(i + 1) });
    });
    return {
      q: (d.search || '').toLowerCase(),
      cat: d.cat || '',
      gender: d.gender || '',
      sport: d.sport || '',
      isNew: d.new === '1',
      onSale: d.onsale === '1',
      featured: d.featured === '1',
      rating: parseFloat(d.rating || 0),
      price: parseFloat(d.price || 0),
      sizes: (d.sizes || '').split(',').filter(Boolean),
      colors: colors
    };
  }

  function matchCategory(d, slug) {
    if (slug === 'new-arrivals') return d.isNew;
    if (slug === 'sale') return d.onSale;
    return d.gender === slug || d.sport === slug;
  }

  function pool() {
    var all = allCards();
    return CAT ? all.filter(function (c) { return matchCategory(info(c), CAT); }) : all;
  }

  function filtered() {
    var list = pool();
    var q = state.q.toLowerCase();
    if (q) {
      list = list.filter(function (c) { return info(c).q.indexOf(q) !== -1; });
    }
    if (state.sizes.length) {
      list = list.filter(function (c) {
        var sizes = info(c).sizes;
        return state.sizes.some(function (s) { return sizes.indexOf(s) !== -1; });
      });
    }
    if (state.colors.length) {
      list = list.filter(function (c) {
        return info(c).colors.some(function (col) { return state.colors.indexOf(col.fam) !== -1; });
      });
    }
    list = list.filter(function (c) { return info(c).price <= state.priceMax; });

    switch (state.sort) {
      case 'price-asc': list.sort(function (a, b) { return info(a).price - info(b).price; }); break;
      case 'price-desc': list.sort(function (a, b) { return info(b).price - info(a).price; }); break;
      case 'rating': list.sort(function (a, b) { return info(b).rating - info(a).rating; }); break;
      case 'new': list.sort(function (a, b) {
        var na = info(a).isNew ? 1 : 0, nb = info(b).isNew ? 1 : 0;
        return (nb - na) || (Number(b.dataset.id) - Number(a.dataset.id));
      }); break;
      default: list.sort(function (a, b) {
        var fa = info(a).featured ? 1 : 0, fb = info(b).featured ? 1 : 0;
        return (fb - fa) || (info(b).rating - info(a).rating);
      });
    }
    return list;
  }

  /* ---------------- render ---------------- */
  function render() {
    var list = filtered();
    var shown = list.slice(0, state.visible);

    allCards().forEach(function (c) { c.style.display = 'none'; });
    shown.forEach(function (c) { c.style.display = ''; });

    /* keep the DOM in the filtered/sorted order so "Load More" reveals the next cards */
    if (list.length) {
      var frag = document.createDocumentFragment();
      list.forEach(function (c) { frag.appendChild(c); });
      grid.appendChild(frag);
    }

    if (emptyState) emptyState.style.display = shown.length ? 'none' : '';

    document.getElementById('resultsCount').textContent =
      'Showing ' + shown.length + ' of ' + list.length + ' ' + (list.length === 1 ? 'style' : 'styles');
    loadWrap.style.display = shown.length < list.length ? '' : 'none';
    document.getElementById('loadMore').textContent = 'Load More (' + (list.length - shown.length) + ' more)';
    syncURL();
    UI_reveal(grid);
  }

  function syncURL() {
    try {
      var p = new URLSearchParams();
      if (CAT) p.set('cat', CAT);
      if (state.q) p.set('q', state.q);
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    } catch (e) { /* safe to ignore */ }
  }

  /* ---------------- filter UI ---------------- */
  function buildFilters() {
    var cards = pool();

    /* sizes */
    var sizeSet = {};
    cards.forEach(function (c) { info(c).sizes.forEach(function (s) { sizeSet[s] = 1; }); });
    var sizes = Object.keys(sizeSet).sort(function (a, b) {
      var ay = a.indexOf('Y') !== -1, by = b.indexOf('Y') !== -1;
      if (ay !== by) return ay ? 1 : -1;
      return parseFloat(a) - parseFloat(b);
    });
    document.getElementById('fSizes').innerHTML = sizes.map(function (s) {
      return '<button class="chip" data-size="' + s + '">' + s + '</button>';
    }).join('');

    /* colors */
    var fams = {};
    cards.forEach(function (c) {
      info(c).colors.forEach(function (col) { if (col.fam && !fams[col.fam]) fams[col.fam] = col.hex; });
    });
    document.getElementById('fColors').innerHTML = Object.keys(fams).map(function (f) {
      return '<button class="color-opt" data-color="' + f + '"><i style="background:' + fams[f] + '"></i>' + f + '</button>';
    }).join('');

    document.getElementById('fPriceVal').textContent = Store.money(state.priceMax);
    document.getElementById('fSearch').value = state.q;
  }

  /* events */
  function wireClientFilters() {
    var searchT;
    document.getElementById('fSearch').addEventListener('input', function (e) {
      clearTimeout(searchT);
      searchT = setTimeout(function () {
        state.q = e.target.value.trim(); state.visible = PAGE_SIZE; render();
      }, 220);
    });

    document.getElementById('fSizes').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-size]');
      if (!chip) return;
      chip.classList.toggle('on');
      var s = chip.dataset.size;
      var i = state.sizes.indexOf(s);
      if (i === -1) state.sizes.push(s); else state.sizes.splice(i, 1);
      state.visible = PAGE_SIZE; render();
    });

    document.getElementById('fColors').addEventListener('click', function (e) {
      var opt = e.target.closest('[data-color]');
      if (!opt) return;
      opt.classList.toggle('on');
      var c = opt.dataset.color;
      var i = state.colors.indexOf(c);
      if (i === -1) state.colors.push(c); else state.colors.splice(i, 1);
      state.visible = PAGE_SIZE; render();
    });

    document.getElementById('fPrice').addEventListener('input', function (e) {
      state.priceMax = parseInt(e.target.value, 10);
      document.getElementById('fPriceVal').textContent = 'Up to ' + Store.money(state.priceMax);
      state.visible = PAGE_SIZE; render();
    });

    document.getElementById('sortSel').addEventListener('change', function (e) {
      state.sort = e.target.value; render();
    });

    document.getElementById('loadMore').addEventListener('click', function () {
      state.visible += PAGE_SIZE; render();
    });

    document.getElementById('fClear').addEventListener('click', clearAll);
    var ec = document.getElementById('emptyClear');
    if (ec) ec.addEventListener('click', clearAll);
  }

  function clearAll() {
    state.q = ''; state.sizes = []; state.colors = []; state.priceMax = 250; state.visible = PAGE_SIZE;
    document.getElementById('fPrice').value = 250;
    document.querySelectorAll('#fSizes .chip, #fColors .color-opt').forEach(function (c) { c.classList.remove('on'); });
    document.getElementById('fPriceVal').textContent = Store.money(250);
    document.getElementById('fSearch').value = '';
    render();
  }

  /* mobile filter drawer */
  var ft = document.getElementById('filtersToggle');
  if (ft) ft.addEventListener('click', function () { document.body.classList.add('filters-open'); });
  var fx = document.getElementById('filtersClose');
  if (fx) fx.addEventListener('click', function () { document.body.classList.remove('filters-open'); });

  /* star rating fill widths — applied here so the inline style attribute stays valid CSS */
  document.querySelectorAll('.stars-fg').forEach(function (el) {
    el.style.width = (el.dataset.fill || '0') + '%';
  });

  if (SERVER) {
    wireServerFilters();
  } else {
    wireClientFilters();
    buildFilters();
    render();
  }
  UI_reveal(grid);
})();
