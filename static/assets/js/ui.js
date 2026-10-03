/* =====================================================================
   AERON — Shared UI layer
   Icons, site chrome, micro-interactions, product cards, quick view.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------ icons ------------------------------ */
  var PATHS = {
    bag:    '<path d="M6.2 8h11.6l-.9 12.2H7.1L6.2 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    heart:  '<path d="M12 20.2S4.8 15.7 2.9 11.3A5.3 5.3 0 0 1 12 6.6a5.3 5.3 0 0 1 9.1 4.7C19.2 15.7 12 20.2 12 20.2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
    user:   '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.4-3.8 4.3-5.7 7.5-5.7s6.1 1.9 7.5 5.7"/>',
    menu:   '<path d="M3 7h18M3 12h18M3 17h18"/>',
    x:      '<path d="M6 6l12 12M18 6L6 18"/>',
    star:   '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    minus:  '<path d="M5 12h14"/>',
    trash:  '<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5"/>',
    arrowR: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    arrowL: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    chevD:  '<path d="m6 9 6 6 6-6"/>',
    check:  '<path d="m5 13 4 4L19 7"/>',
    truck:  '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
    shield: '<path d="M12 21.5s7.5-3.4 7.5-9.6V5.4L12 2.6 4.5 5.4v6.5c0 6.2 7.5 9.6 7.5 9.6z"/>',
    rotate: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.2"/><path d="M3.5 3.5v4.7h4.7"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    eye:    '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M9.7 5.2c.7-.2 1.5-.4 2.3-.4 6 0 9.5 6.2 9.5 6.2a17.4 17.4 0 0 1-2.5 3.5M6.7 6.9A17.2 17.2 0 0 0 2.5 11.2S6 18.2 12 18.2c1.3 0 2.5-.3 3.6-.8"/><path d="M3 3l18 18"/><circle cx="12" cy="12" r="2.8"/>',
    edit:   '<path d="m4 20 .8-3.8L16.6 4.4a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L7.8 19.2 4 20z"/>',
    grid:   '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    box:    '<path d="M3.5 7.2 12 3l8.5 4.2v9.6L12 21l-8.5-4.2V7.2z"/><path d="M3.5 7.2 12 11.4l8.5-4.2M12 11.4V21"/>',
    chart:  '<path d="M5 20v-8M12 20V4M19 20v-5"/><path d="M3 20h18"/>',
    users:  '<circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19.5c1.2-3.2 3.5-4.8 6.2-4.8s5 1.6 6.2 4.8"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.8 15.1c1.7.6 2.9 2 3.6 4.4"/>',
    tag:    '<path d="M20.6 13.3 13.4 20.5a1.9 1.9 0 0 1-2.7 0L3.2 13V3.3h9.7l7.7 7.6a1.9 1.9 0 0 1 0 2.4z"/><circle cx="7.6" cy="7.6" r="1.3"/>',
    logout: '<path d="M9.5 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.5M16 16.5 20.5 12 16 7.5M20.5 12h-11"/>',
    home:   '<path d="m3 11 9-7.5L21 11v9a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H4.5A1.5 1.5 0 0 1 3 20v-9z"/>',
    upload: '<path d="M12 16V4.5M6.8 9.2 12 4l5.2 5.2M4.5 19.5h15"/>',
    card:   '<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 9.8h19M6 14.8h4"/>',
    lock:   '<rect x="5" y="10.8" width="14" height="9.7" rx="2"/><path d="M8.2 10.8V7.5a3.8 3.8 0 0 1 7.6 0v3.3"/>',
    mail:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
    phone:  '<path d="M21.5 16.7v2.6a1.9 1.9 0 0 1-2.1 1.9 18.9 18.9 0 0 1-8.2-2.9 18.6 18.6 0 0 1-5.7-5.7A18.9 18.9 0 0 1 2.6 4.4 1.9 1.9 0 0 1 4.5 2.3h2.6a1.9 1.9 0 0 1 1.9 1.6c.1 1 .4 1.9.7 2.8a1.9 1.9 0 0 1-.4 2L8.1 9.9a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.8.7a1.9 1.9 0 0 1 1.7 2z"/>',
    pin:    '<path d="M19.5 10c0 5.8-7.5 11.5-7.5 11.5S4.5 15.8 4.5 10a7.5 7.5 0 0 1 15 0z"/><circle cx="12" cy="10" r="2.7"/>',
    spark:  '<path d="M12 2.5 13.8 8.7 20 10.5 13.8 12.3 12 18.5 10.2 12.3 4 10.5 10.2 8.7 12 2.5z"/>',
    warn:   '<path d="M12 3.5 22 20H2L12 3.5zM12 9.5v5M12 17.4v.4"/>'
  };
  var FILLED = { star: 1 };

  function icon(name, cls) {
    var filled = FILLED[name];
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" ' +
      (filled ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"') +
      ' aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }

  function starsHTML(rating) {
    var pct = Math.max(0, Math.min(5, rating)) / 5 * 100;
    var row = '';
    for (var i = 0; i < 5; i++) row += icon('star');
    return '<span class="stars" aria-label="Rated ' + rating + ' out of 5">' +
      '<span class="stars-bg">' + row + '</span>' +
      '<span class="stars-fg" style="width:' + pct + '%">' + row + '</span></span>';
  }

  /* ------------------------------ toasts ----------------------------- */
  function toast(msg, type) {
    var stack = document.getElementById('toasts');
    if (!stack) return;
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'ok');
    t.innerHTML = icon(type === 'err' ? 'warn' : type === 'info' ? 'spark' : 'check') + '<span>' + msg + '</span>';
    stack.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 350);
    }, 2600);
  }

  /* ------------------------------ chrome ------------------------------ */
  /* On Django pages base.html publishes the real URL map as window.__URLS,
     because this file builds the header, mobile menu, footer, product cards
     and search results in JavaScript and cannot know the server's paths. The
     offline frontend publishes no map, so every helper keeps the legacy
     .html page as its fallback and that prototype keeps working unchanged.
     Read lazily so ordering never matters. */
  function U(name, fallback) {
    var map = global.__URLS || {};
    return map[name] || fallback;
  }

  /* A category menu entry: the server already resolved it to that category's
     page, or to the shop when the catalogue has no such category. */
  function catURL(slug) {
    var cats = (global.__URLS || {}).cats || {};
    return cats[slug] || 'category.html?cat=' + slug;
  }

  function prodURL(id) {
    var tpl = U('product', 'product.html?id=999999');
    return tpl.replace('999999', id);
  }

  /* Shop with a search term, for the search overlay's "View all" link. */
  function shopQuery(q) {
    return U('shop', 'shop.html') + '?q=' + encodeURIComponent(q);
  }

  function navHTML(active) {
    var links = [
      ['shop', U('shop', 'shop.html'), 'Shop'],
      ['men', catURL('men'), 'Men'],
      ['women', catURL('women'), 'Women'],
      ['kids', catURL('kids'), 'Kids'],
      ['running', catURL('running'), 'Running'],
      ['sale', catURL('sale'), 'Sale']
    ];
    var lhtml = links.map(function (l) {
      var on = active === l[0] ? ' class="on"' : '';
      var extra = l[0] === 'sale' ? ' sale-link' : '';
      return '<a href="' + l[1] + '"' + (on ? ' class="on' + extra + '"' : ' class="' + extra.replace(/^ /, '') + '"') + '>' + l[2] + '</a>';
    }).join('');
    var u = Store.currentUser();
    /* On Django pages the wishlist lives in the database at /wishlist/; the
       offline frontend keeps the legacy account-page tab. */
    var wishHref = Array.isArray(window.__WISHLIST) ? '/wishlist/' : 'account.html?tab=wishlist';
    /* The nav is rendered here in JS, so the Django session state (and the real
       logout URL) has to come from base.html. The offline prototype publishes no
       __AUTH, which is why it falls back to "not signed in". */
    var auth = window.__AUTH || { isAuthenticated: false };
    /* A signed-in Django visitor has an empty localStorage, so the store alone
       would send them to the login page; __AUTH tells us which it really is. */
    var accountHref = (u || auth.isAuthenticated) ? U('account', 'account.html') : U('login', 'login.html');
    var logoutLink = auth.isAuthenticated
      ? '<a class="nav-ic" href="' + auth.logoutUrl + '" aria-label="Log out">' + icon('logout') + '</a>'
      : '';
    var logoutMlink = auth.isAuthenticated
      ? '<a href="' + auth.logoutUrl + '">' + icon('logout') + ' Log out</a>'
      : '';
    return '' +
    '<div class="announce"><div class="announce-in">' +
      '<span>Complimentary express shipping on orders over $150</span>' +
      '<span class="announce-sep">\u2022</span>' +
      '<span>Use code <b>AERON10</b> for 10% off</span>' +
    '</div></div>' +
    '<header class="hdr" id="hdr">' +
      '<nav class="nav container-wide">' +
        '<button class="burger" id="burger" aria-label="Open menu">' + icon('menu') + '</button>' +
        '<a class="brand" href="' + U('home', 'index.html') + '" aria-label="AERON home">' + brandMark() + '<span>AERON</span></a>' +
        '<div class="nav-links" id="navLinks">' + lhtml + '</div>' +
        '<div class="nav-actions">' +
          '<button class="nav-ic" id="searchBtn" aria-label="Search">' + icon('search') + '</button>' +
          '<a class="nav-ic" href="' + wishHref + '" aria-label="Wishlist">' + icon('heart') + '<span class="badge" id="wishBadge" hidden></span></a>' +
          '<a class="nav-ic" href="' + accountHref + '" aria-label="Account">' + icon('user') + '</a>' +
          '<a class="nav-ic" href="' + U('cart', 'cart.html') + '" aria-label="Cart" id="cartIcon">' + icon('bag') + '<span class="badge" id="cartBadge" hidden></span></a>' +
          logoutLink +
        '</div>' +
      '</nav>' +
    '</header>' +
    '<div class="mnav" id="mnav">' +
      '<div class="mnav-top"><span>Menu</span><button class="nav-ic" id="mnavClose" aria-label="Close menu">' + icon('x') + '</button></div>' +
      '<div class="mnav-links">' + links.map(function (l) {
        return '<a href="' + l[1] + '"' + (l[0] === 'sale' ? ' class="sale-link"' : '') + '>' + l[2] + icon('arrowR') + '</a>';
      }).join('') + '</div>' +
      '<div class="mnav-foot">' +
        '<a href="' + U('account', 'account.html') + '">' + icon('user') + ' Account</a>' +
        '<a href="' + U('cart', 'cart.html') + '">' + icon('bag') + ' Cart</a>' +
        logoutMlink +
      '</div>' +
    '</div>' +
    '<div class="search-overlay" id="searchOverlay">' +
      '<div class="search-box container">' +
        '<div class="search-field">' + icon('search') +
          '<input id="searchInput" type="search" placeholder="Search shoes, categories\u2026" autocomplete="off"/>' +
          '<button class="nav-ic" id="searchClose" aria-label="Close search">' + icon('x') + '</button>' +
        '</div>' +
        '<div class="search-results" id="searchResults"></div>' +
      '</div>' +
    '</div>';
  }

  function brandMark() {
    return '<svg class="mark" viewBox="0 0 34 24" aria-hidden="true">' +
      '<path d="M2 22 L13 2 L18 2 L9.5 22 Z" fill="currentColor"/>' +
      '<path d="M13 22 L21.5 2 L26.5 2 L18 22 Z" fill="#ff4d1c"/>' +
      '<path d="M24 22 L30 8 L33 8 L27.5 22 Z" fill="currentColor"/></svg>';
  }

  function footerHTML() {
    return '' +
    '<footer class="footer">' +
      '<div class="container-wide">' +
        '<div class="footer-grid">' +
          '<div class="footer-brand">' +
            '<a class="brand footer-logo" href="' + U('home', 'index.html') + '">' + brandMark() + '<span>AERON</span></a>' +
            '<p>Engineered for motion. Designed for the city. Premium footwear, obsessively made since 2018.</p>' +
            '<div class="socials">' +
              '<a href="#" data-demo aria-label="Instagram">IG</a>' +
              '<a href="#" data-demo aria-label="X">X</a>' +
              '<a href="#" data-demo aria-label="YouTube">YT</a>' +
              '<a href="#" data-demo aria-label="TikTok">TT</a>' +
            '</div>' +
          '</div>' +
          '<div class="footer-col"><h4>Shop</h4>' +
            '<a href="' + catURL('new-arrivals') + '">New Arrivals</a>' +
            '<a href="' + catURL('men') + '">Men</a>' +
            '<a href="' + catURL('women') + '">Women</a>' +
            '<a href="' + catURL('kids') + '">Kids</a>' +
            '<a href="' + catURL('sale') + '">Sale</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Explore</h4>' +
            '<a href="' + catURL('running') + '">Running</a>' +
            '<a href="' + catURL('basketball') + '">Basketball</a>' +
            '<a href="' + catURL('sneakers') + '">Sneakers</a>' +
            '<a href="' + catURL('casual') + '">Casual</a>' +
          '</div>' +
          '<div class="footer-col"><h4>Support</h4>' +
            '<a href="#" data-demo>Shipping &amp; Returns</a>' +
            '<a href="#" data-demo>Size Guide</a>' +
            '<a href="#" data-demo>Contact Us</a>' +
            '<a href="/admin/">Admin Portal</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>\u00A9 2026 AERON Footwear Co. All rights reserved. Demo storefront.</span>' +
          '<span class="footer-pay">' + icon('card') + ' Visa &middot; Mastercard &middot; Amex &middot; COD</span>' +
        '</div>' +
      '</div>' +
      '<div class="footer-watermark" aria-hidden="true">AERON</div>' +
    '</footer>';
  }

  /* ---------------------------- product card -------------------------- */
  /* Product ids reach us as strings (data-id) while the server publishes
     window.__WISHLIST as JSON numbers, so a plain indexOf() would never match
     and every heart click would append a duplicate entry. Compare as numbers
     and return the index, or -1 when the product is not saved. */
  function wishIndex(pid) {
    var num = Number(pid);
    for (var i = 0; i < window.__WISHLIST.length; i++) {
      if (Number(window.__WISHLIST[i]) === num) return i;
    }
    return -1;
  }

  function isWished(pid) {
    /* Django pages publish the wishlist from the database; the plain
       frontend falls back to localStorage. */
    if (Array.isArray(window.__WISHLIST)) return wishIndex(pid) !== -1;
    return Store.inWishlist(pid);
  }

  function cardHTML(p, animate) {
    var sale = p.sale != null && p.sale < p.price;
    var soldout = p.stock <= 0;
    var low = !soldout && p.stock <= 5;
    var wished = isWished(p.id);
    var wurl = Array.isArray(window.__WISHLIST) && window.__WISH_URL ? window.__WISH_URL.replace('999999', p.id) : '';
    var badges = '';
    if (soldout) badges += '<span class="pbadge pb-out">Sold out</span>';
    else {
      if (p.isNew) badges += '<span class="pbadge pb-new">New</span>';
      if (sale) badges += '<span class="pbadge pb-sale">-' + Math.round((1 - p.sale / p.price) * 100) + '%</span>';
    }
    var hover = p.imgHover ? '<img class="pcard-alt" src="' + Store.img(p.imgHover) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
    var detailHref = prodURL(p.id);
    return '' +
    '<article class="pcard' + (animate === false ? '' : ' rv') + '" data-id="' + p.id + '">' +
      '<a class="pcard-media" href="' + detailHref + '" aria-label="' + Store.esc(p.name) + '">' +
        '<img class="pcard-img" src="' + Store.img(p.img) + '" alt="' + Store.esc(p.name) + '" loading="lazy">' + hover +
        (badges ? '<div class="pcard-badges">' + badges + '</div>' : '') +
        '<div class="pcard-quick">' +
          '<button class="qbtn" data-action="quickview" data-id="' + p.id + '" title="Quick view" aria-label="Quick view">' + icon('eye') + '</button>' +
          '<button class="qbtn' + (wished ? ' on' : '') + '" data-action="wish" data-id="' + p.id + '"' + (wurl ? ' data-url="' + wurl + '"' : '') + ' title="Wishlist" aria-label="Toggle wishlist">' + icon('heart') + '</button>' +
        '</div>' +
        (low ? '<span class="pstock">Only ' + p.stock + ' left</span>' : '') +
      '</a>' +
      '<div class="pcard-info">' +
        '<div class="pcard-row1">' +
          '<h3 class="pcard-name"><a href="' + detailHref + '">' + Store.esc(p.name) + '</a></h3>' +
          '<div class="pcard-price">' + (sale ? '<s>' + Store.money(p.price) + '</s><b class="sale">' + Store.money(p.sale) + '</b>' : '<b>' + Store.money(p.price) + '</b>') + '</div>' +
        '</div>' +
        '<div class="pcard-row2">' +
          '<span class="pcard-cat">' + Store.esc(Store.catLabel(p)) + '</span>' +
          '<span class="pcard-rate">' + starsHTML(p.rating) + '<em>(' + p.reviews + ')</em></span>' +
        '</div>' +
        '<button class="btn btn-block pcard-add" data-action="add" data-id="' + p.id + '"' + (soldout ? ' disabled' : '') + '>' +
          (soldout ? 'Sold Out' : icon('bag') + '<span>Add to Cart</span>') +
        '</button>' +
      '</div>' +
    '</article>';
  }

  function renderCards(container, products, animate) {
    container.innerHTML = products.map(function (p) { return cardHTML(p, animate); }).join('');
    if (global.UI_reveal) UI_reveal(container);
  }

  /* ------------------------------ badges ------------------------------ */
  function updateBadges() {
    var cb = document.getElementById('cartBadge');
    var wb = document.getElementById('wishBadge');
    if (cb) {
      /* Django pages set window.__CART_COUNT from the database; the plain
         frontend falls back to localStorage (Store.cartCount). */
      var fromServer = typeof window.__CART_COUNT === 'number';
      var n = fromServer ? window.__CART_COUNT : Store.cartCount();
      cb.textContent = n;
      cb.hidden = fromServer ? false : (n === 0);
    }
    if (wb) {
      var w = Array.isArray(window.__WISHLIST) ? window.__WISHLIST.length : Store.wishlist().length;
      wb.textContent = w; wb.hidden = w === 0;
    }
  }

  /* ----------------------------- fly to cart --------------------------- */
  function flyToCart(fromEl) {
    var cartIcon = document.getElementById('cartIcon');
    if (!cartIcon || !fromEl) return pulseCart();
    var img = fromEl.closest('.pcard, .qview, .pd-gallery') ?
      (fromEl.closest('.pcard, .qview, .pd-gallery, .cart-row') || document).querySelector('img') : null;
    var src = img ? img.currentSrc || img.src : '';
    var dot = document.createElement('div');
    dot.className = 'fly-dot';
    if (src) { dot.style.backgroundImage = 'url("' + src + '")'; dot.classList.add('fly-img'); }
    var r = (fromEl.getBoundingClientRect());
    dot.style.left = r.left + r.width / 2 + 'px';
    dot.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(dot);
    var t = cartIcon.getBoundingClientRect();
    requestAnimationFrame(function () {
      dot.style.transform = 'translate(' + (t.left + t.width / 2 - (r.left + r.width / 2)) + 'px,' +
        (t.top + t.height / 2 - (r.top + r.height / 2)) + 'px) scale(.12)';
      dot.style.opacity = '.25';
    });
    setTimeout(function () { dot.remove(); pulseCart(); }, 650);
  }
  function pulseCart() {
    var b = document.getElementById('cartBadge');
    if (b) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
    updateBadges();
  }

  /* ------------------------------ actions ------------------------------ */
  function quickAdd(pid, btn) {
    var p = Store.product(pid);
    if (!p) return;
    if (p.stock <= 0) { toast('Sorry, this item is sold out.', 'err'); return; }
    Store.addToCart(pid, null, null, 1);
    flyToCart(btn);
    toast('Added <b>' + Store.esc(p.name) + '</b> (US ' + (p.sizes[0] || '?') + ') to your bag.');
  }

  /* ------------------- add to cart (Django database) ------------------ */
  function csrfToken() {
    if (typeof window.__CSRF === 'string' && window.__CSRF) return window.__CSRF;
    var m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* POST pid/qty to the real /cart/add/<id>/ endpoint. Resolves with the
     server's JSON (includes the total cart count) or null when the response
     was a redirect (logged out -> the view kicked us to /login/).
     A rejected add — an invalid quantity, or more units than the product has
     in stock — rejects with an Error carrying the server's own wording in
     .serverMessage, so the caller can show the real reason. */
  function addToCartDB(pid, url, opts) {
    opts = opts || {};
    var qty = parseInt(opts.quantity, 10);
    var params = new URLSearchParams();
    params.append('quantity', String(qty));
    if (opts.size) params.append('size', opts.size);
    /* Colour picked on the Product Detail swatches. Product-card quick adds
       pass no color, and the backend treats a missing color as "no colour on
       this line" (blank), exactly like a missing size. */
    if (opts.color) params.append('color', opts.color);
    var csrf = csrfToken();
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrf,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: params.toString()
    }).then(function (res) {
      if (res.redirected) {
        /* Follow the login requirement the real cart uses instead of
           pretending the item was added. */
        window.location.href = res.url;
        return null;
      }
      /* A rejected add answers 400 with the reason in "errors", so the body is
         read on the failure path too — that message is what the caller shows. */
      return res.json().catch(function () { return null; })
        .then(function (data) {
          if (!res.ok) {
            throw rejection(data, 'Request failed (' + res.status + ')');
          }
          return data;
        });
    }).then(function (data) {
      if (!data) return null;
      if (!data.ok) throw rejection(data);
      return data;
    });
  }

  /* An Error that carries the server's own explanation — the stock message from
     the add-to-cart view, say — for the caller to display verbatim. */
  function rejection(data, fallback) {
    var first = '';
    if (data && data.errors) {
      for (var k in data.errors) {
        if (Object.prototype.hasOwnProperty.call(data.errors, k) && data.errors[k]) {
          first = data.errors[k];
          break;
        }
      }
    }
    var err = new Error(first || fallback || 'Server rejected the request.');
    err.serverMessage = first;
    return err;
  }

  /* Keep the header badge in sync without a page reload. */
  function syncCartBadge(count) {
    if (typeof window.__CART_COUNT === 'number') window.__CART_COUNT = count;
    updateBadges();
  }

  /* ---------------- colour swatch selection ----------------
     Shared by the product-card Quick Add and the Quick View dialog. Selection
     uses the same .on class as the product-detail picker, but it always starts
     empty here: the first colour is never chosen on the customer's behalf.
     `scope` is the card or the dialog, so the choice is per-product. */
  function pickColor(scope, dot) {
    var wasOn = dot.classList.contains('on');
    scope.querySelectorAll('[data-color]').forEach(function (x) {
      var on = !wasOn && x === dot;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var err = scope.querySelector('[data-color-err]');
    if (err) err.hidden = true;
    return wasOn ? '' : (dot.dataset.color || '');
  }

  /* The colour the customer picked, or "" when they have not chosen one. */
  function chosenColor(scope) {
    var sel = scope && scope.querySelector('[data-color].on');
    return sel ? (sel.dataset.color || '') : '';
  }

  /* True when this product offers a colour choice, so an add must carry one. */
  function hasColorPicker(scope) {
    return !!(scope && scope.querySelector('.pcard-colors, .qv-colors'));
  }

  function showColorErr(scope) {
    var e = scope && scope.querySelector('[data-color-err]');
    if (e) e.hidden = false;
  }

  /* "Color · US 9" style suffix so the toast names the exact variant added. */
  function variantLabel(color, size) {
    var bits = [];
    if (color) bits.push(color);
    if (size) bits.push('US ' + size);
    return bits.length ? ' (' + bits.join(' \u00B7 ') + ')' : '';
  }

  /* The product-card "Add to Cart" click. Server-rendered cards carry the
     real database endpoint; only the offline frontend falls back to the
     legacy localStorage quick-add. */
  function cardAdd(pid, btn) {
    var url = btn.getAttribute('data-url');
    if (!url) { quickAdd(pid, btn); return; }
    var p = Store.product(pid);
    if (p && p.stock <= 0) { toast('Sorry, this item is sold out.', 'err'); return; }
    var card = btn.closest('.pcard');
    var nameEl = card ? card.querySelector('.pcard-name a') : null;
    var name = nameEl ? nameEl.textContent.replace(/^\s+|\s+$/g, '') : 'this item';
    /* A card that offers colours requires an explicit choice — the add is held
       back with an inline message rather than defaulting to the first swatch. */
    var color = card ? chosenColor(card) : '';
    if (hasColorPicker(card) && !color) { showColorErr(card); return; }
    addToCartDB(pid, url, { color: color, quantity: 1 }).then(function (data) {
      if (!data) return; /* redirected to login already */
      flyToCart(btn);
      toast('Added <b>' + Store.esc(name) + '</b>' + (color ? ' (' + Store.esc(color) + ')' : '') + ' to your bag.');
      syncCartBadge(data.count);
    }).catch(function () {
      toast('Couldn\u2019t add to your bag \u2014 please try again.', 'err');
    });
  }

  function findWishURL(pid, btn) {
    var url = btn ? btn.getAttribute('data-url') : '';
    /* Server-rendered hearts carry the real per-product endpoint; any other
       heart on a Django page (quickview, JS-rendered cards) builds it from
       the page-wide template URL. */
    if (!url && Array.isArray(window.__WISHLIST) && window.__WISH_URL) {
      url = window.__WISH_URL.replace('999999', pid);
    }
    return url;
  }

  function setWished(pid, on) {
    document.querySelectorAll('[data-action="wish"][data-id="' + pid + '"]').forEach(function (el) {
      el.classList.toggle('on', on);
    });
    if (Array.isArray(window.__WISHLIST)) {
      var i = wishIndex(pid);
      if (on && i === -1) window.__WISHLIST.push(Number(pid));
      if (!on && i !== -1) window.__WISHLIST.splice(i, 1);
      window.__WISHLIST_COUNT = window.__WISHLIST.length;
    }
    updateBadges();
  }

  function toggleWish(pid, btn) {
    var url = findWishURL(pid, btn);
    /* No database endpoint around -> offline frontend, keep the old
       localStorage behaviour. */
    if (!url) {
      var added = Store.toggleWishlist(pid);
      setWished(pid, added);
      toast(added ? 'Saved to your wishlist.' : 'Removed from wishlist.', added ? 'ok' : 'info');
      return;
    }
    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken(),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: ''
    }).then(function (res) {
      /* Logged out -> the view redirects to /login/; follow it so the user
         knows they have to sign in before saving items. */
      if (res.redirected) { window.location.href = res.url; return null; }
      if (!res.ok) throw new Error('Request failed (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      if (!data) return;
      var added = data.added;
      setWished(pid, added);
      toast(added ? 'Saved to your wishlist.' : 'Removed from your wishlist.', added ? 'ok' : 'info');
      /* On the wishlist page, fade the removed row out; if that empties the
         list the server's empty state is shown again. */
      if (!added && document.querySelector('.wish-row')) {
        var row = btn && btn.closest ? btn.closest('.wish-row') : null;
        var target = row || btn;
        target.style.transition = 'opacity .25s';
        target.style.opacity = '0';
        setTimeout(function () {
          if (row) row.remove();
          if (!document.querySelector('.wish-row')) window.location.reload();
        }, 280);
      }
    }).catch(function () {
      toast('Couldn\u2019t update your wishlist \u2014 please try again.', 'err');
    });
  }

  /* ------------------------------ quick view --------------------------- */
  /* Build a lightweight product object from a server-rendered card's data-*
     attributes (the Django pages publish every field the quick view needs).
     Returns null for offline/JS-rendered cards, which only store data-id —
     those keep using the localStorage Store lookup below. */
  function cardProduct(btn) {
    var card = btn && btn.closest ? btn.closest('.pcard') : null;
    if (!card || !('sizes' in card.dataset)) return null;
    var d = card.dataset;
    var nameEl = card.querySelector('.pcard-name a');
    var imgEl = card.querySelector('.pcard-img');
    var addBtn = card.querySelector('.pcard-add');
    var colors = [];
    (d.colors || '').split(',').filter(Boolean).forEach(function (pair) {
      var i = pair.indexOf(':');
      colors.push(i === -1 ? { name: pair, hex: '' } : { name: pair.slice(0, i), hex: pair.slice(i + 1) });
    });
    var display = parseFloat(d.price || 0) || 0;
    var regular = parseFloat(d.reg || display) || display;
    var onSale = !!(regular && display && display < regular);
    return {
      id: d.id,
      name: nameEl ? nameEl.textContent.replace(/^\s+|\s+$/g, '') : '',
      img: imgEl ? (imgEl.currentSrc || imgEl.src) : '',
      price: regular,
      sale: onSale ? display : null,
      rating: parseFloat(d.rating || 0),
      reviews: parseInt(d.reviews || 0, 10),
      sizes: (d.sizes || '').split(',').filter(Boolean),
      colors: colors,
      desc: d.desc || '',
      catLabel: d.catlabel || '',
      addUrl: addBtn ? (addBtn.getAttribute('data-url') || '') : ''
    };
  }

  function quickView(pid, btn) {
    var p = cardProduct(btn) || Store.product(pid);
    if (!p) return;
    var root = document.getElementById('modal-root');
    /* Django pages publish this array; the offline frontend does not. */
    var isDb = Array.isArray(window.__WISHLIST);
    var sale = p.sale != null && p.sale < p.price;
    var sizes = p.sizes || [];
    var detailHref = prodURL(pid);
    root.innerHTML = '' +
    '<div class="modal-backdrop" data-close></div>' +
    '<div class="qview" role="dialog" aria-modal="true" aria-label="Quick view">' +
      '<button class="qview-close" data-close aria-label="Close">' + icon('x') + '</button>' +
      '<div class="qview-media"><img src="' + Store.img(p.img) + '" alt="' + Store.esc(p.name) + '"></div>' +
      '<div class="qview-info">' +
        '<p class="overline">' + Store.esc(p.catLabel || Store.catLabel(p)) + '</p>' +
        '<h3>' + Store.esc(p.name) + '</h3>' +
        '<div class="qview-price">' + (sale ? '<s>' + Store.money(p.price) + '</s> <b>' + Store.money(p.sale) + '</b>' : '<b>' + Store.money(p.price) + '</b>') + '</div>' +
        '<div class="qview-rate">' + starsHTML(p.rating) + '<em>' + p.rating + ' \u00B7 ' + p.reviews + ' reviews</em></div>' +
        '<p class="qview-desc">' + Store.esc(p.desc) + '</p>' +
        (p.colors && p.colors.length ? '<div class="qv-colors"><p class="lbl">Color</p><div class="color-row">' +
          p.colors.map(function (c) {
            /* Same pill as the Product Detail picker, so the swatch and its
               name look identical in both places. aria-pressed starts false:
               no colour is selected until the customer clicks one. */
            return '<button type="button" class="color-choice" data-color="' + Store.esc(c.name) +
              '" data-hex="' + Store.esc(c.hex || '') + '" aria-pressed="false">' +
              '<i class="color-dot" style="background:' + Store.esc(c.hex || '') + '"></i>' +
              '<span class="color-name">' + Store.esc(c.name) + '</span></button>';
          }).join('') +
        '</div><p class="field-err" data-color-err hidden>Please choose a color.</p></div>' : '') +
        (sizes.length ? '<div class="qv-sizes"><p class="lbl">Select size (US)</p><div class="size-row">' +
          sizes.map(function (s) { return '<button class="size-chip" data-size="' + s + '">' + s + '</button>'; }).join('') +
        '</div><p class="field-err" id="qvSizeErr" hidden>Please choose a size.</p></div>' : '') +
        '<div class="qview-cta">' +
          '<button class="btn btn-dark btn-lg" id="qvAdd">' + icon('bag') + '<span>Add to Cart</span></button>' +
          '<a class="btn btn-ghost btn-lg" href="' + detailHref + '">Full details ' + icon('arrowR') + '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.classList.add('modal-open');
    var size = null;
    root.querySelectorAll('.size-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        root.querySelectorAll('.size-chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on'); size = c.dataset.size;
        var e = document.getElementById('qvSizeErr'); if (e) e.hidden = true;
      });
    });
    /* Colour swatches, single-select inside the dialog. Nothing is pre-picked,
       so the customer always chooses before the line is added. */
    var colorScope = root.querySelector('.qv-colors');
    if (colorScope) {
      colorScope.querySelectorAll('[data-color]').forEach(function (c) {
        c.addEventListener('click', function () { pickColor(colorScope, c); });
      });
    }
    var addBtn = document.getElementById('qvAdd');
    addBtn.addEventListener('click', function () {
      /* A style that offers colours cannot be added without one, and the first
         colour is never substituted in. Size/quantity behaviour is untouched. */
      var color = colorScope ? chosenColor(colorScope) : '';
      if (colorScope && !color) { showColorErr(colorScope); return; }
      if (sizes.length && !size) { var e = document.getElementById('qvSizeErr'); if (e) e.hidden = false; return; }
      if (isDb) {
        /* Real database cart: POST to the card's own /cart/add/<id>/ endpoint
           so the item lands in the logged-in user's cart with its size and colour. */
        addToCartDB(pid, p.addUrl, { size: size || '', color: color, quantity: 1 }).then(function (data) {
          if (!data) return; /* logged out -> addToCartDB navigated to /login/ */
          flyToCart(addBtn);
          toast('Added <b>' + Store.esc(p.name) + '</b>' + variantLabel(color, size || 'One Size') + ' to your bag.');
          syncCartBadge(data.count);
          closeModal();
        }).catch(function () {
          toast('Couldn\u2019t add to your bag \u2014 please try again.', 'err');
        });
      } else {
        /* The chosen colour travels with the line instead of the first one. */
        Store.addToCart(p.id, size, color, 1);
        flyToCart(addBtn);
        toast('Added <b>' + Store.esc(p.name) + '</b>' + variantLabel(color, size) + ' to your bag.');
        closeModal();
      }
    });
  }

  function closeModal() {
    var root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    document.body.classList.remove('modal-open');
  }

  /* ------------------------------ search ------------------------------- */
  function searchProducts(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    return Store.products().filter(function (p) {
      return (p.name + ' ' + p.sport + ' ' + p.gender + ' ' + Store.catLabel(p)).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 5);
  }

  function wireSearch() {
    var overlay = document.getElementById('searchOverlay');
    var input = document.getElementById('searchInput');
    var results = document.getElementById('searchResults');
    if (!overlay) return;
    function open() { overlay.classList.add('open'); document.body.classList.add('modal-open'); setTimeout(function () { input.focus(); }, 120); }
    function close() { overlay.classList.remove('open'); document.body.classList.remove('modal-open'); }
    document.getElementById('searchBtn').addEventListener('click', open);
    document.getElementById('searchClose').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); closeModal(); closeMnav(); } });
    input.addEventListener('input', function () {
      var rs = searchProducts(input.value);
      var q = input.value.trim();
      if (!q) { results.innerHTML = '<p class="search-hint">Try \u201Crunner\u201D, \u201Ccourt\u201D, \u201Ckids\u201D\u2026</p>'; return; }
      if (!rs.length) { results.innerHTML = '<p class="search-hint">No matches for \u201C' + Store.esc(q) + '\u201D.</p>'; return; }
      results.innerHTML = rs.map(function (p) {
        return '<a class="search-item" href="' + prodURL(p.id) + '">' +
          '<img src="' + Store.img(p.img) + '" alt="">' +
          '<span class="si-name">' + Store.esc(p.name) + '</span>' +
          '<span class="si-meta">' + Store.esc(Store.catLabel(p)) + '</span>' +
          '<b>' + Store.money(p.sale || p.price) + '</b></a>';
      }).join('') + '<a class="search-all" href="' + shopQuery(q) + '">View all results ' + icon('arrowR') + '</a>';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) location.href = shopQuery(input.value.trim());
    });
  }

  /* ----------------------------- mobile nav ---------------------------- */
  function closeMnav() {
    var m = document.getElementById('mnav');
    if (m) m.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  /* ------------------------------- effects ----------------------------- */
  var revealIO = null;
  function UI_reveal(scope) {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    (scope || document).querySelectorAll('.rv:not(.in)').forEach(function (el) { revealIO.observe(el); });
  }
  global.UI_reveal = UI_reveal;

  function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var dot = document.createElement('div'); dot.className = 'cur-dot';
    var ring = document.createElement('div'); ring.className = 'cur-ring';
    document.body.appendChild(dot); document.body.appendChild(ring);
    var x = -100, y = -100, rx = -100, ry = -100;
    document.addEventListener('mousemove', function (e) { x = e.clientX; y = e.clientY; dot.style.opacity = ring.style.opacity = 1; });
    document.addEventListener('mouseleave', function () { dot.style.opacity = ring.style.opacity = 0; });
    (function loop() {
      rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', function (e) {
      var hot = e.target.closest('a,button,input,select,textarea,.size-chip,.color-dot,[data-cursor]');
      ring.classList.toggle('big', !!hot);
    });
  }

  function initMagnetic() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    document.querySelectorAll('.mg').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / r.width;
        var dy = (e.clientY - r.top - r.height / 2) / r.height;
        el.style.transform = 'translate(' + dx * 8 + 'px,' + dy * 6 + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  function initPageTransition() {
    document.addEventListener('click', function (e) {
      /* Card quick actions (Eye = quick view, Heart = wishlist, Add to cart)
         are buttons, not links: the shared [data-action] handler below runs
         them in JS and calls preventDefault(), so the click never navigates.
         The Eye/Heart buttons are nested inside the card's product link, so
         without this guard the anchor check below matches the card link, the
         page is marked "leaving" (html.leaving fades body to opacity 0), the
         following preventDefault() cancels the navigation that was supposed to
         replace the page, and nothing ever removes the class — leaving a blank
         page with its content still in the DOM. Only real navigations should
         start the leave transition. */
      if (e.target.closest('[data-action]')) return;
      var a = e.target.closest('a');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || a.target === '_blank') return;
      if (/^(mailto:|tel:|javascript)/.test(href)) return;
      if (a.hasAttribute('data-demo')) { e.preventDefault(); toast('Demo link \u2014 this is a concept storefront.', 'info'); return; }
      document.documentElement.classList.add('leaving');
    });
  }

  function initHeaderScroll() {
    var hdr = document.getElementById('hdr');
    if (!hdr) return;
    var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 10); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------- mount ------------------------------- */
  function mountChrome(active) {
    var navRoot = document.getElementById('nav-root');
    var footRoot = document.getElementById('footer-root');
    if (navRoot) navRoot.innerHTML = navHTML(active);
    if (footRoot) footRoot.innerHTML = footerHTML();

    var burger = document.getElementById('burger');
    var mnav = document.getElementById('mnav');
    if (burger && mnav) {
      burger.addEventListener('click', function () { mnav.classList.add('open'); document.body.classList.add('modal-open'); });
      var c = document.getElementById('mnavClose');
      if (c) c.addEventListener('click', closeMnav);
    }
    wireSearch();
    initHeaderScroll();
    initPageTransition();
    initCursor();
    initMagnetic();
    updateBadges();
    hidePreloader();

    /* global card actions (event delegation) */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) {
        var closer = e.target.closest('[data-close]');
        if (closer || e.target.classList.contains('modal-backdrop')) closeModal();
        return;
      }
      var act = el.dataset.action, id = el.dataset.id;
      if (act === 'add') { e.preventDefault(); cardAdd(id, el); }
      else if (act === 'color') { e.preventDefault(); pickColor(el.closest('.pcard') || el.parentNode, el); }
      else if (act === 'wish') { e.preventDefault(); toggleWish(id, el); }
      else if (act === 'quickview') { e.preventDefault(); quickView(id, el); }
    });
  }

  function hidePreloader() {
    var pre = document.getElementById('preloader');
    if (!pre) return;
    var min = 450;
    var started = window.__preStart || 0;
    var wait = Math.max(0, min - (performance.now() - started));
    setTimeout(function () {
      pre.classList.add('done');
      setTimeout(function () { pre.remove(); }, 700);
    }, wait);
  }

  global.UI = {
    icon: icon, stars: starsHTML, toast: toast, money: Store.money,
    mountChrome: mountChrome, updateBadges: updateBadges,
    cardHTML: cardHTML, renderCards: renderCards,
    quickView: quickView, closeModal: closeModal,
    flyToCart: flyToCart, pulseCart: pulseCart,
    quickAdd: quickAdd, toggleWish: toggleWish,
    addToCartDB: addToCartDB, syncCartBadge: syncCartBadge,
    brandMark: brandMark, hidePreloader: hidePreloader
  };
})(window);
