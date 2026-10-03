/* AERON — Product detail page */
(function () {
  'use strict';

  var id = new URLSearchParams(location.search).get('id');
  var p = id ? Store.product(id) : null;
  UI.mountChrome('shop');

  var root = document.getElementById('productRoot');

  if (!p) {
    root.innerHTML = '<div class="container not-found"><h1 class="display">Oops.</h1>' +
      '<p style="color:var(--mut);margin:14px 0 26px">That product doesn\u2019t exist or was removed.</p>' +
      '<a class="btn btn-dark btn-lg" href="shop.html">Back to the Shop</a></div>';
    return;
  }

  Store.pushRecent(p.id);
  document.title = p.name + ' — AERON';

  var sale = p.sale != null && p.sale < p.price;
  var soldout = p.stock <= 0;
  var imgs = [p.img];
  if (p.imgHover) imgs.push(p.imgHover);
  var sel = { img: 0, size: null, color: p.colors[0] ? p.colors[0].name : 'Default', qty: 1 };

  function galleryHTML() {
    var thumbs = imgs.map(function (src, i) {
      return '<button class="pd-thumb' + (i === sel.img ? ' on' : '') + '" data-i="' + i + '"><img src="' + Store.img(src) + '" alt="View ' + (i + 1) + '"></button>';
    }).join('');
    /* extra "close-up" thumb */
    thumbs += '<button class="pd-thumb' + (sel.img === 'zoom' ? ' on' : '') + '" data-i="zoom"><img src="' + Store.img(p.img) + '" style="transform:scale(1.9);transform-origin:60% 55%" alt="Close-up"></button>';
    return '<div class="pd-gallery">' +
      '<div class="pd-main" id="pdMain"><img id="pdImg" src="' + Store.img(imgs[0]) + '" alt="' + Store.esc(p.name) + '"></div>' +
      '<div class="pd-thumbs" id="pdThumbs">' + thumbs + '</div>' +
    '</div>';
  }

  function priceHTML() {
    if (sale) return '<s>' + Store.money(p.price) + '</s> <b>' + Store.money(p.sale) + '</b>' +
      '<span class="save-tag">Save ' + Math.round((1 - p.sale / p.price) * 100) + '%</span>';
    return '<b>' + Store.money(p.price) + '</b>';
  }

  function specHTML() {
    var s = p.specs || {};
    var keys = Object.keys(s);
    if (!keys.length) return '<div><b>Note</b>Specifications coming soon.</div>';
    return keys.map(function (k) {
      return '<div><b>' + Store.esc(k) + '</b>' + Store.esc(s[k]) + '</div>';
    }).join('');
  }

  /* deterministic pseudo reviews */
  var NAMES = ['Sana W.', 'Chris D.', 'Fatima R.', 'Leo M.', 'Hina S.', 'Jake P.', 'Noor A.', 'Diego L.'];
  var TEXTS = [
    'Fits true to size and feels incredible out of the box. The cushioning is plush without feeling mushy — exactly what I wanted.',
    'Quality is way above the price point. Materials feel premium and the colorway looks even better in person.',
    'I\u2019ve put serious miles on these and they still look fresh. Grip is excellent on wet pavement too.',
    'Super comfortable for all-day wear. I sized up half a size and the fit is perfect with thicker socks.',
    'My second pair from AERON and they keep delivering. Fast shipping and beautiful packaging as well.'
  ];
  function seedNum() {
    var n = 0; for (var i = 0; i < p.id.length; i++) n += p.id.charCodeAt(i); return n;
  }
  function reviewsHTML() {
    var seed = seedNum();
    var out = '';
    for (var i = 0; i < 3; i++) {
      var nm = NAMES[(seed + i * 3) % NAMES.length];
      var tx = TEXTS[(seed + i * 2) % TEXTS.length];
      var r = Math.max(3.5, Math.min(5, p.rating + ((seed + i) % 3 - 1) * 0.3));
      out += '<div class="review-item"><div class="r-head"><div><b>' + nm + '</b> &nbsp;' + UI.stars(r) +
        '</div><span class="r-date">Verified buyer \u00B7 ' + ((seed + i * 7) % 26 + 2) + ' days ago</span></div><p>' + tx + '</p></div>';
    }
    return out;
  }
  function barsHTML() {
    var d = [72, 19, 6, 2, 1];
    var shift = seedNum() % 8;
    return d.map(function (v, i) {
      var val = Math.max(1, Math.min(92, v + (i === 0 ? shift - 4 : 0)));
      return '<div class="rbar"><span>' + (5 - i) + ' \u2605</span><i><b style="width:' + val + '%"></b></i><span>' + val + '%</span></div>';
    }).join('');
  }

  root.innerHTML = '' +
  '<div class="container-wide" style="padding-top:22px"><p class="crumbs" style="font-size:12.5px;color:var(--mut)">' +
    '<a href="index.html">Home</a> <span>/</span> <a href="shop.html">Shop</a> <span>/</span> <span>' + Store.esc(p.name) + '</span></p></div>' +
  '<div class="container-wide pd-layout">' +
    galleryHTML() +
    '<div class="pd-info">' +
      '<p class="overline">' + Store.esc(Store.catLabel(p)) + (p.isNew ? ' \u00B7 New Arrival' : '') + '</p>' +
      '<h1 class="display">' + Store.esc(p.name) + '</h1>' +
      '<div class="pd-rate">' + UI.stars(p.rating) + '<em>' + p.rating.toFixed(1) + ' \u00B7 ' + p.reviews + ' reviews</em></div>' +
      '<div class="pd-price">' + priceHTML() + '</div>' +
      '<p class="pd-desc">' + Store.esc(p.desc) + '</p>' +

      '<div class="pd-sec"><p class="lbl">Color <span>' + Store.esc(sel.color) + '</span></p>' +
        '<div class="color-row" id="colorRow">' + p.colors.map(function (c, i) {
          return '<button class="color-dot' + (i === 0 ? ' on' : '') + '" style="background:' + c.hex + '" data-color="' + Store.esc(c.name) + '" title="' + Store.esc(c.name) + '"></button>';
        }).join('') + '</div></div>' +

      '<div class="pd-sec"><p class="lbl">Select size (US) <span><a href="#" data-demo style="color:var(--mut);text-decoration:underline">Size guide</a></span></p>' +
        (soldout ? '<p class="stock-note">This style is currently sold out.</p>' :
        '<div class="size-row" id="sizeRow">' + p.sizes.map(function (s) {
          return '<button class="size-chip" data-size="' + s + '">' + s + '</button>';
        }).join('') + '</div>') +
        '<p class="field-err" id="sizeErr" hidden>Please choose a size first.</p></div>' +

      (soldout ? '' :
      '<div class="qty-row">' +
        '<div class="qty-stepper"><button id="qtyMinus" aria-label="Decrease">' + UI.icon('minus') + '</button><b id="qtyVal">1</b>' +
        '<button id="qtyPlus" aria-label="Increase">' + UI.icon('plus') + '</button></div>' +
        (p.stock <= 5 ? '<span class="stock-note">Only ' + p.stock + ' left in stock</span>' : '') +
      '</div>') +

      '<div class="pd-ctas">' +
        (soldout
          ? '<button class="btn btn-dark btn-lg" disabled>Sold Out</button>'
          : '<button class="btn btn-dark btn-lg" id="addBtn">' + UI.icon('bag') + '<span>Add to Cart</span></button>' +
            '<button class="btn btn-accent btn-lg" id="buyBtn">Buy Now</button>') +
        '<button class="icon-btn' + (Store.inWishlist(p.id) ? ' on' : '') + '" id="wishBtn" data-action="wish" data-id="' + p.id + '" aria-label="Wishlist">' + UI.icon('heart') + '</button>' +
      '</div>' +

      '<div class="pd-perks">' +
        '<div>' + UI.icon('truck') + ' Free standard shipping over $150 \u00B7 arrives in 3\u20135 days</div>' +
        '<div>' + UI.icon('rotate') + ' 30-day free returns, no questions asked</div>' +
        '<div>' + UI.icon('shield') + ' 2-year craftsmanship warranty</div>' +
      '</div>' +

      '<div class="tabs">' +
        '<div class="tab-row">' +
          '<button class="tab-btn on" data-tab="desc">Description</button>' +
          '<button class="tab-btn" data-tab="specs">Specifications</button>' +
          '<button class="tab-btn" data-tab="ship">Shipping &amp; Returns</button>' +
          '<button class="tab-btn" data-tab="rev">Reviews (' + p.reviews + ')</button>' +
        '</div>' +
        '<div class="tab-panel on" data-panel="desc"><p>' + Store.esc(p.desc) + '</p></div>' +
        '<div class="tab-panel" data-panel="specs"><div class="spec-list">' + specHTML() + '</div></div>' +
        '<div class="tab-panel" data-panel="ship"><p>Orders placed before 2 PM ship the same day. Standard delivery takes 3\u20135 business days; express 1\u20132 days. Returns are free within 30 days \u2014 items must be unworn with original packaging. Refunds land back on your original payment method within 5 business days of receiving the return.</p></div>' +
        '<div class="tab-panel" data-panel="rev">' +
          '<div class="review-summary"><div class="review-score"><b>' + p.rating.toFixed(1) + '</b><div>' + UI.stars(p.rating) + '</div><span style="color:var(--mut);font-size:12.5px">' + p.reviews + ' reviews</span></div>' +
          '<div class="review-bars">' + barsHTML() + '</div></div>' +
          reviewsHTML() +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* ---------- interactions ---------- */
  var mainEl = document.getElementById('pdMain');
  var imgEl = document.getElementById('pdImg');

  document.getElementById('pdThumbs').addEventListener('click', function (e) {
    var th = e.target.closest('.pd-thumb');
    if (!th) return;
    mainEl.classList.remove('zoom');
    document.querySelectorAll('.pd-thumb').forEach(function (x) { x.classList.remove('on'); });
    th.classList.add('on');
    if (th.dataset.i === 'zoom') {
      imgEl.src = Store.img(p.img);
      imgEl.style.padding = '0'; imgEl.style.transform = 'scale(1.9)'; imgEl.style.transformOrigin = '60% 55%';
    } else {
      sel.img = +th.dataset.i;
      imgEl.src = Store.img(imgs[sel.img]);
      imgEl.style.padding = ''; imgEl.style.transform = ''; imgEl.style.transformOrigin = '';
    }
    imgEl.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 280, easing: 'ease' });
  });

  /* click-to-zoom on main image */
  mainEl.addEventListener('click', function () {
    if (document.getElementById('pdThumbs').querySelector('.pd-thumb.on[data-i="zoom"]')) return;
    mainEl.classList.toggle('zoom');
  });
  mainEl.addEventListener('mousemove', function (e) {
    if (!mainEl.classList.contains('zoom')) return;
    var r = mainEl.getBoundingClientRect();
    imgEl.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
  });

  /* color select */
  document.getElementById('colorRow').addEventListener('click', function (e) {
    var d = e.target.closest('.color-dot');
    if (!d) return;
    document.querySelectorAll('#colorRow .color-dot').forEach(function (x) { x.classList.remove('on'); });
    d.classList.add('on');
    sel.color = d.dataset.color;
    document.querySelector('.pd-sec .lbl span').textContent = sel.color;
  });

  /* size select */
  var sizeRow = document.getElementById('sizeRow');
  if (sizeRow) sizeRow.addEventListener('click', function (e) {
    var c = e.target.closest('.size-chip');
    if (!c) return;
    document.querySelectorAll('.size-chip').forEach(function (x) { x.classList.remove('on'); });
    c.classList.add('on');
    sel.size = c.dataset.size;
    document.getElementById('sizeErr').hidden = true;
  });

  /* qty */
  var qMinus = document.getElementById('qtyMinus'), qPlus = document.getElementById('qtyPlus');
  if (qMinus) {
    qMinus.addEventListener('click', function () { sel.qty = Math.max(1, sel.qty - 1); document.getElementById('qtyVal').textContent = sel.qty; });
    qPlus.addEventListener('click', function () { sel.qty = Math.min(99, sel.qty + 1); document.getElementById('qtyVal').textContent = sel.qty; });
  }

  function validateSize() {
    if (!sel.size) {
      document.getElementById('sizeErr').hidden = false;
      if (sizeRow) sizeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  var addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.addEventListener('click', function () {
    if (!validateSize()) return;
    Store.addToCart(p.id, sel.size, sel.color, sel.qty);
    UI.flyToCart(addBtn);
    UI.toast('Added <b>' + Store.esc(p.name) + '</b> to your bag.');
  });

  var buyBtn = document.getElementById('buyBtn');
  if (buyBtn) buyBtn.addEventListener('click', function () {
    if (!validateSize()) return;
    Store.addToCart(p.id, sel.size, sel.color, sel.qty);
    location.href = 'checkout.html';
  });

  /* tabs */
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.remove('on'); });
      document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelector('[data-panel="' + b.dataset.tab + '"]').classList.add('on');
    });
  });

  /* related */
  var related = Store.products().filter(function (x) {
    return x.id !== p.id && (x.sport === p.sport || x.gender === p.gender);
  }).slice(0, 4);
  if (related.length) {
    document.getElementById('relatedSec').style.display = '';
    UI.renderCards(document.getElementById('related'), related);
  }

  /* recently viewed */
  var rec = Store.recent().filter(function (x) { return x !== p.id; })
    .map(function (x) { return Store.product(x); }).filter(Boolean).slice(0, 4);
  if (rec.length) {
    document.getElementById('recentSec').style.display = '';
    UI.renderCards(document.getElementById('recent'), rec);
  }

  UI_reveal();
})();
