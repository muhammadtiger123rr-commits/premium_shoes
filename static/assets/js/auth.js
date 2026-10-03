/* AERON — Login & Register pages (Django version)
   Forms are submitted to Django (server-side auth). This script keeps the
   chrome, preloader and small UI helpers but does NOT hijack the forms. */
(function () {
  'use strict';

  UI.mountChrome('');

  /* keep the "err" styling in sync when a field gets corrected,
     while still letting the server handle + display validation */
  function setErr(input, msg) {
    var field = input.closest('.field');
    var p = field.querySelector('.field-err');
    field.classList.toggle('err', !!msg);
    if (p) { p.hidden = !msg; p.textContent = msg || ''; }
  }

  ['rgName', 'rgUser', 'rgEmail', 'rgPass', 'rgPass2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { setErr(el, ''); });
  });
  ['liEmail', 'liPass'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { setErr(el, ''); });
  });

  /* Show/hide password. The button only flips the input's type and its own
     aria-pressed (CSS swaps the two eye glyphs) - the field keeps its name,
     its value and its place in the form, so nothing about how the form is
     validated or submitted changes. */
  document.querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
    var input = document.getElementById(btn.dataset.pwToggle);
    if (!input) return;
    btn.addEventListener('click', function () {
      var reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });
  });
})();
