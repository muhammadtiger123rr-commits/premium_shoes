/* AERON — My Orders pages (Django version)
   The order lists are rendered server-side from the database; this file only
   mounts the shared chrome (nav/footer) and triggers the reveal animation. */
(function () {
  'use strict';
  UI.mountChrome('account');
  UI_reveal();
})();