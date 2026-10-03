/* AERON — Checkout + Order confirmation pages (Django version)
   The order form, prices and order data are rendered by Django from the
   database. This script only mounts the shared chrome and injects the page
   icons the templates reference — nothing about totals is touched here. */
(function () {
  'use strict';

  UI.mountChrome('');

  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('bagIcon', 'bag'); ic('cashIco', 'bag'); ic('truckIcon', 'truck'); ic('okIco', 'check');
})();