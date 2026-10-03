/* AERON — Account page (Django version)
   Login is enforced by the server. The user object comes from Django
   (window.__USER) instead of browser localStorage. */
(function () {
  'use strict';

  UI.mountChrome('');

  var user = window.__USER || null;
  var url = window.__URLS || {};
  var params = new URLSearchParams(location.search);
  var tab = params.get('tab') || 'profile';
  var nav = document.getElementById('acctNav');
  var panel = document.getElementById('acctPanel');

  document.getElementById('acctTitle').textContent = user ? 'Hey, ' + user.name.split(' ')[0] : 'Your Wishlist';

  function avatarHTML() {
    if (!user) return '';
    var initials = user.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    return '<div class="acct-user"><div class="avatar">' + initials + '</div><div><b>' + Store.esc(user.name) + '</b><span>' + Store.esc(user.email) + '</span></div></div>';
  }

  var links = [
    ['profile', 'user', 'Profile'],
    ['orders', 'box', 'Order History'],
    ['wishlist', 'heart', 'Wishlist']
  ];

  nav.innerHTML = avatarHTML() +
    links.map(function (l) {
      var href = (l[0] === 'orders') ? url.orders : (l[0] === 'wishlist') ? url.wishlist : (url.account + '?tab=' + l[0]);
      return '<a href="' + href + '"' + (tab === l[0] ? ' class="on"' : '') + '>' + UI.icon(l[1]) + ' ' + l[2] + '</a>';
    }).join('') +
    '<button id="logoutBtn">' + UI.icon('logout') + ' Log Out</button>';

  var lb = document.getElementById('logoutBtn');
  if (lb) lb.addEventListener('click', function () {
    location.href = url.logout;
  });

  /* ---------------- profile tab ---------------- */
  function renderProfile() {
    panel.innerHTML = '<h2 class="display">Profile</h2>' +
      '<form id="profileForm" method="post" action="' + url.profile + '" style="max-width:560px">' +
        '<input type="hidden" name="csrfmiddlewaretoken" value="' + window.__CSRF + '">' +
        '<div class="field"><label>Full name</label><input id="pfName" value="' + Store.esc(user.name) + '" disabled style="background:var(--bg)"></div>' +
        '<div class="field"><label>Username</label><input id="pfUsername" value="' + Store.esc(user.username) + '" disabled style="background:var(--bg)"></div>' +
        '<div class="field"><label>Email</label><input id="pfEmail" value="' + Store.esc(user.email) + '" disabled style="background:var(--bg)"></div>' +
        '<div class="field"><label>Phone</label><input name="phone" id="pfPhone" value="' + Store.esc(user.phone || '') + '" placeholder="+92 300 1234567"></div>' +
        '<div class="field"><label>Address</label><input name="address" id="pfAddr" value="' + Store.esc(user.address || '') + '" placeholder="Street address"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>City</label><input name="city" id="pfCity" value="' + Store.esc(user.city || '') + '"></div>' +
          '<div class="field"><label>Postal code</label><input name="postal_code" id="pfPostal" value="' + Store.esc(user.postal_code || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>Country</label><input name="country" id="pfCountry" value="' + Store.esc(user.country || '') + '"></div>' +
        '<button class="btn btn-dark" type="submit">Save Changes</button>' +
        '<p style="margin-top:14px;font-size:12.5px;color:var(--mut)">Member since ' + new Date(user.joined).toLocaleDateString() + '</p>' +
      '</form>';
  }

  /* Wishlists and order history are DB-backed now — send the customer to
     the real pages instead of the old localStorage tabs. */
  if (tab === 'orders') window.location.href = url.orders;
  else if (tab === 'wishlist') window.location.href = url.wishlist;
  else renderProfile();

  /* confirmation after a successful profile save */
  if (params.get('saved') === '1') {
    UI.toast('Profile updated.');
  }
})();