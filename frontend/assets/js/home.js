/* AERON — Home page */
(function () {
  'use strict';

  UI.mountChrome('home');

  /* ---------- icons injected into static markup ---------- */
  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('tagIcon', 'spark'); ic('tagIcon2', 'shield');
  ic('arrowNew', 'arrowR'); ic('arrowTrend', 'arrowR'); ic('arrowBest', 'arrowR');

  /* ---------- hero (driven by featured product) ---------- */
  var featured = Store.products().filter(function (p) { return p.featured; })[0] || Store.products()[0];
  if (featured) {
    var words = featured.name.split(' ');
    var l1 = words[0] || featured.name;
    var l2 = words.slice(1).join(' ');
    document.getElementById('heroTitle').innerHTML =
      Store.esc(l1) + '<br><span class="stroke">' + Store.esc(l2) + '</span>';
    document.getElementById('heroEyebrow').textContent =
      'Featured Drop — ' + Store.catLabel(featured);
    document.getElementById('heroSub').textContent = featured.desc;
    document.getElementById('heroCta').textContent = 'Shop the ' + featured.name.split(' ')[0] + ' ' + (words[1] || '');
    document.getElementById('heroCta').href = 'product.html?id=' + featured.id;
    document.getElementById('heroPrice').textContent = Store.money(featured.sale || featured.price);
    document.getElementById('heroRating').textContent = featured.rating.toFixed(1) + ' \u2605';
    document.getElementById('heroMeta').children[1].querySelector('span').textContent = featured.reviews + ' Reviews';
  }

  /* ---------- marquee (duplicate for seamless loop) ---------- */
  var track = document.getElementById('marqueeTrack');
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- sections ---------- */
  var products = Store.products();

  var fresh = products.filter(function (p) { return p.isNew; }).slice(0, 4);
  UI.renderCards(document.getElementById('newArrivals'), fresh);

  var trending = products.slice().sort(function (a, b) { return b.reviews - a.reviews; }).slice(0, 4);
  UI.renderCards(document.getElementById('trending'), trending);

  var best = products.slice().sort(function (a, b) { return b.rating - a.rating; }).slice(0, 4);
  UI.renderCards(document.getElementById('bestSellers'), best);

  /* category tiles: Men / Women / Kids */
  var tiles = ['men', 'women', 'kids'].map(function (slug) {
    var c = Store.category(slug);
    if (!c) return '';
    var count = Store.productsInCategory(slug).length;
    return '<a class="cat-tile rv" href="category.html?cat=' + slug + '">' +
      '<img src="' + Store.img(c.image) + '" alt="' + Store.esc(c.name) + '">' +
      '<div class="cat-tile-body"><div><h3>' + Store.esc(c.name) + '</h3><p>' + count + ' styles</p></div>' + UI.icon('arrowR') + '</div></a>';
  }).join('');
  document.getElementById('catTiles').innerHTML = tiles;

  /* sport pills */
  var sports = ['running', 'basketball', 'sneakers', 'casual'];
  document.getElementById('sportList').innerHTML = sports.map(function (slug) {
    var c = Store.category(slug);
    var name = c ? c.name : slug;
    return '<a class="sport-pill rv" href="category.html?cat=' + slug + '"><span>' + Store.esc(name) + '</span>' + UI.icon('arrowR') + '</a>';
  }).join('');

  /* ---------- newsletter ---------- */
  var form = document.getElementById('newsForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('newsEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('Please enter a valid email address.', 'err'); return; }
    Store.subscribe(email);
    form.innerHTML = '<p class="news-success" style="margin:10px auto">' + UI.icon('check') + ' You\u2019re on the list. Welcome to the club.</p>';
    UI.toast('Subscribed! Watch your inbox for early access.');
  });

  /* ---------- hero parallax ---------- */
  var shoe = document.getElementById('heroShoe');
  var hero = document.querySelector('.hero');
  if (shoe && window.matchMedia('(pointer: fine)').matches && hero) {
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      shoe.style.translate = (dx * -16) + 'px ' + (dy * -12) + 'px';
    });
    hero.addEventListener('mouseleave', function () { shoe.style.translate = '0 0'; });
  }
  /* subtle scroll parallax on blob */
  var blob = document.querySelector('[data-parallax]');
  if (blob) {
    window.addEventListener('scroll', function () {
      blob.style.transform = 'translateY(' + window.scrollY * parseFloat(blob.dataset.parallax) + 'px)';
    }, { passive: true });
  }

  UI_reveal();
})();
