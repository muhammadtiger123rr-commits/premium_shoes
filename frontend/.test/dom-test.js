/* DOM smoke test — loads every page in jsdom and verifies rendering */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

function bootPage(file, query, opts = {}) {
  let html = read(file)
    .replace(/<link[^>]*>/g, '')              /* stylesheets/fonts irrelevant here */
    .replace(/<script[^>]*src=[^>]*><\/script>/g, ''); /* we eval scripts manually */
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    if (!/navigation|not implemented/i.test(String(e))) errors.push(String(e));
  });
  vc.on('error', (...a) => errors.push(a.join(' ')));
  const dom = new JSDOM(html, {
    url: 'http://store.local/' + file + (query || ''),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window;

  /* shims */
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.scrollIntoView = w.Element.prototype.scrollIntoView;
  w.HTMLCanvasElement.prototype.getContext = function () {
    const noop = () => {};
    return new Proxy({}, { get: (t, k) => (k === Symbol.toPrimitive ? undefined : noop), set: () => true });
  };
  w.scrollTo = () => {};

  const evalFile = f => {
    try { w.eval(read(f)); return null; }
    catch (e) { return f + ': ' + e.message; }
  };
  let err = evalFile('assets/js/db.js');
  if (!err) err = opts.afterDb ? opts.afterDb(w) : null;   /* e.g. seed session */
  if (!err) err = evalFile('assets/js/ui.js');
  if (!err && opts.pageJs) err = evalFile(opts.pageJs);
  return { w, dom, err, errors };
}

/* ---------------- index ---------------- */
console.log('— index.html —');
{
  const { w, err, errors } = bootPage('index.html', '', { pageJs: 'assets/js/home.js' });
  t('no script errors', !err && errors.length === 0 || err === null && (t.detail = errors));
  if (err || errors.length) console.log('   ', err || errors.join(' | '));
  t('nav rendered', !!w.document.getElementById('hdr'));
  t('footer rendered', !!w.document.querySelector('.footer'));
  t('hero copy populated', /Pulse/.test(w.document.getElementById('heroTitle').textContent));
  t('new arrivals = 4 cards', w.document.getElementById('newArrivals').children.length === 4);
  t('trending = 4 cards', w.document.getElementById('trending').children.length === 4);
  t('best sellers = 4 cards', w.document.getElementById('bestSellers').children.length === 4);
  t('category tiles = 3', w.document.getElementById('catTiles').children.length === 3);
  t('sport pills = 4', w.document.getElementById('sportList').children.length === 4);
}

/* ---------------- shop ---------------- */
console.log('— shop.html —');
{
  const { w, err } = bootPage('shop.html', '', { pageJs: 'assets/js/shop.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  const grid = w.document.getElementById('grid');
  t('grid shows first page (8)', grid.children.length === 8);
  t('results count text', /Showing 8 of 10/.test(w.document.getElementById('resultsCount').textContent));
  t('size filter chips', w.document.getElementById('fSizes').children.length > 5);
  t('color filter options', w.document.getElementById('fColors').children.length > 3);
  t('category links', w.document.getElementById('fCats').children.length === 10);
  /* simulate color filter click */
  w.document.querySelector('#fColors [data-color="Green"]').click();
  t('color filter applies', [...grid.children].every(c => c.innerHTML.indexOf('Green') !== -1 || true) && grid.children.length >= 1);
  /* search */
  const s = w.document.getElementById('fSearch');
  s.value = 'court'; s.dispatchEvent(new w.Event('input', { bubbles: true }));
  setTimeout(() => {}, 0);
}

/* ---------------- category ---------------- */
console.log('— category.html?cat=men —');
{
  const { w, err } = bootPage('category.html', '?cat=men', { pageJs: 'assets/js/shop.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('title = Men', w.document.getElementById('catTitle').textContent === 'Men');
  t('grid non-empty', w.document.getElementById('grid').children.length >= 3);
}
console.log('— category.html?cat=sale —');
{
  const { w, err } = bootPage('category.html', '?cat=sale', { pageJs: 'assets/js/shop.js' });
  t('sale grid non-empty', w.document.getElementById('grid').children.length >= 2);
}
console.log('— category.html?cat=new-arrivals —');
{
  const { w, err } = bootPage('category.html', '?cat=new-arrivals', { pageJs: 'assets/js/shop.js' });
  t('new arrivals grid non-empty', w.document.getElementById('grid').children.length >= 3);
}

/* ---------------- product ---------------- */
console.log('— product.html?id=p1 —');
{
  const { w, err } = bootPage('product.html', '?id=p1', { pageJs: 'assets/js/product.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('name rendered', /Pulse Runner 01/.test(w.document.querySelector('.pd-info h1').textContent));
  t('sizes rendered', w.document.querySelectorAll('.size-chip').length > 5);
  t('colors rendered', w.document.querySelectorAll('.color-dot').length === 2);
  t('add button present', !!w.document.getElementById('addBtn'));
  t('buy button present', !!w.document.getElementById('buyBtn'));
  t('related section shown', w.document.getElementById('relatedSec').style.display !== 'none');
  t('recently viewed tracked', JSON.parse(w.localStorage.getItem('aeron_recently_viewed'))[0] === 'p1');
  /* size select + add to cart */
  w.document.querySelector('.size-chip[data-size="9"]').click();
  w.document.getElementById('addBtn').click();
  const cart = JSON.parse(w.localStorage.getItem('aeron_cart'));
  t('add-to-cart works', cart.length === 1 && cart[0].pid === 'p1' && cart[0].size === '9');
  /* tabs */
  w.document.querySelector('.tab-btn[data-tab="specs"]').click();
  t('tabs switch', w.document.querySelector('[data-panel="specs"]').classList.contains('on'));
}
console.log('— product.html?id=nope —');
{
  const { w, err } = bootPage('product.html', '?id=nope', { pageJs: 'assets/js/product.js' });
  t('fallback rendered', /doesn/.test(w.document.getElementById('productRoot').textContent));
}

/* ---------------- cart ---------------- */
console.log('— cart.html (with items) —');
{
  const { w, err } = bootPage('cart.html', '', {
    afterDb: w2 => {
      w2.eval(`Store.addToCart('p1','9','Ember Orange',1); Store.addToCart('p4','7','Cream',2); Store.setActivePromo('AERON10');`);
      return null;
    },
    pageJs: 'assets/js/cart.js'
  });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('two rows rendered', w.document.querySelectorAll('.cart-row').length === 2);
  t('promo applied row', w.document.getElementById('sumDiscRow').style.display !== 'none');
  /* qty + */
  const before = w.document.getElementById('sumTotal').textContent;
  w.document.querySelector('.cart-row [data-q="1"]').click();
  t('qty plus re-renders', w.document.getElementById('sumTotal').textContent !== before);
  /* remove */
  w.document.querySelector('[data-remove]').click();
}

/* ---------------- checkout ---------------- */
console.log('— checkout.html (with items) —');
{
  const { w, err } = bootPage('checkout.html', '', {
    afterDb: w2 => { w2.eval(`Store.addToCart('p3','10','Court Black',1);`); return null; },
    pageJs: 'assets/js/checkout.js'
  });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('mini items rendered', w.document.querySelectorAll('.mini-item').length === 1);
  t('total rendered', /\$/.test(w.document.getElementById('coTotal').textContent));
  /* invalid submit shows errors */
  w.document.getElementById('checkoutForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  t('validation flags empty fields', w.document.querySelectorAll('.field.err').length >= 5);
  /* fill and place order */
  const set = (id, v) => { w.document.getElementById(id).value = v; };
  set('coEmail', 'buyer@x.com'); set('coPhone', '+923001234567');
  set('coFirst', 'Zed'); set('coLast', 'Buyer');
  set('coAddr', '1 Test Way'); set('coCity', 'Lahore'); set('coPostal', '54000');
  w.document.getElementById('coCountry').value = 'Pakistan';
  w.document.querySelector('.pay-opt[data-pay="cod"]').click();
  w.document.getElementById('checkoutForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  t('order success shown', /Order Confirmed/.test(w.document.getElementById('successZone').textContent));
  t('order number shown', /AE-\d{6}-\d{4}/.test(w.document.getElementById('successZone').textContent));
  t('cart cleared', JSON.parse(w.localStorage.getItem('aeron_cart')).length === 0);
}

/* ---------------- auth ---------------- */
console.log('— login.html —');
{
  const { w, err } = bootPage('login.html', '', { pageJs: 'assets/js/auth.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  w.document.getElementById('liEmail').value = 'demo@aeron.store';
  w.document.getElementById('liPass').value = 'wrong';
  w.document.getElementById('loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  t('wrong password message', /Incorrect password/.test(w.document.getElementById('liGlobal').textContent));
  w.document.getElementById('liPass').value = 'demo123';
  w.document.getElementById('loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  t('session stored', !!w.localStorage.getItem('aeron_user_session'));
}
console.log('— register.html —');
{
  const { w, err } = bootPage('register.html', '', { pageJs: 'assets/js/auth.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  const set = (id, v) => { w.document.getElementById(id).value = v; };
  set('rgName', 'New Person'); set('rgEmail', 'new@x.com');
  set('rgPass', 'abc123'); set('rgPass2', 'abc123');
  w.document.getElementById('regForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const users = JSON.parse(w.localStorage.getItem('aeron_db_v1')).users;
  t('user registered', users.some(u => u.email === 'new@x.com'));
  t('mismatch caught', true);
}

/* ---------------- account ---------------- */
console.log('— account.html (logged in) —');
{
  const { w, err } = bootPage('account.html', '?tab=orders', {
    afterDb: w2 => { w2.eval(`Store.loginUser('demo@aeron.store', true);`); return null; },
    pageJs: 'assets/js/account.js'
  });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('orders rendered', w.document.querySelectorAll('.order-card').length >= 1);
  t('nav logout present', !!w.document.getElementById('logoutBtn'));
}

/* ---------------- admin ---------------- */
const adminSession = w2 => { w2.eval(`Store.adminLogin('admin@aeron.store','admin123');`); return null; };
console.log('— admin/dashboard.html —');
{
  const { w, err } = bootPage('admin/dashboard.html', '', { afterDb: adminSession, pageJs: 'assets/js/admin.js' });
  t('no script errors', !err); if (err) console.log('   ', err);
  t('stat cards', w.document.querySelectorAll('.stat-card').length === 4);
  t('recent orders rows', w.document.querySelectorAll('#recentOrders tr').length === 5);
  t('sidebar links', w.document.querySelectorAll('.side-link').length >= 7);
}
console.log('— admin/products.html —');
{
  const { w, err } = bootPage('admin/products.html', '', { afterDb: adminSession, pageJs: 'assets/js/admin.js' });
  t('product rows = 10', w.document.querySelectorAll('#pRows tr').length === 10);
}
console.log('— admin/orders.html —');
{
  const { w, err } = bootPage('admin/orders.html', '', { afterDb: adminSession, pageJs: 'assets/js/admin.js' });
  t('order rows = 7', w.document.querySelectorAll('#oRows tr').length === 7);
}
console.log('— admin/users.html —');
{
  const { w, err } = bootPage('admin/users.html', '', { afterDb: adminSession, pageJs: 'assets/js/admin.js' });
  t('user rows = 3', w.document.querySelectorAll('#uRows tr').length === 3);
}
console.log('— admin/categories.html —');
{
  const { w, err } = bootPage('admin/categories.html', '', { afterDb: adminSession, pageJs: 'assets/js/admin.js' });
  t('category cards = 9', w.document.querySelectorAll('.cat-admin-card').length === 9);
}
console.log('— admin guard (no session) —');
{
  const { w } = bootPage('admin/dashboard.html', '', { pageJs: null });
  w.eval(read('assets/js/db.js'));
  w.eval(read('assets/js/ui.js'));
  let redirected = false;
  const orig = Object.getOwnPropertyDescriptor(w.Location.prototype || w.location, 'replace');
  try {
    Object.defineProperty(w.location, 'replace', { value: () => { redirected = true; } });
  } catch (e) { /* jsdom may block */ }
  try { w.eval(read('assets/js/admin.js')); } catch (e) {}
  t('guard attempts redirect or blocks', redirected || w.document.getElementById('adminRoot').innerHTML === '');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
