/* AERON — Login & Register pages */
(function () {
  'use strict';

  UI.mountChrome('');

  /* already signed in? straight to account */
  if (Store.currentUser()) { location.replace('account.html'); return; }

  function setErr(input, msg) {
    var field = input.closest('.field');
    var p = field.querySelector('.field-err');
    field.classList.toggle('err', !!msg);
    if (p) { p.hidden = !msg; p.textContent = msg || ''; }
  }

  /* ---------------- login ---------------- */
  var liForm = document.getElementById('loginForm');
  if (liForm) {
    liForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('liEmail');
      var pass = document.getElementById('liPass');
      var global = document.getElementById('liGlobal');
      var ok = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setErr(email, 'Enter a valid email address.'); ok = false; } else setErr(email, '');
      if (!pass.value) { setErr(pass, 'Enter your password.'); ok = false; } else setErr(pass, '');
      if (!ok) return;

      /* block admin accounts on the customer login */
      var u = Store.findUser(email.value.trim());
      if (u && u.role === 'admin') {
        global.textContent = 'This portal is for customers. Admins should use the Admin Portal.';
        return;
      }
      var res = Store.login(email.value.trim(), pass.value);
      if (!res.ok) { global.textContent = res.msg; return; }
      Store.loginUser(res.user.email, document.getElementById('liRemember').checked);
      UI.toast('Welcome back, <b>' + Store.esc(res.user.name.split(' ')[0]) + '</b>!');
      setTimeout(function () { location.href = 'account.html'; }, 450);
    });
  }

  /* ---------------- register ---------------- */
  var rgForm = document.getElementById('regForm');
  if (rgForm) {
    rgForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('rgName');
      var email = document.getElementById('rgEmail');
      var pass = document.getElementById('rgPass');
      var pass2 = document.getElementById('rgPass2');
      var global = document.getElementById('rgGlobal');
      var ok = true;
      if (name.value.trim().length < 2) { setErr(name, 'Enter your name.'); ok = false; } else setErr(name, '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setErr(email, 'Enter a valid email address.'); ok = false; } else setErr(email, '');
      if (pass.value.length < 6) { setErr(pass, 'At least 6 characters.'); ok = false; } else setErr(pass, '');
      if (pass2.value !== pass.value) { setErr(pass2, 'Passwords do not match.'); ok = false; } else setErr(pass2, '');
      if (!ok) return;

      var res = Store.register({ name: name.value.trim(), email: email.value.trim(), pass: pass.value });
      if (!res.ok) { global.textContent = res.msg; return; }
      UI.toast('Account created. Welcome to the club, <b>' + Store.esc(res.user.name.split(' ')[0]) + '</b>!');
      setTimeout(function () { location.href = 'account.html'; }, 450);
    });
  }
})();
