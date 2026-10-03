/* AERON — Checkout page */
(function () {
  'use strict';

  UI.mountChrome('');

  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('cardIco', 'card'); ic('cashIco', 'bag'); ic('bagIcon2', 'bag');

  var layout = document.getElementById('coLayout');
  var empty = document.getElementById('coEmpty');
  var success = document.getElementById('successZone');
  var form = document.getElementById('checkoutForm');
  var shipMethod = 'standard';
  var payMethod = 'card';

  function hasItems() { return Store.cart().length > 0; }

  function showEmpty() { layout.style.display = 'none'; empty.style.display = ''; }

  function miniItems() {
    document.getElementById('coItems').innerHTML = Store.cart().map(function (item) {
      var p = Store.product(item.pid);
      if (!p) return '';
      return '<div class="mini-item">' +
        '<img src="' + Store.img(p.img) + '" alt="">' +
        '<span><b>' + Store.esc(p.name) + '</b><br><span class="mi-meta">US ' + Store.esc(item.size) + ' \u00B7 ' + Store.esc(item.color) + ' \u00D7 ' + item.qty + '</span></span>' +
        '<b>' + Store.money((p.sale || p.price) * item.qty) + '</b></div>';
    }).join('');
  }

  function renderSummary() {
    var t = Store.totals(shipMethod);
    document.getElementById('coSub').textContent = Store.money(t.subtotal);
    document.getElementById('coShip').textContent = t.shipping === 0 ? 'FREE' : Store.money(t.shipping);
    var dr = document.getElementById('coDiscRow');
    if (t.discount > 0 && t.promo) {
      dr.style.display = '';
      document.getElementById('coDiscCode').textContent = t.promo.code;
      document.getElementById('coDisc').textContent = '\u2013' + Store.money(t.discount);
    } else dr.style.display = 'none';
    document.getElementById('coTotal').textContent = Store.money(t.total);
    document.getElementById('stdPrice').textContent = (Store.cartSubtotal() >= 150 || (t.promo && t.promo.type === 'freeship')) ? 'FREE' : '$12';
  }

  /* prefill for logged-in user */
  var u = Store.currentUser();
  if (u) {
    document.getElementById('coEmail').value = u.email || '';
    document.getElementById('coPhone').value = u.phone || '';
    var parts = (u.name || '').split(' ');
    document.getElementById('coFirst').value = parts[0] || '';
    document.getElementById('coLast').value = parts.slice(1).join(' ');
    if (u.address) {
      document.getElementById('coAddr').value = u.address.line || '';
      document.getElementById('coCity').value = u.address.city || '';
      document.getElementById('coPostal').value = u.address.postal || '';
      if (u.address.country) document.getElementById('coCountry').value = u.address.country;
    }
  }

  /* shipping / payment selection */
  document.querySelectorAll('.ship-opt').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.ship-opt').forEach(function (x) { x.classList.remove('on'); });
      opt.classList.add('on');
      opt.querySelector('input').checked = true;
      shipMethod = opt.dataset.ship;
      renderSummary();
    });
  });
  document.querySelectorAll('.pay-opt').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.pay-opt').forEach(function (x) { x.classList.remove('on'); });
      opt.classList.add('on');
      opt.querySelector('input').checked = true;
      payMethod = opt.dataset.pay;
      document.getElementById('cardFields').classList.toggle('show', payMethod === 'card');
    });
  });

  /* card number formatting */
  document.getElementById('ccNum').addEventListener('input', function (e) {
    var v = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
  document.getElementById('ccExp').addEventListener('input', function (e) {
    var v = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
  });
  document.getElementById('ccCvc').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '');
  });

  /* promo */
  function applyPromo() {
    var input = document.getElementById('coPromoInput');
    var msg = document.getElementById('coPromoMsg');
    var info = Store.promoInfo(input.value);
    if (info.ok) {
      Store.setActivePromo(info.promo.code);
      UI.toast('Code <b>' + info.promo.code + '</b> applied.');
      renderSummary();
      msg.textContent = info.promo.label + ' \u2713';
      msg.className = 'promo-msg ok';
    } else {
      msg.textContent = info.msg;
      msg.className = 'promo-msg err';
    }
  }
  document.getElementById('coPromoBtn').addEventListener('click', applyPromo);
  document.getElementById('coPromoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });

  /* validation */
  function setErr(input, msg) {
    var field = input.closest('.field');
    var p = field.querySelector('.field-err');
    field.classList.toggle('err', !!msg);
    if (p) { p.hidden = !msg; p.textContent = msg || ''; }
  }
  function val(id, test, msg) {
    var el = document.getElementById(id);
    var v = el.value.trim();
    var bad = test ? !test(v) : !v;
    setErr(el, bad ? msg : '');
    return !bad;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    ok = val('coEmail', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }, 'Enter a valid email address.') && ok;
    ok = val('coPhone', function (v) { return v.replace(/\D/g, '').length >= 7; }, 'Enter a valid phone number.') && ok;
    ok = val('coFirst', null, 'Required.') && ok;
    ok = val('coLast', null, 'Required.') && ok;
    ok = val('coAddr', null, 'Enter your street address.') && ok;
    ok = val('coCity', null, 'Required.') && ok;
    ok = val('coPostal', null, 'Required.') && ok;
    ok = val('coCountry', null, 'Select a country.') && ok;
    if (payMethod === 'card') {
      ok = val('ccNum', function (v) { return v.replace(/\s/g, '').length === 16; }, 'Enter a 16-digit card number.') && ok;
      ok = val('ccName', null, 'Required.') && ok;
      ok = val('ccExp', function (v) { return /^\d{2}\/\d{2}$/.test(v) && +v.slice(0, 2) >= 1 && +v.slice(0, 2) <= 12; }, 'Use MM/YY format.') && ok;
      ok = val('ccCvc', function (v) { return v.length >= 3; }, '3\u20134 digits.') && ok;
    }
    if (!ok) {
      UI.toast('Please fix the highlighted fields.', 'err');
      var firstErr = document.querySelector('.field.err input, .field.err select');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    placeOrder();
  });

  function placeOrder() {
    var t = Store.totals(shipMethod);
    var items = Store.cart().map(function (item) {
      var p = Store.product(item.pid) || {};
      return { pid: item.pid, name: p.name, img: p.img, size: item.size, color: item.color, qty: item.qty, price: p.sale || p.price };
    });
    var order = Store.placeOrder({
      customer: {
        name: document.getElementById('coFirst').value.trim() + ' ' + document.getElementById('coLast').value.trim(),
        email: document.getElementById('coEmail').value.trim(),
        phone: document.getElementById('coPhone').value.trim(),
        address: {
          line: document.getElementById('coAddr').value.trim(),
          city: document.getElementById('coCity').value.trim(),
          postal: document.getElementById('coPostal').value.trim(),
          country: document.getElementById('coCountry').value
        }
      },
      items: items,
      shipMethod: shipMethod,
      payment: payMethod,
      promo: t.promo ? t.promo.code : '',
      subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, total: t.total
    });
    Store.clearCart();
    Store.setActivePromo('');
    UI.updateBadges();
    showSuccess(order);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSuccess(order) {
    layout.style.display = 'none';
    empty.style.display = 'none';
    success.style.display = '';
    success.innerHTML = '<div class="success-wrap">' +
      '<div class="success-check">' + UI.icon('check') + '</div>' +
      '<h1 class="display">Order Confirmed</h1>' +
      '<p style="color:var(--mut)">Thank you, ' + Store.esc(order.customer.name.split(' ')[0]) + '. A confirmation email is on its way to <b>' + Store.esc(order.customer.email) + '</b>.</p>' +
      '<div class="order-no">' + order.number + '</div>' +
      '<div class="success-summary">' +
        order.items.map(function (it) {
          return '<div class="mini-item" style="margin-bottom:10px"><img src="' + Store.img(it.img) + '" alt="">' +
            '<span><b>' + Store.esc(it.name) + '</b><br><span class="mi-meta">US ' + Store.esc(it.size) + ' \u00B7 ' + Store.esc(it.color) + ' \u00D7 ' + it.qty + '</span></span>' +
            '<b>' + Store.money(it.price * it.qty) + '</b></div>';
        }).join('') +
        '<div class="sum-line" style="border-top:1px solid var(--line);margin-top:10px;padding-top:12px"><span>Subtotal</span><b>' + Store.money(order.subtotal) + '</b></div>' +
        '<div class="sum-line"><span>Shipping (' + order.shipMethod + ')</span><b>' + (order.shipping === 0 ? 'FREE' : Store.money(order.shipping)) + '</b></div>' +
        (order.discount ? '<div class="sum-line discount"><span>Discount (' + order.promo + ')</span><b>\u2013' + Store.money(order.discount) + '</b></div>' : '') +
        '<div class="sum-line total"><span>Paid (' + (order.payment === 'cod' ? 'Cash on Delivery' : 'Card') + ')</span><b>' + Store.money(order.total) + '</b></div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
        '<a class="btn btn-dark btn-lg" href="shop.html">Continue Shopping</a>' +
        '<a class="btn btn-ghost btn-lg" href="account.html?tab=orders">View My Orders</a>' +
      '</div>' +
    '</div>';
  }

  if (!hasItems()) showEmpty();
  else { miniItems(); renderSummary(); }
})();
