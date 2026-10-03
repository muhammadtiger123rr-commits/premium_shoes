/* AERON — Account page */
(function () {
  'use strict';

  UI.mountChrome('');

  var user = Store.currentUser();
  var params = new URLSearchParams(location.search);
  var tab = params.get('tab') || 'profile';
  var nav = document.getElementById('acctNav');
  var panel = document.getElementById('acctPanel');

  /* wishlist tab is allowed without login (device-local) */
  if (!user && tab !== 'wishlist') {
    location.replace('login.html');
    return;
  }

  document.getElementById('acctTitle').textContent = user ? 'Hey, ' + user.name.split(' ')[0] : 'Your Wishlist';

  function avatarHTML() {
    if (!user) return '';
    var initials = user.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    return '<div class="acct-user"><div class="avatar">' + initials + '</div><div><b>' + Store.esc(user.name) + '</b><span>' + Store.esc(user.email) + '</span></div></div>';
  }

  var links = [];
  if (user) {
    links = [
      ['profile', 'user', 'Profile'],
      ['orders', 'box', 'Order History'],
      ['wishlist', 'heart', 'Wishlist']
    ];
  } else {
    links = [['wishlist', 'heart', 'Wishlist']];
  }
  nav.innerHTML = avatarHTML() +
    links.map(function (l) {
      return '<a href="account.html?tab=' + l[0] + '"' + (tab === l[0] ? ' class="on"' : '') + '>' + UI.icon(l[1]) + ' ' + l[2] + '</a>';
    }).join('') +
    (user ? '<button id="logoutBtn">' + UI.icon('logout') + ' Log Out</button>' :
      '<a href="login.html">' + UI.icon('user') + ' Sign In</a>');

  var lb = document.getElementById('logoutBtn');
  if (lb) lb.addEventListener('click', function () {
    Store.logoutUser();
    UI.toast('You\u2019ve been signed out.', 'info');
    setTimeout(function () { location.href = 'index.html'; }, 400);
  });

  /* ---------------- profile tab ---------------- */
  function renderProfile() {
    panel.innerHTML = '<h2 class="display">Profile</h2>' +
      '<form id="profileForm" style="max-width:560px">' +
        '<div class="field"><label>Full name</label><input id="pfName" value="' + Store.esc(user.name) + '"></div>' +
        '<div class="field"><label>Email</label><input id="pfEmail" value="' + Store.esc(user.email) + '" disabled style="background:var(--bg)"></div>' +
        '<div class="field"><label>Phone</label><input id="pfPhone" value="' + Store.esc(user.phone || '') + '" placeholder="+92 300 1234567"></div>' +
        '<div class="field"><label>Address</label><input id="pfAddr" value="' + Store.esc(user.address.line || '') + '" placeholder="Street address"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>City</label><input id="pfCity" value="' + Store.esc(user.address.city || '') + '"></div>' +
          '<div class="field"><label>Postal code</label><input id="pfPostal" value="' + Store.esc(user.address.postal || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>Country</label><input id="pfCountry" value="' + Store.esc(user.address.country || '') + '"></div>' +
        '<button class="btn btn-dark" type="submit">Save Changes</button>' +
        '<p style="margin-top:14px;font-size:12.5px;color:var(--mut)">Member since ' + new Date(user.joined).toLocaleDateString() + '</p>' +
      '</form>';
    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      user.name = document.getElementById('pfName').value.trim() || user.name;
      user.phone = document.getElementById('pfPhone').value.trim();
      user.address = {
        line: document.getElementById('pfAddr').value.trim(),
        city: document.getElementById('pfCity').value.trim(),
        postal: document.getElementById('pfPostal').value.trim(),
        country: document.getElementById('pfCountry').value.trim()
      };
      Store.updateUser(user);
      UI.toast('Profile updated.');
      renderNav();
    });
  }
  function renderNav() {
    nav.innerHTML = avatarHTML() + nav.innerHTML.replace(/^<div class="acct-user">[\s\S]*?<\/div><\/div>/, '');
  }

  /* ---------------- orders tab ---------------- */
  function renderOrders() {
    var orders = Store.ordersFor(user.email);
    if (!orders.length) {
      panel.innerHTML = '<h2 class="display">Order History</h2><div class="empty-state">' + UI.icon('box') +
        '<h3>No orders yet</h3><p>When you place an order, it will show up here.</p>' +
        '<a class="btn btn-dark" href="shop.html">Start Shopping</a></div>';
      return;
    }
    panel.innerHTML = '<h2 class="display">Order History</h2>' + orders.map(function (o) {
      return '<div class="order-card">' +
        '<div class="order-head" data-toggle>' +
          '<b>' + o.number + '</b>' +
          '<span class="oh-meta">' + new Date(o.ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
          ' \u00B7 ' + o.items.length + ' item(s)</span>' +
          '<span class="status-badge ' + Store.statusClass(o.status) + '">' + o.status + '</span>' +
          '<span class="order-total">' + Store.money(o.total) + '</span>' +
          UI.icon('chevD') +
        '</div>' +
        '<div class="order-body"><div class="order-body-in" style="padding-top:16px">' +
          o.items.map(function (it) {
            return '<div class="mini-item" style="margin-bottom:10px"><img src="' + Store.img(it.img) + '" alt="">' +
              '<span><b>' + Store.esc(it.name) + '</b><br><span class="mi-meta">US ' + Store.esc(it.size) + ' \u00B7 ' + Store.esc(it.color) + ' \u00D7 ' + it.qty + '</span></span>' +
              '<b>' + Store.money(it.price * it.qty) + '</b></div>';
          }).join('') +
          '<p style="font-size:12.5px;color:var(--mut)">Ships to: ' + Store.esc(o.customer.address.line) + ', ' + Store.esc(o.customer.address.city) + ', ' + Store.esc(o.customer.address.country) + '</p>' +
        '</div></div>' +
      '</div>';
    }).join('');
    panel.querySelectorAll('[data-toggle]').forEach(function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('open'); });
    });
  }

  /* ---------------- wishlist tab ---------------- */
  function renderWishlist() {
    var ids = Store.wishlist();
    var products = ids.map(function (id) { return Store.product(id); }).filter(Boolean);
    var head = '<h2 class="display">Wishlist</h2>';
    var loginCta = !user ? '<div class="demo-hint" style="margin-bottom:20px">You\u2019re browsing as a guest — <a href="login.html" style="font-weight:700">sign in</a> to keep your wishlist with your account.</div>' : '';
    if (!products.length) {
      panel.innerHTML = head + loginCta + '<div class="empty-state">' + UI.icon('heart') +
        '<h3>Your wishlist is empty</h3><p>Tap the heart on any product to save it here.</p>' +
        '<a class="btn btn-dark" href="shop.html">Discover Shoes</a></div>';
      return;
    }
    panel.innerHTML = head + loginCta + '<div class="grid-products">' +
      products.map(function (p) { return UI.cardHTML(p, false); }).join('') + '</div>';
    UI_reveal(panel);
  }

  if (tab === 'orders' && user) renderOrders();
  else if (tab === 'wishlist') renderWishlist();
  else if (user) renderProfile();
})();
