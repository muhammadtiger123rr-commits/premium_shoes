/* AERON — Home page (Django version)
   Hero, sections, categories and cards are rendered by Django from the database.
   This script keeps the original interactions: icons, marquee loop,
   newsletter, parallax and scroll-reveal animations. */
(function () {
  'use strict';

  UI.mountChrome('home');

  /* ---------- icons injected into static markup ---------- */
  function ic(id, name) { var el = document.getElementById(id); if (el) el.innerHTML = UI.icon(name); }
  ic('tagIcon', 'spark'); ic('tagIcon2', 'shield');
  ic('arrowNew', 'arrowR'); ic('arrowTrend', 'arrowR'); ic('arrowBest', 'arrowR');

  /* ---------- marquee (duplicate for seamless loop) ---------- */
  var track = document.getElementById('marqueeTrack');
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- newsletter ---------- */
  var form = document.getElementById('newsForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('newsEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { UI.toast('Please enter a valid email address.', 'err'); return; }
      Store.subscribe(email);
      form.innerHTML = '<p class="news-success" style="margin:10px auto">' + UI.icon('check') + ' You\u2019re on the list. Welcome to the club.</p>';
      UI.toast('Subscribed! Watch your inbox for early access.');
    });
  }

  /* ---------- hero parallax ---------- */
  var shoe = document.getElementById('heroShoe');
  var hero = document.querySelector('.hero');
  if (shoe && window.matchMedia('(pointer: fine)').matches && hero) {
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      shoe.style.translate = (dx * -16) + 'px ' + (dy * -12) + 'px';
    });
    hero.addEventListener('mouseleave', function () { shoe.style.translate = '0 0'; });
  }
  /* subtle scroll parallax on blob */
  var blob = document.querySelector('[data-parallax]');
  if (blob) {
    window.addEventListener('scroll', function () {
      blob.style.transform = 'translateY(' + window.scrollY * parseFloat(blob.dataset.parallax) + 'px)';
    }, { passive: true });
  }

  /* star rating fill widths — applied here so the inline style attribute stays valid CSS */
  document.querySelectorAll('.stars-fg').forEach(function (el) {
    el.style.width = (el.dataset.fill || '0') + '%';
  });

  UI_reveal();
})();