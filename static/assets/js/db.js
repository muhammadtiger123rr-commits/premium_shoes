/* =====================================================================
   AERON — Central data layer
   Single source of truth for the storefront + admin. Everything is
   persisted to localStorage so both sides stay in sync automatically.
   ===================================================================== */
(function (global) {
  'use strict';

  var SEED_VERSION = 1;
  var IS_ADMIN = location.pathname.indexOf('/admin/') !== -1;

  var K = {
    db:     'aeron_db_v' + SEED_VERSION,
    cart:   'aeron_cart',
    wish:   'aeron_wishlist',
    user:   'aeron_user_session',
    admin:  'aeron_admin_session',
    recent: 'aeron_recently_viewed',
    promo:  'aeron_promo_code',
    news:   'aeron_newsletter'
  };

  /* ----------------------------- helpers ----------------------------- */
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function money(n) {
    if (n == null || isNaN(n)) n = 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(n);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function daysAgo(n) { return Date.now() - n * 86400000; }

  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
    '<rect width="600" height="600" fill="#eceae4"/>' +
    '<text x="300" y="310" font-family="Arial" font-size="34" fill="#b9b5ab" text-anchor="middle">AERON</text></svg>'
  );

  /* ------------------------------ seed ------------------------------- */
  var ADULT_SIZES = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
  var KID_SIZES   = ['1Y', '2Y', '3Y', '4Y', '5Y', '6Y'];

  function seed() {
    var products = [
      {
        id: 'p1', name: 'Pulse Runner 01', sport: 'running', gender: 'men',
        price: 189, sale: null, stock: 24, featured: true, isNew: true,
        rating: 4.9, reviews: 214, img: 'assets/images/products/p1.png', imgHover: 'assets/images/products/p1-alt.png',
        colors: [
          { name: 'Ember Orange', hex: '#ff4d1c', fam: 'Orange' },
          { name: 'Core Black', hex: '#1b1b1e', fam: 'Black' }
        ],
        sizes: ADULT_SIZES.slice(),
        desc: 'Our flagship daily trainer. A Cloudform foam midsole is tuned with a carbon-composite plate for a snappy, rolling stride, while the AeroWeave upper keeps weight below 240 grams.',
        specs: { weight: '238 g', drop: '8 mm', upper: 'AeroWeave engineered mesh', midsole: 'Cloudform foam + composite plate' }
      },
      {
        id: 'p2', name: 'Meridian Knit', sport: 'casual', gender: 'women',
        price: 149, sale: null, stock: 18, featured: false, isNew: true,
        rating: 4.7, reviews: 162, img: 'assets/images/products/p2.png', imgHover: '',
        colors: [
          { name: 'Ivory', hex: '#ece7dd', fam: 'White' },
          { name: 'Sage', hex: '#a9b8a0', fam: 'Green' }
        ],
        sizes: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'],
        desc: 'A plush everyday knit built for long days on your feet. Seamless one-piece construction, cork-lined footbed and a natural gum outsole that grips city pavement.',
        specs: { weight: '292 g', drop: '6 mm', upper: 'WholeKnit one-piece knit', midsole: 'SoftRide EVA' }
      },
      {
        id: 'p3', name: 'Apex Court Mid', sport: 'basketball', gender: 'men',
        price: 199, sale: null, stock: 12, featured: true, isNew: false,
        rating: 4.8, reviews: 98, img: 'assets/images/products/p3.png', imgHover: 'assets/images/products/p3-alt.png',
        colors: [
          { name: 'Court Black', hex: '#141416', fam: 'Black' },
          { name: 'Volt', hex: '#d6f24f', fam: 'Green' }
        ],
        sizes: ADULT_SIZES.slice(),
        desc: 'Lockdown for the hardwood. A supportive mid-top collar, herringbone traction and responsive court cushioning built for explosive first steps.',
        specs: { weight: '388 g', drop: '10 mm', upper: 'Full-grain leather + cage', midsole: 'CourtCell dual density' }
      },
      {
        id: 'p4', name: 'Drift Slipstream', sport: 'sneakers', gender: 'women',
        price: 159, sale: 129, stock: 20, featured: false, isNew: false,
        rating: 4.6, reviews: 75, img: 'assets/images/products/p4.png', imgHover: '',
        colors: [
          { name: 'Cream', hex: '#efe8da', fam: 'White' },
          { name: 'Blush', hex: '#efc9c0', fam: 'Pink' }
        ],
        sizes: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '10'],
        desc: 'Clean lines, buttery leather and a sculpted cupsole. The Slipstream is the pair that works with everything from tailoring to track pants.',
        specs: { weight: '310 g', drop: '7 mm', upper: 'Nappa leather', midsole: 'Sculpted cupsole' }
      },
      {
        id: 'p5', name: 'Nova Trail GTX', sport: 'running', gender: 'women',
        price: 179, sale: null, stock: 15, featured: false, isNew: true,
        rating: 4.7, reviews: 120, img: 'assets/images/products/p5.png', imgHover: '',
        colors: [
          { name: 'Moss', hex: '#5d6b4d', fam: 'Green' },
          { name: 'Charcoal', hex: '#3b3d42', fam: 'Gray' }
        ],
        sizes: ['5', '6', '6.5', '7', '7.5', '8', '8.5', '9'],
        desc: 'Weatherproof trail runner with a storm-shield membrane, 5 mm lugs and rock-plate protection. Made for mud, granite and everything between.',
        specs: { weight: '322 g', drop: '6 mm', upper: 'Ripstop mesh + storm membrane', midsole: 'TrailForm foam' }
      },
      {
        id: 'p6', name: 'Halcyon Low', sport: 'casual', gender: 'men',
        price: 139, sale: 99, stock: 30, featured: false, isNew: false,
        rating: 4.5, reviews: 88, img: 'assets/images/products/p6.png', imgHover: '',
        colors: [
          { name: 'Fog Gray', hex: '#c9c7c2', fam: 'Gray' },
          { name: 'Sand', hex: '#d8c9ad', fam: 'Brown' }
        ],
        sizes: ADULT_SIZES.slice(),
        desc: 'A retro runner re-cut for today. Soft suede overlays, a cushioned wedge midsole and heritage colorways that never shout.',
        specs: { weight: '301 g', drop: '9 mm', upper: 'Suede + nylon', midsole: 'Heritage EVA wedge' }
      },
      {
        id: 'p7', name: 'Kinetic One JR', sport: 'sneakers', gender: 'kids',
        price: 89, sale: null, stock: 26, featured: false, isNew: true,
        rating: 4.8, reviews: 54, img: 'assets/images/products/p7.png', imgHover: '',
        colors: [
          { name: 'White / Tangerine', hex: '#ff8a3d', fam: 'Orange' },
          { name: 'Navy Pop', hex: '#2c3e66', fam: 'Blue' }
        ],
        sizes: KID_SIZES.slice(),
        desc: 'Built for playground speed. Elastic speed-laces kids can do themselves, reinforced toe caps and a bouncy lightweight sole.',
        specs: { weight: '180 g', drop: '6 mm', upper: 'Breathable mesh', midsole: 'LightForm foam' }
      },
      {
        id: 'p8', name: 'Flux Trainer', sport: 'sneakers', gender: 'women',
        price: 145, sale: null, stock: 4, featured: false, isNew: false,
        rating: 4.6, reviews: 66, img: 'assets/images/products/p8.png', imgHover: 'assets/images/products/p8-alt.png',
        colors: [
          { name: 'Lilac', hex: '#cbb7e8', fam: 'Purple' },
          { name: 'Chalk', hex: '#f2f0ea', fam: 'White' }
        ],
        sizes: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'],
        desc: 'Studio-to-street cross trainer with a stable heel for lifts and a flexible forefoot for intervals. Knit collar hugs the ankle without pressure.',
        specs: { weight: '276 g', drop: '5 mm', upper: 'SupportKnit', midsole: 'Dual-density FluxForm' }
      },
      {
        id: 'p9', name: 'Stratos Foam JR', sport: 'running', gender: 'kids',
        price: 79, sale: null, stock: 22, featured: false, isNew: false,
        rating: 4.7, reviews: 41, img: 'assets/images/products/p9.png', imgHover: '',
        colors: [
          { name: 'Sky Blue', hex: '#a9cfe8', fam: 'Blue' },
          { name: 'Cloud White', hex: '#f4f4f0', fam: 'White' }
        ],
        sizes: KID_SIZES.slice(),
        desc: 'Feather-light running shoe for growing feet. Extra-soft foam, easy pull-tabs and reflective details for dusk runs.',
        specs: { weight: '150 g', drop: '5 mm', upper: 'AirMesh', midsole: 'Stratos foam' }
      },
      {
        id: 'p10', name: 'Court Legacy', sport: 'sneakers', gender: 'women',
        price: 165, sale: null, stock: 0, featured: true, isNew: false,
        rating: 4.8, reviews: 132, img: 'assets/images/products/p10.png', imgHover: '',
        colors: [
          { name: 'Chalk / Crimson', hex: '#a32c2c', fam: 'Red' },
          { name: 'Triple White', hex: '#f6f5f1', fam: 'White' }
        ],
        sizes: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '10'],
        desc: 'An icon, remastered. Premium tumbled leather, vintage tooling and a colorblock lifted from our 1988 archive.',
        specs: { weight: '340 g', drop: '8 mm', upper: 'Tumbled leather', midsole: 'Vintage rubber cupsole' }
      }
    ];

    var categories = [
      { slug: 'men',         name: 'Men',         desc: 'Performance and lifestyle silhouettes engineered for him.', image: 'assets/images/products/p3.png' },
      { slug: 'women',       name: 'Women',       desc: 'Sculpted shapes and considered colorways, made for her.',  image: 'assets/images/products/p8.png' },
      { slug: 'kids',        name: 'Kids',        desc: 'Durable, lightweight kicks built for nonstop motion.',      image: 'assets/images/products/p7.png' },
      { slug: 'sneakers',    name: 'Sneakers',    desc: 'The icons. Everyday pairs with heritage DNA.',              image: 'assets/images/products/p10.png' },
      { slug: 'running',     name: 'Running',     desc: 'From daily miles to race day — foam-tuned speed.',          image: 'assets/images/products/p1.png' },
      { slug: 'basketball',  name: 'Basketball',  desc: 'Traction, lockdown and court feel for the paint.',          image: 'assets/images/products/p3.png' },
      { slug: 'casual',      name: 'Casual',      desc: 'Relaxed silhouettes for off-duty days.',                    image: 'assets/images/products/p6.png' },
      { slug: 'new-arrivals',name: 'New Arrivals',desc: 'Fresh from the lab — this season\u2019s latest drops.',     image: 'assets/images/products/p5.png' },
      { slug: 'sale',        name: 'Sale',        desc: 'Limited-time prices on fan favorites.',                     image: 'assets/images/products/p6.png' }
    ];

    var users = [
      { id: 'u-admin', name: 'Aeron Admin', email: 'admin@aeron.store', pass: 'admin123', role: 'admin',  status: 'active', joined: daysAgo(120), phone: '', address: { line: '', city: '', postal: '', country: '' } },
      { id: 'u-demo',  name: 'Alex Morgan', email: 'demo@aeron.store',  pass: 'demo123',  role: 'user',   status: 'active', joined: daysAgo(34),  phone: '+1 555 0102', address: { line: '12 Meridian Way', city: 'Portland', postal: '97201', country: 'United States' } },
      { id: 'u-2',     name: 'Ayesha Khan', email: 'ayesha.k@example.com', pass: 'aisha234', role: 'user', status: 'active', joined: daysAgo(21), phone: '+92 300 1112233', address: { line: '8 Garden Block', city: 'Lahore', postal: '54000', country: 'Pakistan' } },
      { id: 'u-3',     name: 'Omar Malik',  email: 'omar.m@example.com',  pass: 'omar2024',  role: 'user', status: 'active', joined: daysAgo(12), phone: '+971 50 9988776', address: { line: '44 Marina Walk', city: 'Dubai', postal: '00000', country: 'UAE' } }
    ];

    function mkOrder(no, daysBack, status, customer, items, opts) {
      opts = opts || {};
      var subtotal = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
      var shipping = opts.express ? 25 : (subtotal >= 150 ? 0 : 12);
      var discount = opts.discount || 0;
      return {
        id: uid('o'), number: no, ts: daysAgo(daysBack), status: status,
        customer: customer, items: items,
        shipMethod: opts.express ? 'express' : 'standard',
        payment: opts.payment || 'card',
        promo: opts.promo || '', subtotal: subtotal, discount: discount,
        shipping: shipping, total: subtotal + shipping - discount,
        userEmail: customer.email
      };
    }
    function it(pid, size, qty) {
      var p = null;
      for (var i = 0; i < products.length; i++) if (products[i].id === pid) p = products[i];
      return { pid: pid, name: p.name, img: p.img, size: size, color: p.colors[0].name, qty: qty, price: p.sale || p.price };
    }

    var orders = [
      mkOrder('AE-260923-4821', 0, 'Pending',    { name: 'Hamza Tariq', email: 'hamza.t@example.com', phone: '+92 321 5551234', address: { line: '23 Model Town', city: 'Lahore', postal: '54700', country: 'Pakistan' } }, [it('p5', '7', 1)]),
      mkOrder('AE-260922-1187', 1, 'Processing', { name: 'Alex Morgan', email: 'demo@aeron.store', phone: '+1 555 0102', address: { line: '12 Meridian Way', city: 'Portland', postal: '97201', country: 'United States' } }, [it('p8', '7', 1)], { discount: 14.5, promo: 'AERON10' }),
      mkOrder('AE-260921-9034', 2, 'Shipped',    { name: 'Mia Chen',    email: 'mia.c@example.com', phone: '+65 8123 4567', address: { line: '9 Orchard Lane', city: 'Singapore', postal: '238884', country: 'Singapore' } }, [it('p4', '6.5', 1), it('p10', '7', 1)], { express: true }),
      mkOrder('AE-260920-2210', 3, 'Delivered',  { name: 'Daniyal Riaz', email: 'daniyal.r@example.com', phone: '+44 7700 900123', address: { line: '5 Brick Lane', city: 'London', postal: 'E1 6PU', country: 'United Kingdom' } }, [it('p6', '9', 2)], { payment: 'cod' }),
      mkOrder('AE-260919-7745', 4, 'Shipped',    { name: 'Sara Ahmed',  email: 'sara.a@example.com', phone: '+966 50 1234567', address: { line: '77 Palm District', city: 'Riyadh', postal: '12311', country: 'Saudi Arabia' } }, [it('p3', '10', 1)]),
      mkOrder('AE-260918-3308', 5, 'Delivered',  { name: 'Omar Malik',  email: 'omar.m@example.com', phone: '+971 50 9988776', address: { line: '44 Marina Walk', city: 'Dubai', postal: '00000', country: 'UAE' } }, [it('p1', '9', 1), it('p7', '3Y', 1)]),
      mkOrder('AE-260917-6120', 6, 'Cancelled',  { name: 'Zara Ali',    email: 'zara.a@example.com', phone: '+92 333 7766554', address: { line: '3 Clifton Block 5', city: 'Karachi', postal: '75600', country: 'Pakistan' } }, [it('p2', '6', 1)])
    ];

    return {
      version: SEED_VERSION,
      products: products,
      categories: categories,
      users: users,
      orders: orders,
      promos: {
        'AERON10':  { code: 'AERON10',  type: 'percent',  value: 10, min: 0,   label: '10% off your order' },
        'CLUB15':   { code: 'CLUB15',   type: 'percent',  value: 15, min: 200, label: '15% off orders over $200' },
        'FREESHIP': { code: 'FREESHIP', type: 'freeship', value: 0,  min: 0,   label: 'Free standard shipping' }
      }
    };
  }

  /* ------------------------------ store ------------------------------ */
  var db = lsGet(K.db, null);
  if (!db || db.version !== SEED_VERSION) { db = seed(); lsSet(K.db, db); }
  function save() { lsSet(K.db, db); }

  var Store = {
    keys: K, money: money, esc: esc,

    /* ---------- catalog ---------- */
    products: function () { return db.products; },
    product: function (id) {
      for (var i = 0; i < db.products.length; i++) if (db.products[i].id === id) return db.products[i];
      return null;
    },
    saveProduct: function (p) {
      var idx = -1;
      for (var i = 0; i < db.products.length; i++) if (db.products[i].id === p.id) idx = i;
      if (idx === -1) { if (!p.id) p.id = uid('p'); db.products.unshift(p); }
      else db.products[idx] = p;
      save(); return p;
    },
    deleteProduct: function (id) {
      db.products = db.products.filter(function (p) { return p.id !== id; });
      // also scrub from carts / wishlists so nothing breaks
      var cart = Store.cart().filter(function (c) { return c.pid !== id; });
      lsSet(K.cart, cart);
      lsSet(K.wish, Store.wishlist().filter(function (w) { return w !== id; }));
      save();
    },
    categories: function () { return db.categories; },
    category: function (slug) {
      for (var i = 0; i < db.categories.length; i++) if (db.categories[i].slug === slug) return db.categories[i];
      return null;
    },
    saveCategory: function (c) {
      var idx = -1;
      for (var i = 0; i < db.categories.length; i++) if (db.categories[i].slug === c.slug) idx = i;
      if (idx === -1) db.categories.push(c); else db.categories[idx] = c;
      save();
    },
    deleteCategory: function (slug) {
      db.categories = db.categories.filter(function (c) { return c.slug !== slug; });
      save();
    },
    productsInCategory: function (slug) {
      return db.products.filter(function (p) { return Store.matchCategory(p, slug); });
    },
    matchCategory: function (p, slug) {
      if (slug === 'new-arrivals') return !!p.isNew;
      if (slug === 'sale') return p.sale != null && p.sale < p.price;
      return p.gender === slug || p.sport === slug;
    },
    catLabel: function (p) {
      var g = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '';
      var s = p.sport ? p.sport.charAt(0).toUpperCase() + p.sport.slice(1) : '';
      return g + ' \u00B7 ' + s;
    },

    /* ---------- promos ---------- */
    promoInfo: function (code) {
      code = String(code || '').trim().toUpperCase();
      var p = db.promos[code];
      if (!p) return { ok: false, msg: 'That code isn\u2019t valid.' };
      var sub = Store.cartSubtotal();
      if (p.min && sub < p.min) return { ok: false, msg: 'Code ' + code + ' needs a subtotal of ' + money(p.min) + '+.' };
      return { ok: true, promo: p };
    },
    activePromo: function () {
      var code = lsGet(K.promo, '');
      if (!code) return null;
      var info = Store.promoInfo(code);
      return info.ok ? info.promo : null;
    },
    setActivePromo: function (code) { lsSet(K.promo, code || ''); },

    /* ---------- cart ---------- */
    cart: function () { return lsGet(K.cart, []); },
    addToCart: function (pid, size, color, qty) {
      qty = qty || 1;
      var p = Store.product(pid);
      if (!p) return false;
      if (p.stock <= 0) return false;
      size = size || (p.sizes && p.sizes[0]) || 'One Size';
      color = color || (p.colors[0] && p.colors[0].name) || 'Default';
      var cart = Store.cart();
      var found = null;
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].pid === pid && cart[i].size === size && cart[i].color === color) { found = cart[i]; break; }
      }
      if (found) found.qty = Math.min(found.qty + qty, 99);
      else cart.push({ pid: pid, size: size, color: color, qty: qty });
      lsSet(K.cart, cart);
      return true;
    },
    updateCartQty: function (index, qty) {
      var cart = Store.cart();
      if (!cart[index]) return;
      cart[index].qty = Math.max(1, Math.min(99, qty));
      lsSet(K.cart, cart);
    },
    removeCart: function (index) {
      var cart = Store.cart();
      cart.splice(index, 1);
      lsSet(K.cart, cart);
    },
    clearCart: function () { lsSet(K.cart, []); },
    cartCount: function () {
      return Store.cart().reduce(function (s, i) { return s + i.qty; }, 0);
    },
    cartSubtotal: function () {
      return Store.cart().reduce(function (s, item) {
        var p = Store.product(item.pid);
        if (!p) return s;
        return s + (p.sale || p.price) * item.qty;
      }, 0);
    },

    /* ---------- wishlist ---------- */
    wishlist: function () { return lsGet(K.wish, []); },
    inWishlist: function (pid) { return Store.wishlist().indexOf(pid) !== -1; },
    toggleWishlist: function (pid) {
      var w = Store.wishlist();
      var i = w.indexOf(pid);
      if (i === -1) w.push(pid); else w.splice(i, 1);
      lsSet(K.wish, w);
      return i === -1;
    },

    /* ---------- recently viewed ---------- */
    pushRecent: function (pid) {
      var r = lsGet(K.recent, []).filter(function (x) { return x !== pid; });
      r.unshift(pid);
      lsSet(K.recent, r.slice(0, 8));
    },
    recent: function () { return lsGet(K.recent, []); },

    /* ---------- users & auth ---------- */
    users: function () { return db.users; },
    findUser: function (email) {
      email = String(email || '').toLowerCase();
      for (var i = 0; i < db.users.length; i++) if (db.users[i].email.toLowerCase() === email) return db.users[i];
      return null;
    },
    register: function (data) {
      if (Store.findUser(data.email)) return { ok: false, msg: 'An account with this email already exists.' };
      var u = {
        id: uid('u'), name: data.name, email: data.email, pass: data.pass,
        role: 'user', status: 'active', joined: Date.now(), phone: '',
        address: { line: '', city: '', postal: '', country: '' }
      };
      db.users.push(u); save();
      Store.loginUser(u.email, true);
      return { ok: true, user: u };
    },
    login: function (email, pass) {
      var u = Store.findUser(email);
      if (!u) return { ok: false, msg: 'No account found with this email.' };
      if (u.pass !== pass) return { ok: false, msg: 'Incorrect password. Please try again.' };
      if (u.status === 'banned') return { ok: false, msg: 'This account has been suspended.' };
      return { ok: true, user: u };
    },
    loginUser: function (email, remember) {
      var session = { email: email, ts: Date.now() };
      try { sessionStorage.removeItem(K.user); } catch (e) {}
      if (remember) lsSet(K.user, session);
      else { try { sessionStorage.setItem(K.user, JSON.stringify(session)); } catch (e) {} }
    },
    logoutUser: function () {
      try { localStorage.removeItem(K.user); sessionStorage.removeItem(K.user); } catch (e) {}
    },
    currentUser: function () {
      var s = lsGet(K.user, null);
      if (!s) { try { s = JSON.parse(sessionStorage.getItem(K.user) || 'null'); } catch (e) { s = null; } }
      return s ? Store.findUser(s.email) : null;
    },
    updateUser: function (u) {
      for (var i = 0; i < db.users.length; i++) if (db.users[i].id === u.id) db.users[i] = u;
      save();
    },
    deleteUser: function (id) {
      db.users = db.users.filter(function (u) { return u.id !== id || u.role === 'admin'; });
      save();
    },

    /* ---------- admin auth ---------- */
    adminLogin: function (email, pass) {
      var u = Store.findUser(email);
      if (!u || u.role !== 'admin') return { ok: false, msg: 'Invalid admin credentials.' };
      if (u.pass !== pass) return { ok: false, msg: 'Invalid admin credentials.' };
      lsSet(K.admin, { email: u.email, ts: Date.now() });
      return { ok: true, user: u };
    },
    adminLogout: function () { try { localStorage.removeItem(K.admin); } catch (e) {} },
    currentAdmin: function () {
      var s = lsGet(K.admin, null);
      return s ? Store.findUser(s.email) : null;
    },

    /* ---------- orders ---------- */
    orders: function () { return db.orders; },
    ordersFor: function (email) {
      email = String(email || '').toLowerCase();
      return db.orders.filter(function (o) { return o.userEmail && o.userEmail.toLowerCase() === email; });
    },
    placeOrder: function (payload) {
      var d = new Date();
      var num = 'AE-' + String(d.getFullYear()).slice(2) +
        ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) +
        '-' + Math.floor(1000 + Math.random() * 9000);
      var order = {
        id: uid('o'), number: num, ts: Date.now(), status: 'Pending',
        customer: payload.customer, items: payload.items,
        shipMethod: payload.shipMethod, payment: payload.payment,
        promo: payload.promo || '', subtotal: payload.subtotal,
        discount: payload.discount, shipping: payload.shipping, total: payload.total,
        userEmail: payload.customer.email
      };
      db.orders.unshift(order); save();
      return order;
    },
    updateOrderStatus: function (id, status) {
      for (var i = 0; i < db.orders.length; i++) if (db.orders[i].id === id) { db.orders[i].status = status; break; }
      save();
    },

    /* ---------- newsletter ---------- */
    subscribe: function (email) {
      var list = lsGet(K.news, []);
      if (list.indexOf(email) === -1) list.push(email);
      lsSet(K.news, list);
    },

    /* ---------- totals helpers ---------- */
    totals: function (shipMethod) {
      var subtotal = Store.cartSubtotal();
      var promo = Store.activePromo();
      var discount = 0;
      if (promo && promo.type === 'percent') discount = Math.round(subtotal * promo.value) / 100;
      if (promo && promo.type === 'fixed') discount = Math.min(promo.value, subtotal);
      var shipping;
      if (shipMethod === 'express') shipping = 25;
      else if ((promo && promo.type === 'freeship') || subtotal >= 150 || subtotal === 0) shipping = 0;
      else shipping = 12;
      return { subtotal: subtotal, discount: discount, shipping: shipping, total: Math.max(0, subtotal + shipping - discount), promo: promo };
    },

    /* ---------- misc ---------- */
    img: function (path) {
      if (!path) return PLACEHOLDER;
      if (/^(data:|https?:|\/\/|\/)/.test(path)) return path;
      return (IS_ADMIN ? '../' : '') + path;
    },
    href: function (page) { return (IS_ADMIN ? '../' : '') + page; },
    statusClass: function (status) {
      return { Pending: 'st-pending', Processing: 'st-processing', Shipped: 'st-shipped', Delivered: 'st-delivered', Cancelled: 'st-cancelled' }[status] || 'st-pending';
    },
    ORDER_STATUSES: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    ADULT_SIZES: ADULT_SIZES, KID_SIZES: KID_SIZES,
    PLACEHOLDER: PLACEHOLDER
  };

  /* keep cart badge fresh across tabs */
  window.addEventListener('storage', function (e) {
    if (e.key === K.cart || e.key === K.wish) {
      if (global.UI && UI.updateBadges) UI.updateBadges();
    }
  });

  global.Store = Store;
})(window);
