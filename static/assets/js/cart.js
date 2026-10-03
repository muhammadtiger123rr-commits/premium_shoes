/* AERON — Cart page (Django version)
   Cart rows and totals are rendered by Django from the database. The + / −
   steppers post to cart/update/<item_id>/ over AJAX so the quantity, line
   price, summary and header badge can be refreshed without a page reload.
   Without JS the same forms submit normally and Django redirects back. */
(function () {
  'use strict';

  UI.mountChrome('');

  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('truckIcon', 'truck'); ic('bagIcon', 'bag');

  /* -------------------------- quantity (AJAX) -------------------------- */
  function money(n) {
    n = Number(n);
    return (n % 1 === 0) ? String(n) : n.toFixed(2);
  }
  function csrfOf(form) {
    var input = form.querySelector('input[name="csrfmiddlewaretoken"]');
    return (input && input.value) || '';
  }

  var busy = {}; // item id -> true while a request is in flight

  function updateSummary(data) {
    var sub = document.getElementById('sumSub');
    var ship = document.getElementById('sumShip');
    var total = document.getElementById('sumTotal');
    if (sub) sub.textContent = '$' + money(data.subtotal);
    if (ship) ship.textContent = (Number(data.shipping) === 0) ? 'FREE' : '$' + money(data.shipping);
    if (total) total.textContent = '$' + money(data.total);
    /* keep the header badge in sync without a reload */
    if (typeof window.__CART_COUNT === 'number') window.__CART_COUNT = data.cart_count;
    if (UI.updateBadges) UI.updateBadges();
  }

  function showEmptyState() {
    var layout = document.getElementById('cartLayout');
    var holder = document.getElementById('main');
    var shopEl = document.querySelector('.btn-ghost[href]');
    if (!layout || !holder) return;
    layout.remove();
    var wrap = document.createElement('div');
    wrap.className = 'container-wide';
    wrap.id = 'cartEmpty';
    var es = document.createElement('div');
    es.className = 'empty-state';
    var iconEl = document.createElement('span');
    iconEl.id = 'bagIcon';
    iconEl.innerHTML = UI.icon('bag');
    var h = document.createElement('h3');
    h.textContent = 'Your bag is empty';
    var p = document.createElement('p');
    p.textContent = 'Looks like you haven\u2019t added anything yet. Let\u2019s fix that.';
    var a = document.createElement('a');
    a.className = 'btn btn-dark btn-lg';
    a.href = shopEl ? shopEl.getAttribute('href') : '/shop/';
    a.textContent = 'Start Shopping';
    es.appendChild(iconEl); es.appendChild(h); es.appendChild(p); es.appendChild(a);
    wrap.appendChild(es);
    holder.appendChild(wrap);
    if (typeof window.__CART_COUNT === 'number') window.__CART_COUNT = 0;
    if (UI.updateBadges) UI.updateBadges();
  }

  function wireSteppers() {
    var forms = document.querySelectorAll('.qty-stepper form');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('submit', function (e) {
        if (!window.fetch) return; // no fetch -> normal POST fallback
        var row = form.closest('.cart-row');
        var id = row && row.getAttribute('data-id');
        var actionEl = form.elements.action;
        var action = actionEl ? actionEl.value : '';
        if (!row || !id || !action || busy[id]) { e.preventDefault(); return; }

        e.preventDefault();
        busy[id] = true;

        var body = new URLSearchParams();
        body.append('action', action);
        body.append('csrfmiddlewaretoken', csrfOf(form));

        fetch(form.getAttribute('action'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrfOf(form),
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: body.toString()
        }).then(function (res) {
          if (!res.ok) throw new Error('Request failed (' + res.status + ')');
          return res.json();
        }).then(function (data) {
          busy[id] = false;
          if (!data.ok) throw new Error('Server rejected the update.');
          if (data.removed) {
            row.remove();
            if (!document.querySelector('.cart-row')) showEmptyState();
          } else {
            var q = row.querySelector('.cqty');
            if (q && data.quantity != null) q.textContent = data.quantity;
            var pr = row.querySelector('.cr-price');
            if (pr && data.line_total != null) pr.textContent = '$' + money(data.line_total);
          }
          updateSummary(data);
          /* The stepper asked for more units than the product has left, so the
             server left the quantity alone and said why — show that reason. */
          if (data.error) UI.toast(Store.esc(data.error), 'err');
        }).catch(function () {
          busy[id] = false;
          UI.toast('Couldn\u2019t save the new quantity \u2014 please try again.', 'err');
        });
      });
    });
  }

  wireSteppers();

  /* promo code + checkout are handled at checkout — keep the UI, keep it honest */
  var promoBtn = document.getElementById('promoBtn');
  var promoInput = document.getElementById('promoInput');
  var promoMsg = document.getElementById('promoMsg');
  function applyPromo() {
    if (promoMsg) { promoMsg.textContent = 'Promo codes apply at checkout.'; promoMsg.className = 'promo-msg'; }
    UI.toast('Promo codes apply at checkout.', 'info');
  }
  if (promoBtn) promoBtn.addEventListener('click', applyPromo);
  if (promoInput) promoInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
  });

  /* "Proceed to Checkout" is a real link to /checkout/ now — no JS needed. */
})();