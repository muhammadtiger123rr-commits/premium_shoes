/* AERON — Cart page */
(function () {
  'use strict';

  UI.mountChrome('');

  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('truckIcon', 'truck'); ic('bagIcon', 'bag'); ic('bagIcon2', 'bag');

  var itemsEl = document.getElementById('cartItems');

  function render() {
    var cart = Store.cart();
    var layout = document.getElementById('cartLayout');
    var empty = document.getElementById('cartEmpty');

    if (!cart.length) {
      layout.style.display = 'none';
      empty.style.display = '';
      updateBadges();
      return;
    }
    layout.style.display = '';
    empty.style.display = 'none';

    itemsEl.innerHTML = cart.map(function (item, i) {
      var p = Store.product(item.pid);
      if (!p) return '';
      var unit = p.sale || p.price;
      return '<div class="cart-row" data-i="' + i + '">' +
        '<a href="product.html?id=' + p.id + '"><img src="' + Store.img(p.img) + '" alt="' + Store.esc(p.name) + '"></a>' +
        '<div>' +
          '<a class="cr-name" href="product.html?id=' + p.id + '">' + Store.esc(p.name) + '</a>' +
          '<p class="cr-variant">US ' + Store.esc(item.size) + ' \u00B7 ' + Store.esc(item.color) + ' \u00B7 ' + Store.money(unit) + ' each</p>' +
          '<div class="cr-ctrl">' +
            '<div class="qty-stepper">' +
              '<button data-q="-1" aria-label="Decrease">' + UI.icon('minus') + '</button>' +
              '<b>' + item.qty + '</b>' +
              '<button data-q="1" aria-label="Increase">' + UI.icon('plus') + '</button>' +
            '</div>' +
            '<button class="cr-move" data-move>' + UI.icon('heart') + ' Move to wishlist</button>' +
          '</div>' +
        '</div>' +
        '<div class="cr-right">' +
          '<span class="cr-price">' + Store.money(unit * item.qty) + '</span>' +
          '<button class="cr-remove" data-remove>' + UI.icon('trash') + ' Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    renderSummary();
    updateBadges();
  }

  function renderSummary() {
    var t = Store.totals('standard');
    document.getElementById('sumSub').textContent = Store.money(t.subtotal);
    document.getElementById('sumShip').textContent = t.shipping === 0 ? 'FREE' : Store.money(t.shipping);
    var discRow = document.getElementById('sumDiscRow');
    if (t.discount > 0 && t.promo) {
      discRow.style.display = '';
      document.getElementById('sumDiscCode').textContent = t.promo.code;
      document.getElementById('sumDisc').textContent = '\u2013' + Store.money(t.discount);
    } else discRow.style.display = 'none';
    document.getElementById('sumTotal').textContent = Store.money(t.total);

    /* promo zone state */
    var zone = document.getElementById('promoZone');
    if (t.promo) {
      zone.innerHTML = '<div class="promo-applied"><span>' + UI.icon('tag') + ' <b>' + t.promo.code + '</b> \u2014 ' + t.promo.label + '</span>' +
        '<button id="promoRemove">' + UI.icon('x') + '</button></div>';
      var rm = document.getElementById('promoRemove');
      if (rm) rm.addEventListener('click', function () {
        Store.setActivePromo('');
        render();
        UI.toast('Promo code removed.', 'info');
      });
    } else {
      zone.innerHTML = '<div class="promo-row"><input type="text" id="promoInput" placeholder="Promo code">' +
        '<button class="btn btn-dark btn-sm" id="promoBtn">Apply</button></div><p class="promo-msg" id="promoMsg"></p>';
      document.getElementById('promoBtn').addEventListener('click', applyPromo);
      document.getElementById('promoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
    }
  }

  function applyPromo() {
    var input = document.getElementById('promoInput');
    var msg = document.getElementById('promoMsg');
    var info = Store.promoInfo(input.value);
    if (info.ok) {
      Store.setActivePromo(info.promo.code);
      UI.toast('Code <b>' + info.promo.code + '</b> applied.');
      render();
    } else {
      msg.textContent = info.msg;
      msg.className = 'promo-msg err';
    }
  }

  function updateBadges() { UI.updateBadges(); }

  /* delegated actions */
  itemsEl.addEventListener('click', function (e) {
    var row = e.target.closest('.cart-row');
    if (!row) return;
    var i = +row.dataset.i;

    var q = e.target.closest('[data-q]');
    if (q) {
      var cart = Store.cart();
      var next = cart[i].qty + (+q.dataset.q);
      if (next < 1) { removeAt(i, row); } else { Store.updateCartQty(i, next); render(); }
      return;
    }
    if (e.target.closest('[data-remove]')) { removeAt(i, row); return; }
    if (e.target.closest('[data-move]')) {
      var cart2 = Store.cart();
      var item = cart2[i];
      Store.toggleWishlist(item.pid);
      if (!Store.inWishlist(item.pid)) Store.toggleWishlist(item.pid); // ensure added
      Store.removeCart(i);
      row.classList.add('removing');
      setTimeout(function () { render(); }, 280);
      UI.toast('Moved to your wishlist.');
      return;
    }
  });

  function removeAt(i, row) {
    row.classList.add('removing');
    setTimeout(function () { Store.removeCart(i); render(); UI.toast('Removed from your bag.', 'info'); }, 280);
  }

  document.getElementById('clearCart').addEventListener('click', function () {
    if (!Store.cart().length) return;
    Store.clearCart();
    render();
    UI.toast('Bag cleared.', 'info');
  });

  render();
})();
