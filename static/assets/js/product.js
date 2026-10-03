/* AERON — Product detail page (Django version)
   The product detail is rendered by Django from the database. This script
   only wires the existing UI interactions: gallery thumbs + click-to-zoom,
   color / size / quantity selects, the tab switching and the "Add to Cart"
   POST (which now sends the selected quantity to the real database cart).
   Wishlist and checkout stay untouched.

   The customer's color / size / quantity choices are mirrored onto
   window.PD as they are made — see "product detail selection state" below —
   and the chosen color is sent with Add to Cart and Buy Now. */

/* Django-specific values injected by the product template:
   window.__ADD_URL  -> POST endpoint for adding this product to the cart
   window.__CSRF     -> CSRF token required by that POST */
(function () {
  'use strict';

  UI.mountChrome('shop');

  var root = document.getElementById('productRoot');
  if (!root || !root.dataset.pid) return; /* no product rendered (e.g. 404 page) */

  /* ---------------- product detail selection state ----------------
     Public, documented hand-off point for the cart stage. The cart add/buy
     requests read the customer's choices from here:
       window.PD.color    -> { name, hex, index } of the selected colour
                             (null when the product has no colours)
       window.PD.size     -> chosen US size ('' for a sizeless style)
       window.PD.quantity -> the number shown in the stepper
     The Add to Cart / Buy Now handlers below send PD.color.name as the
     "color" field; the cart stores it alongside size and quantity. */
  var PD = {
    pid: root.dataset.pid,
    color: null,
    size: '',
    quantity: 1
  };
  window.PD = PD;

  /* ---------------- add to cart (Django) ---------------- */
  var addBtn = document.getElementById('addBtn');
  if (addBtn && window.__ADD_URL) addBtn.addEventListener('click', function () {
    var chip = sizeRow ? sizeRow.querySelector('.size-chip.on') : null;
    // Styles without a size grid don't need a size pick.
    var hasChips = !!(sizeRow && sizeRow.querySelector('.size-chip'));
    if (hasChips && !chip) {
      var sizeErr = document.getElementById('sizeErr');
      if (sizeErr) sizeErr.hidden = false;
      return;
    }
    var size = chip ? chip.dataset.size : '';
    // The Add to Cart request MUST send the exact quantity shown in the
    // stepper (#qtyVal) at click time — never a hardcoded 1 and never a
    // reset. An unreadable value is passed through so the backend's
    // quantity >= 1 validation rejects it instead of silently adding 1.
    var qtyValEl = document.getElementById('qtyVal');
    var quantity = parseInt(qtyValEl ? qtyValEl.textContent : '', 10);
    /* The colour chosen on the swatches above. PD.color is seeded from the
       server-pre-selected swatch, so it is already set on first click; a
       product with no colours keeps it null and the line is saved colourless. */
    var color = PD.color ? PD.color.name : '';

    addBtn.disabled = true;
    UI.addToCartDB(root.dataset.pid, window.__ADD_URL, { size: size, color: color, quantity: quantity }).then(function (data) {
      addBtn.disabled = false;
      if (!data) return; /* logged out -> addToCartDB navigated to /login/ */
      UI.flyToCart(addBtn);
      var name = root.getAttribute('data-name') || 'this item';
      var variant = (color ? color + ' \u00B7 ' : '') + 'US ' + (size || 'One Size');
      UI.toast('Added <b>' + Store.esc(name) + '</b> (' + variant + ') \u00D7 ' + quantity + ' to your bag.');
      UI.syncCartBadge(data.count);
      // Success: the DB cart accepted the item — send the user to the
      // existing cart page. This runs only after a successful response.
      window.location.href = '/cart/';
    }).catch(function (err) {
      addBtn.disabled = false;
      /* The server refuses anything above the product's stock, and says so in
         its own words — show that instead of a blanket "couldn't add". */
      UI.toast(err && err.serverMessage
        ? err.serverMessage
        : 'Couldn\u2019t add to your bag \u2014 please try again.', 'err');
    });
  });

  /* ---------------- buy now (Django) ----------------
     Adds the SAME selected configuration — colour, size and quantity — to the
     real DB cart through the existing add_to_cart endpoint (so the
     colour/size validation, quantity checks, CSRF and the
     merge-on-duplicate rules all apply), then goes straight to the
     existing /checkout/ page. The redirect only happens after the server
     confirms the add; on any error we stay here with the error toast. */
  var buyBtn = document.getElementById('buyBtn');
  if (buyBtn && window.__ADD_URL) buyBtn.addEventListener('click', function () {
    var chip = sizeRow ? sizeRow.querySelector('.size-chip.on') : null;
    var hasChips = !!(sizeRow && sizeRow.querySelector('.size-chip'));
    if (hasChips && !chip) {
      var sizeErr = document.getElementById('sizeErr');
      if (sizeErr) sizeErr.hidden = false;
      return;
    }
    var size = chip ? chip.dataset.size : '';
    var qtyValEl = document.getElementById('qtyVal');
    var quantity = parseInt(qtyValEl ? qtyValEl.textContent : '', 10);
    /* Same colour swatch selection as Add to Cart, so Buy Now orders the
       exact configuration the customer is looking at. */
    var color = PD.color ? PD.color.name : '';

    buyBtn.disabled = true;
    UI.addToCartDB(root.dataset.pid, window.__ADD_URL, { size: size, color: color, quantity: quantity }).then(function (data) {
      buyBtn.disabled = false;
      if (!data) return; /* logged out -> addToCartDB navigated to /login/ */
      UI.syncCartBadge(data.count);
      window.location.href = '/checkout/';
    }).catch(function (err) {
      buyBtn.disabled = false;
      /* Same stock refusal as Add to Cart, including the reason. */
      UI.toast(err && err.serverMessage
        ? err.serverMessage
        : 'Couldn\u2019t add to your bag \u2014 please try again.', 'err');
    });
  });

  var mainEl = document.getElementById('pdMain');
  var imgEl = document.getElementById('pdImg');

  /* ---------------- gallery thumbs + zoom ---------------- */
  var pdThumbs = document.getElementById('pdThumbs');
  if (pdThumbs) pdThumbs.addEventListener('click', function (e) {
    var th = e.target.closest('.pd-thumb');
    if (!th) return;
    mainEl.classList.remove('zoom');
    document.querySelectorAll('.pd-thumb').forEach(function (x) { x.classList.remove('on'); });
    th.classList.add('on');
    var src = th.querySelector('img').src;
    if (th.dataset.i === 'zoom') {
      imgEl.src = src;
      imgEl.style.padding = '0'; imgEl.style.transform = 'scale(1.9)'; imgEl.style.transformOrigin = '60% 55%';
    } else {
      imgEl.src = src;
      imgEl.style.padding = ''; imgEl.style.transform = ''; imgEl.style.transformOrigin = '';
    }
    imgEl.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 280, easing: 'ease' });
  });

  mainEl.addEventListener('click', function () {
    if (pdThumbs && pdThumbs.querySelector('.pd-thumb.on[data-i="zoom"]')) return;
    mainEl.classList.toggle('zoom');
  });
  mainEl.addEventListener('mousemove', function (e) {
    if (!mainEl.classList.contains('zoom')) return;
    var r = mainEl.getBoundingClientRect();
    imgEl.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
  });

  /* ---------------- color select ----------------
     Exactly one colour is active at a time: every option is cleared, then
     the clicked one is marked with the .on class and aria-pressed="true"
     for assistive tech. The choice is mirrored into window.PD.color. */
  function selectColor(btn) {
    document.querySelectorAll('#colorRow .color-choice').forEach(function (x) {
      var on = x === btn;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    PD.color = {
      name: btn.dataset.color || '',
      hex: btn.dataset.hex || '',
      index: parseInt(btn.dataset.i, 10)
    };
    var label = document.getElementById('colorLabel');
    if (label) label.textContent = PD.color.name;
  }

  var colorRow = document.getElementById('colorRow');
  if (colorRow) {
    /* The server pre-selects the first option, so PD.color is populated
       before the customer touches anything. */
    var initialColor = colorRow.querySelector('.color-choice.on') || colorRow.querySelector('.color-choice');
    if (initialColor) selectColor(initialColor);
    colorRow.addEventListener('click', function (e) {
      var choice = e.target.closest('.color-choice');
      if (choice) selectColor(choice);
    });
  }

  /* ---------------- size select ---------------- */
  var sizeRow = document.getElementById('sizeRow');
  if (sizeRow) sizeRow.addEventListener('click', function (e) {
    var c = e.target.closest('.size-chip');
    if (!c) return;
    document.querySelectorAll('.size-chip').forEach(function (x) { x.classList.remove('on'); });
    c.classList.add('on');
    PD.size = c.dataset.size || '';
    var sizeErr = document.getElementById('sizeErr');
    if (sizeErr) sizeErr.hidden = true;
  });

  /* ---------------- quantity stepper ----------------
     The ceiling is the product's own stock, published by the server as
     data-stock on #productRoot, so the stepper can never offer more units than
     the style has. The server re-checks it on every add regardless. */
  var qMinus = document.getElementById('qtyMinus'), qPlus = document.getElementById('qtyPlus');
  var qtyVal = document.getElementById('qtyVal');
  var maxQty = parseInt(root.dataset.stock, 10);
  if (isNaN(maxQty) || maxQty < 1) maxQty = 1;
  function setQty(n) {
    qtyVal.textContent = n;
    PD.quantity = n;
  }
  if (qMinus) qMinus.addEventListener('click', function () {
    setQty(Math.max(1, parseInt(qtyVal.textContent || '1', 10) - 1));
  });
  if (qPlus) qPlus.addEventListener('click', function () {
    setQty(Math.min(maxQty, parseInt(qtyVal.textContent || '1', 10) + 1));
  });
  /* Seed the state from the server-rendered stepper value. */
  if (qtyVal) {
    var seedQty = parseInt(qtyVal.textContent || '1', 10);
    PD.quantity = isNaN(seedQty) ? 1 : Math.min(seedQty, maxQty);
    if (PD.quantity !== seedQty) setQty(PD.quantity);
  }
  if (sizeRow) {
    var seedSize = sizeRow.querySelector('.size-chip.on');
    PD.size = seedSize ? (seedSize.dataset.size || '') : '';
  }

  /* ---------------- tabs ---------------- */
  var tabBtns = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.remove('on'); });
      document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('on'); });
      this.classList.add('on');
      var panel = document.querySelector('[data-panel="' + this.dataset.tab + '"]');
      if (panel) panel.classList.add('on');
    });
  }

  UI_reveal();
})();