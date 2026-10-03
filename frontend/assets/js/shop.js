/* AERON — Shop & Category pages (shared logic) */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var CAT = params.get('cat') || '';
  var PAGE_SIZE = 8;

  var state = {
    q: params.get('q') || '',
    sizes: [],
    colors: [],
    priceMax: 250,
    sort: 'featured',
    visible: PAGE_SIZE
  };

  var isCategory = !!CAT;
  UI.mountChrome(
    CAT === 'sale' ? 'sale' :
    ['men', 'women', 'kids', 'running'].indexOf(CAT) !== -1 ? CAT : 'shop'
  );

  var fi = document.getElementById('filterIcon');
  if (fi) fi.innerHTML = UI.icon('filter');
  var fc = document.getElementById('filtersClose');
  if (fc) fc.innerHTML = UI.icon('x');

  /* ---------------- category hero ---------------- */
  var cat = isCategory ? Store.category(CAT) : null;
  if (isCategory) {
    document.title = (cat ? cat.name : 'Category') + ' — AERON';
    var t = document.getElementById('catTitle');
    if (cat) {
      t.textContent = cat.name;
      document.getElementById('catDesc').textContent = cat.desc;
      document.getElementById('catEyebrow').textContent = 'AERON Collection \u00B7 ' + cat.name;
      var im = document.getElementById('catImg');
      im.src = Store.img(cat.image); im.alt = cat.name;
    } else {
      t.textContent = CAT;
      document.getElementById('catDesc').textContent = 'Everything in this collection.';
      document.getElementById('catImg').parentElement.style.display = 'none';
    }
    document.getElementById('catCount').textContent = Store.productsInCategory(CAT).length + ' Styles';
  }

  /* ---------------- pool & filtering ---------------- */
  function pool() {
    var all = Store.products();
    return isCategory ? all.filter(function (p) { return Store.matchCategory(p, CAT); }) : all;
  }

  function filtered() {
    var list = pool();
    var q = state.q.toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return (p.name + ' ' + p.sport + ' ' + p.gender + ' ' + Store.catLabel(p)).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (state.sizes.length) {
      list = list.filter(function (p) {
        return state.sizes.some(function (s) { return p.sizes.indexOf(s) !== -1; });
      });
    }
    if (state.colors.length) {
      list = list.filter(function (p) {
        return p.colors.some(function (c) { return state.colors.indexOf(c.fam) !== -1; });
      });
    }
    list = list.filter(function (p) { return (p.sale || p.price) <= state.priceMax; });

    switch (state.sort) {
      case 'price-asc': list.sort(function (a, b) { return (a.sale || a.price) - (b.sale || b.price); }); break;
      case 'price-desc': list.sort(function (a, b) { return (b.sale || b.price) - (a.sale || a.price); }); break;
      case 'rating': list.sort(function (a, b) { return b.rating - a.rating; }); break;
      case 'new': list.sort(function (a, b) { return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.id.localeCompare(a.id); }); break;
      default: list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.rating - a.rating; });
    }
    return list;
  }

  /* ---------------- render ---------------- */
  var grid = document.getElementById('grid');
  var loadWrap = document.getElementById('loadWrap');

  function render() {
    var list = filtered();
    var shown = list.slice(0, state.visible);
    if (!shown.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' + UI.icon('search') +
        '<h3>No shoes match those filters</h3><p>Try widening your search or clearing filters.</p>' +
        '<button class="btn btn-dark" id="emptyClear">Clear Filters</button></div>';
      var ec = document.getElementById('emptyClear');
      if (ec) ec.addEventListener('click', clearAll);
    } else {
      grid.innerHTML = shown.map(function (p) { return UI.cardHTML(p, false); }).join('');
    }
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
    } catch (e) { /* file:// URLs may refuse — safe to ignore */ }
  }

  /* ---------------- filter UI ---------------- */
  function buildFilters() {
    /* categories */
    var catsEl = document.getElementById('fCats');
    var all = Store.products();
    var rows = [['', 'All Products', all.length]];
    Store.categories().forEach(function (c) {
      rows.push([c.slug, c.name, Store.productsInCategory(c.slug).length]);
    });
    catsEl.innerHTML = rows.map(function (r) {
      var active = (r[0] === CAT) ? ' class="on"' : '';
      var href = r[0] ? 'category.html?cat=' + r[0] : 'shop.html';
      return '<a href="' + href + '"' + active + '>' + Store.esc(r[1]) + '<em>' + r[2] + '</em></a>';
    }).join('');

    /* sizes */
    var sizeSet = {};
    pool().forEach(function (p) { p.sizes.forEach(function (s) { sizeSet[s] = 1; }); });
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
    pool().forEach(function (p) {
      p.colors.forEach(function (c) { if (!fams[c.fam]) fams[c.fam] = c.hex; });
    });
    document.getElementById('fColors').innerHTML = Object.keys(fams).map(function (f) {
      return '<button class="color-opt" data-color="' + f + '"><i style="background:' + fams[f] + '"></i>' + f + '</button>';
    }).join('');

    document.getElementById('fPriceVal').textContent = Store.money(state.priceMax);
    document.getElementById('fSearch').value = state.q;
  }

  /* events */
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

  function clearAll() {
    state.q = ''; state.sizes = []; state.colors = []; state.priceMax = 250; state.visible = PAGE_SIZE;
    document.getElementById('fPrice').value = 250;
    document.querySelectorAll('#fSizes .chip, #fColors .color-opt').forEach(function (c) { c.classList.remove('on'); });
    document.getElementById('fPriceVal').textContent = Store.money(250);
    document.getElementById('fSearch').value = '';
    render();
  }
  document.getElementById('fClear').addEventListener('click', clearAll);

  /* mobile filter drawer */
  var ft = document.getElementById('filtersToggle');
  if (ft) ft.addEventListener('click', function () { document.body.classList.add('filters-open'); });
  var fx = document.getElementById('filtersClose');
  if (fx) fx.addEventListener('click', function () { document.body.classList.remove('filters-open'); });

  buildFilters();
  render();
})();
