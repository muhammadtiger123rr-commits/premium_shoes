/* AERON — Wishlist page (Django version)
   The saved products are rendered server-side from the database; this file
   only mounts the shared chrome (nav/footer) and triggers the reveal
   animation. Removing a row is handled by the shared delegated "wish" action
   in ui.js, which posts to the toggle endpoint and crosses the row out. */
(function () {
  'use strict';
  UI.mountChrome('account');
  UI_reveal();
})();