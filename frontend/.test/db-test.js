/* Headless smoke test for the AERON data layer */
const fs = require('fs');
const path = require('path');

/* ---- browser shims ---- */
const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
global.sessionStorage = global.localStorage;
global.location = { pathname: '/home/user/index.html', search: '', href: '' };
global.window = global;
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };

/* ---- load db.js ---- */
eval(fs.readFileSync(path.join(__dirname, '../assets/js/db.js'), 'utf8'));

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

console.log('— catalog —');
t('seeded 10 products', Store.products().length === 10);
t('product p1 exists', !!Store.product('p1'));
t('9 categories', Store.categories().length === 9);
t('men category has products', Store.productsInCategory('men').length >= 3);
t('sale category only discounted', Store.productsInCategory('sale').every(p => p.sale && p.sale < p.price));
t('new-arrivals only isNew', Store.productsInCategory('new-arrivals').every(p => p.isNew));

console.log('— cart —');
Store.addToCart('p1', '9', 'Ember Orange', 1);
Store.addToCart('p1', '9', 'Ember Orange', 2);
t('merges same line', Store.cart().length === 1 && Store.cart()[0].qty === 3);
Store.addToCart('p3', '10', 'Court Black', 1);
t('subtotal sums correctly', Store.cartSubtotal() === 189 * 3 + 199);
Store.updateCartQty(0, 1);
t('qty update works', Store.cart()[0].qty === 1);
Store.removeCart(1);
t('remove works', Store.cart().length === 1);

console.log('— promos & totals —');
t('invalid promo rejected', Store.promoInfo('NOPE').ok === false);
t('AERON10 accepted', Store.promoInfo('AERON10').ok === true);
t('CLUB15 needs $200 min', Store.promoInfo('CLUB15').ok === false); // subtotal 189
Store.setActivePromo('AERON10');
let tot = Store.totals('standard');
t('10% discount applied', Math.abs(tot.discount - 18.9) < 0.001);
t('shipping free over $150', tot.shipping === 0);
t('total math', Math.abs(tot.total - (189 - 18.9)) < 0.001);
tot = Store.totals('express');
t('express shipping $25', tot.shipping === 25);
Store.setActivePromo('');

console.log('— wishlist —');
t('toggle on', Store.toggleWishlist('p2') === true);
t('in wishlist', Store.inWishlist('p2'));
t('toggle off', Store.toggleWishlist('p2') === false);

console.log('— auth —');
let reg = Store.register({ name: 'Test User', email: 'test@x.com', pass: 'secret1' });
t('register ok', reg.ok);
t('duplicate rejected', Store.register({ name: 'T2', email: 'test@x.com', pass: 'abc123' }).ok === false);
t('login wrong pass fails', Store.login('test@x.com', 'wrong').ok === false);
t('login ok', Store.login('test@x.com', 'secret1').ok);
Store.loginUser('test@x.com', true);
t('session user', Store.currentUser().email === 'test@x.com');
Store.logoutUser();
t('logout clears', !Store.currentUser());

console.log('— admin auth —');
t('admin rejects customer creds', Store.adminLogin('test@x.com', 'secret1').ok === false);
t('admin rejects wrong pass', Store.adminLogin('admin@aeron.store', 'x').ok === false);
t('admin login ok', Store.adminLogin('admin@aeron.store', 'admin123').ok);
t('current admin', Store.currentAdmin().role === 'admin');
Store.adminLogout();

console.log('— orders —');
Store.clearCart();
Store.addToCart('p2', '6', 'Ivory', 1);
let t2 = Store.totals('standard');
let order = Store.placeOrder({
  customer: { name: 'Test User', email: 'test@x.com', phone: '123', address: { line: 'a', city: 'b', postal: 'c', country: 'd' } },
  items: [{ pid: 'p2', name: 'Meridian Knit', img: 'assets/images/products/p2.png', size: '6', color: 'Ivory', qty: 1, price: 149 }],
  shipMethod: 'standard', payment: 'cod', promo: '', subtotal: t2.subtotal, discount: 0, shipping: t2.shipping, total: t2.total
});
t('order number format', /^AE-\d{6}-\d{4}$/.test(order.number));
t('order stored first', Store.orders()[0].id === order.id);
t('ordersFor finds it', Store.ordersFor('test@x.com').length === 1);
Store.updateOrderStatus(order.id, 'Shipped');
t('status update', Store.orders().find(o => o.id === order.id).status === 'Shipped');

console.log('— mutations —');
let np = Store.saveProduct({ name: 'Test Shoe', sport: 'running', gender: 'men', price: 100, sale: null, stock: 5, colors: [{ name: 'X', hex: '#000', fam: 'Black' }], sizes: ['9'], img: '' });
t('saveProduct adds', !!Store.product(np.id));
np.price = 120; Store.saveProduct(np);
t('saveProduct updates', Store.product(np.id).price === 120);
Store.addToCart(np.id, '9', 'X', 1);
Store.deleteProduct(np.id);
t('deleteProduct scrubs cart', Store.cart().every(i => i.pid !== np.id));
Store.saveCategory({ slug: 'testcat', name: 'Test Cat', desc: '', image: '' });
t('saveCategory adds', !!Store.category('testcat'));
Store.deleteCategory('testcat');
t('deleteCategory', !Store.category('testcat'));

console.log('— persistence —');
t('db persisted to localStorage', JSON.parse(mem['aeron_db_v1']).products.length === 10);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
