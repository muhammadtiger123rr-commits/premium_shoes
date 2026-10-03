/* =====================================================================
   AERON — Admin console (single engine for all admin pages)
   Body attribute data-admin-page decides which view renders.
   ===================================================================== */
(function () {
  'use strict';

  var page = document.body.dataset.adminPage;

  /* ============================ ADMIN LOGIN ============================ */
  if (page === 'login') {
    var form = document.getElementById('alForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('alEmail');
      var pass = document.getElementById('alPass');
      var ok = true;
      [email, pass].forEach(function (f) {
        var bad = !f.value.trim();
        f.closest('.a-field').classList.toggle('err', bad);
        var p = f.closest('.a-field').querySelector('.field-err');
        if (p) p.hidden = !bad;
        if (bad) ok = false;
      });
      if (!ok) return;
      var res = Store.adminLogin(email.value.trim(), pass.value);
      var g = document.getElementById('alGlobal');
      if (!res.ok) { g.textContent = res.msg; return; }
      g.textContent = '';
      location.href = 'dashboard.html';
    });
    return;
  }

  /* =============================== GUARD =============================== */
  var admin = Store.currentAdmin();
  if (!admin || admin.role !== 'admin') { location.replace('login.html'); return; }

  /* =============================== SHELL =============================== */
  var TITLES = {
    dashboard: 'Dashboard', products: 'Product Management', orders: 'Order Management',
    users: 'User Management', categories: 'Category Management'
  };

  function brandMark() { return UI.brandMark(); }
  function icon(n) { return UI.icon(n); }

  var sidebarHTML = '' +
    '<a class="side-brand" href="dashboard.html">' + brandMark() + '<span>AERON<small>ADMIN</small></span></a>' +
    '<div class="side-sec">Overview</div>' +
    '<a class="side-link' + (page === 'dashboard' ? ' on' : '') + '" href="dashboard.html">' + icon('chart') + ' Dashboard</a>' +
    '<div class="side-sec">Manage</div>' +
    '<a class="side-link' + (page === 'products' ? ' on' : '') + '" href="products.html">' + icon('box') + ' Products <span class="cnt">' + Store.products().length + '</span></a>' +
    '<a class="side-link' + (page === 'orders' ? ' on' : '') + '" href="orders.html">' + icon('bag') + ' Orders <span class="cnt">' + Store.orders().length + '</span></a>' +
    '<a class="side-link' + (page === 'categories' ? ' on' : '') + '" href="categories.html">' + icon('grid') + ' Categories <span class="cnt">' + Store.categories().length + '</span></a>' +
    '<a class="side-link' + (page === 'users' ? ' on' : '') + '" href="users.html">' + icon('users') + ' Users <span class="cnt">' + Store.users().filter(function (u) { return u.role === 'user'; }).length + '</span></a>' +
    '<div class="side-foot">' +
      '<a class="side-link" href="../index.html">' + icon('home') + ' View Store</a>' +
      '<button class="side-link" id="sideLogout">' + icon('logout') + ' Log Out</button>' +
    '</div>';

  var initials = admin.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  var topbarHTML = '' +
    '<button class="burger-a" id="burgerA">' + icon('menu') + '</button>' +
    '<div><div class="crumb">Admin / ' + TITLES[page] + '</div><h1>' + TITLES[page] + '</h1></div>' +
    '<div class="top-right">' +
      '<a class="a-btn a-btn-ghost a-btn-sm" href="../index.html">' + icon('home') + ' Store</a>' +
      '<div class="admin-chip"><span class="avatar">' + initials + '</span>' + Store.esc(admin.name) + '</div>' +
    '</div>';

  document.getElementById('adminRoot').innerHTML = '' +
    '<div class="admin-shell">' +
      '<aside class="sidebar" id="sidebar">' + sidebarHTML + '</aside>' +
      '<div class="backdrop-a" id="backdropA"></div>' +
      '<div class="admin-main">' +
        '<div class="admin-topbar">' + topbarHTML + '</div>' +
        '<div class="admin-content" id="adminContent"></div>' +
      '</div>' +
    '</div>' +
    '<div id="adminModal"></div>';

  document.getElementById('sideLogout').addEventListener('click', function () {
    Store.adminLogout();
    location.href = 'login.html';
  });
  document.getElementById('burgerA').addEventListener('click', function () { document.body.classList.add('side-open'); });
  document.getElementById('backdropA').addEventListener('click', function () { document.body.classList.remove('side-open'); });

  var content = document.getElementById('adminContent');

  /* ------------------------------ modal ------------------------------- */
  function openModal(html, wide) {
    document.getElementById('adminModal').innerHTML =
      '<div class="a-modal-back" data-mclose></div><div class="a-modal' + (wide ? ' wide' : '') + '">' + html + '</div>';
    document.body.classList.add('a-modal-open');
  }
  function closeModal() {
    document.getElementById('adminModal').innerHTML = '';
    document.body.classList.remove('a-modal-open');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-mclose]') || e.target.classList.contains('a-modal-back')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  function mHead(title) {
    return '<h3>' + title + '<button class="m-close" data-mclose>' + icon('x') + '</button></h3>';
  }

  /* ============================ DASHBOARD ============================== */
  if (page === 'dashboard') renderDashboard();

  function renderDashboard() {
    var orders = Store.orders();
    var active = orders.filter(function (o) { return o.status !== 'Cancelled'; });
    var revenue = active.reduce(function (s, o) { return s + o.total; }, 0);
    var users = Store.users().filter(function (u) { return u.role === 'user'; });

    content.innerHTML = '' +
    '<div class="a-grid-4">' +
      statCard('Total Revenue', '$' + Math.round(revenue).toLocaleString(), 'revenue', 'chart', '<b>+12.4%</b> vs last week') +
      statCard('Total Orders', orders.length, 'orders', 'bag', active.length + ' active') +
      statCard('Products', Store.products().length, 'products', 'box', Store.products().filter(function (p) { return p.stock <= 5; }).length + ' low on stock') +
      statCard('Customers', users.length, 'users', 'users', users.filter(function (u) { return u.status === 'active'; }).length + ' active') +
    '</div>' +
    '<div class="a-grid-2">' +
      '<div class="panel"><h3>Sales Overview <span class="sub">Last 7 days</span></h3><div class="chart-wrap"><canvas id="salesChart"></canvas></div></div>' +
      '<div class="panel"><h3>Order Status</h3><div class="donut-wrap"><canvas id="donutChart" width="150" height="150"></canvas><div class="legend" id="donutLegend"></div></div></div>' +
    '</div>' +
    '<div class="a-grid-2b" style="margin-bottom:20px">' +
      '<div class="panel"><h3>Quick Actions</h3><div class="qa-grid">' +
        '<a class="qa-btn" href="products.html?new=1">' + icon('plus') + ' Add Product</a>' +
        '<a class="qa-btn" href="orders.html">' + icon('bag') + ' Review Orders</a>' +
        '<a class="qa-btn" href="categories.html">' + icon('grid') + ' Manage Categories</a>' +
        '<a class="qa-btn" href="../index.html">' + icon('home') + ' Visit Storefront</a>' +
      '</div></div>' +
      '<div class="panel"><h3>Recent Products</h3><div id="recentProds"></div></div>' +
    '</div>' +
    '<div class="panel"><h3>Recent Orders <a class="a-btn a-btn-ghost a-btn-sm" href="orders.html">View all</a></h3>' +
      '<div class="table-wrap" style="border:0"><table class="atable"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody id="recentOrders"></tbody></table></div>' +
    '</div>';

    function statCard(label, num, key, ic, sub) {
      return '<div class="stat-card"><div class="s-top"><span class="s-label">' + label + '</span><span class="s-icon">' + icon(ic) + '</span></div>' +
        '<div class="stat-num" id="stat-' + key + '" data-v="' + num + '">0</div><div class="stat-sub">' + sub + '</div></div>';
    }

    /* count-up */
    document.querySelectorAll('.stat-num').forEach(function (el) {
      var raw = el.dataset.v;
      var isMoney = raw.charAt(0) === '$';
      var target = parseFloat(raw.replace(/[$,]/g, ''));
      var t0 = performance.now();
      (function tick(t) {
        var k = Math.min(1, (t - t0) / 900);
        k = 1 - Math.pow(1 - k, 3);
        var v = Math.round(target * k);
        el.textContent = (isMoney ? '$' : '') + v.toLocaleString();
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });

    /* recent orders */
    document.getElementById('recentOrders').innerHTML = orders.slice(0, 5).map(function (o) {
      return '<tr><td><b>' + o.number + '</b></td><td>' + new Date(o.ts).toLocaleDateString() + '</td><td>' + Store.esc(o.customer.name) + '</td>' +
        '<td class="price-s">' + Store.money(o.total) + '</td><td><span class="status-badge ' + Store.statusClass(o.status) + '">' + o.status + '</span></td></tr>';
    }).join('');

    /* recent products */
    document.getElementById('recentProds').innerHTML = Store.products().slice(0, 4).map(function (p) {
      return '<div class="mini-item"><img src="' + Store.img(p.img) + '" alt="">' +
        '<span><b>' + Store.esc(p.name) + '</b><br><span class="mi-meta">Stock: ' + p.stock + '</span></span>' +
        '<b>' + Store.money(p.sale || p.price) + '</b></div>';
    }).join('');

    /* sales chart */
    var days = [];
    for (var d = 6; d >= 0; d--) {
      var day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - d);
      var next = new Date(day); next.setDate(day.getDate() + 1);
      var sum = active.filter(function (o) { return o.ts >= day.getTime() && o.ts < next.getTime(); })
        .reduce(function (s, o) { return s + o.total; }, 0);
      days.push({ label: day.toLocaleDateString(undefined, { weekday: 'short' }), value: sum });
    }
    barChart(document.getElementById('salesChart'), days);

    /* donut */
    var segs = Store.ORDER_STATUSES.map(function (s) {
      return { label: s, value: orders.filter(function (o) { return o.status === s; }).length };
    }).filter(function (s) { return s.value > 0; });
    var COLORS = ['#dd9a2b', '#4c6ef5', '#2f9cd8', '#1f9d6e', '#d64530'];
    donutChart(document.getElementById('donutChart'), segs, COLORS);
    document.getElementById('donutLegend').innerHTML = segs.map(function (s, i) {
      return '<span><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + s.label + '<b>' + s.value + '</b></span>';
    }).join('');
  }

  /* ------------------------ tiny canvas charts ------------------------- */
  function barChart(canvas, data) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([100]));
    var padB = 26, padT = 16, bw = Math.min(46, (w - 40) / data.length * 0.5);
    var step = (w - 30) / data.length;
    data.forEach(function (d, i) {
      var bh = (d.value / max) * (h - padB - padT);
      var x = 20 + step * i + (step - bw) / 2;
      var y = h - padB - bh;
      ctx.fillStyle = i === data.length - 1 ? '#ff4d1c' : '#1c1c1a';
      roundRect(ctx, x, y, bw, Math.max(bh, 3), 6); ctx.fill();
      ctx.fillStyle = '#8b877e'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + bw / 2, h - 8);
      if (d.value > 0) {
        ctx.fillStyle = '#161614'; ctx.font = '600 10.5px Inter, sans-serif';
        ctx.fillText('$' + Math.round(d.value), x + bw / 2, y - 6);
      }
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, 0);
    ctx.arcTo(x, y + h, x, y, 0);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function donutChart(canvas, segs, colors) {
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = 150 * dpr; canvas.height = 150 * dpr;
    ctx.scale(dpr, dpr);
    var total = segs.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var a = -Math.PI / 2, cx = 75, cy = 75;
    segs.forEach(function (s, i) {
      var a2 = a + s.value / total * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 62, a + 0.03, a2 - 0.03);
      ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 18; ctx.lineCap = 'round';
      ctx.stroke();
      a = a2;
    });
    ctx.fillStyle = '#161614'; ctx.font = '800 22px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 2);
    ctx.fillStyle = '#8b877e'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText('ORDERS', cx, cy + 16);
  }

  /* ============================ PRODUCTS =============================== */
  if (page === 'products') renderProducts();

  function renderProducts() {
    var state = { q: '', sport: '', gender: '' };

    content.innerHTML = '' +
    '<div class="toolbar">' +
      '<div class="search-in">' + icon('search') + '<input id="pSearch" placeholder="Search products…"></div>' +
      '<select id="pSport"><option value="">All categories</option>' +
        ['running', 'basketball', 'sneakers', 'casual'].map(function (s) { return '<option>' + s + '</option>'; }).join('') +
      '</select>' +
      '<select id="pGender"><option value="">All segments</option><option>men</option><option>women</option><option>kids</option></select>' +
      '<button class="a-btn a-btn-accent" id="pAdd">' + icon('plus') + ' Add Product</button>' +
    '</div>' +
    '<div class="table-wrap"><table class="atable"><thead><tr>' +
      '<th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Featured</th><th>New</th><th style="text-align:right">Actions</th>' +
    '</tr></thead><tbody id="pRows"></tbody></table></div>';

    function list() {
      return Store.products().filter(function (p) {
        if (state.q && p.name.toLowerCase().indexOf(state.q) === -1) return false;
        if (state.sport && p.sport !== state.sport) return false;
        if (state.gender && p.gender !== state.gender) return false;
        return true;
      });
    }

    function draw() {
      var rows = list();
      document.getElementById('pRows').innerHTML = rows.length ? rows.map(function (p) {
        return '<tr>' +
          '<td><div class="cell-prod"><img src="' + Store.img(p.img) + '" alt=""><div><b>' + Store.esc(p.name) + '</b><span>' + p.id + '</span></div></div></td>' +
          '<td style="text-transform:capitalize">' + p.gender + ' \u00B7 ' + p.sport + '</td>' +
          '<td class="price-s">' + (p.sale ? '<s>' + Store.money(p.price) + '</s>' + Store.money(p.sale) : Store.money(p.price)) + '</td>' +
          '<td>' + (p.stock <= 0 ? '<span style="color:var(--a-mut)">Out</span>' : p.stock <= 5 ? '<b style="color:#dd9a2b">' + p.stock + '</b>' : p.stock) + '</td>' +
          '<td><label class="switch"><input type="checkbox" data-feat="' + p.id + '"' + (p.featured ? ' checked' : '') + '><i></i></label></td>' +
          '<td><label class="switch"><input type="checkbox" data-new="' + p.id + '"' + (p.isNew ? ' checked' : '') + '><i></i></label></td>' +
          '<td><div class="row-actions" style="justify-content:flex-end">' +
            '<button class="icon-btn-a" data-edit="' + p.id + '" title="Edit">' + icon('edit') + '</button>' +
            '<button class="icon-btn-a danger" data-del="' + p.id + '" title="Delete">' + icon('trash') + '</button>' +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="7"><div class="empty-a">' + icon('box') + '<p>No products found.</p></div></td></tr>';
    }

    document.getElementById('pSearch').addEventListener('input', function (e) { state.q = e.target.value.toLowerCase(); draw(); });
    document.getElementById('pSport').addEventListener('change', function (e) { state.sport = e.target.value; draw(); });
    document.getElementById('pGender').addEventListener('change', function (e) { state.gender = e.target.value; draw(); });
    document.getElementById('pAdd').addEventListener('click', function () { productForm(null); });

    if (!content.dataset.pWired) {
      content.dataset.pWired = '1';
      content.addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit]');
        if (ed) { productForm(Store.product(ed.dataset.edit)); return; }
        var del = e.target.closest('[data-del]');
        if (del) {
          var p = Store.product(del.dataset.del);
          if (confirm('Delete "' + p.name + '"? This cannot be undone.')) {
            Store.deleteProduct(p.id);
            UI.toast('Product deleted.', 'info');
            draw();
          }
        }
      });
      content.addEventListener('change', function (e) {
        if (e.target.dataset.feat) {
          var p1 = Store.product(e.target.dataset.feat);
          p1.featured = e.target.checked; Store.saveProduct(p1);
          UI.toast(p1.name + (p1.featured ? ' is now featured.' : ' removed from featured.'));
        }
        if (e.target.dataset.new) {
          var p2 = Store.product(e.target.dataset.new);
          p2.isNew = e.target.checked; Store.saveProduct(p2);
          UI.toast(p2.name + (p2.isNew ? ' marked as New Arrival.' : ' removed from New Arrivals.'));
        }
      });
    }

    draw();

    if (new URLSearchParams(location.search).get('new') === '1') {
      history.replaceState(null, '', 'products.html');
      productForm(null);
    }
  }

  /* ------------------------- product form modal ------------------------ */
  function productForm(p) {
    var isNew = !p;
    var prod = p || { id: '', name: '', sport: 'sneakers', gender: 'men', price: 149, sale: null, stock: 12, featured: false, isNew: true, rating: 4.6, reviews: 0, img: '', imgHover: '', colors: [{ name: '', hex: '#1b1b1e', fam: 'Black' }], sizes: ['8', '9', '10'], desc: '', specs: {} };
    var allSizes = Store.ADULT_SIZES.concat(Store.KID_SIZES);

    openModal(
      mHead(isNew ? 'Add Product' : 'Edit — ' + Store.esc(prod.name)) +
      '<div class="form-grid">' +
        '<div class="a-field"><label>Name *</label><input id="pf-name" value="' + Store.esc(prod.name) + '"></div>' +
        '<div class="a-field"><label>Category (sport) *</label><select id="pf-sport">' +
          ['running', 'basketball', 'sneakers', 'casual'].map(function (s) { return '<option' + (prod.sport === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="a-field"><label>Segment *</label><select id="pf-gender">' +
          ['men', 'women', 'kids'].map(function (s) { return '<option' + (prod.gender === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<div class="a-field"><label>Stock *</label><input id="pf-stock" type="number" min="0" value="' + prod.stock + '"></div>' +
        '<div class="a-field"><label>Price (USD) *</label><input id="pf-price" type="number" min="1" step="0.01" value="' + prod.price + '"></div>' +
        '<div class="a-field"><label>Sale price (blank = none)</label><input id="pf-sale" type="number" min="0" step="0.01" value="' + (prod.sale == null ? '' : prod.sale) + '"></div>' +
      '</div>' +
      '<div class="a-field"><label>Description</label><textarea id="pf-desc">' + Store.esc(prod.desc) + '</textarea></div>' +
      '<div class="a-field"><label>Sizes</label><div class="chips-editor" id="pf-sizes">' +
        allSizes.map(function (s) { return '<button type="button" data-sz="' + s + '"' + (prod.sizes.indexOf(s) !== -1 ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="a-field"><label>Colors <span style="text-transform:none;letter-spacing:0;font-weight:400">(name / swatch / family)</span></label>' +
        '<div id="pf-colors"></div><button class="a-btn a-btn-ghost a-btn-sm" id="pf-addcolor" type="button">' + icon('plus') + ' Add color</button></div>' +
      '<div class="a-field"><label>Product image</label><div class="img-upload">' +
        '<img class="prev" id="pf-imgprev" src="' + (prod.img ? Store.img(prod.img) : Store.PLACEHOLDER) + '" alt="">' +
        '<div><label class="upload-btn" for="pf-imgfile">' + icon('upload') + ' Upload image</label>' +
        '<input type="file" id="pf-imgfile" accept="image/*" hidden>' +
        '<p style="font-size:11.5px;color:var(--a-mut);margin-top:6px">PNG/JPG, kept under ~1.5 MB. Stored locally.</p></div>' +
      '</div></div>' +
      '<div class="check-row">' +
        '<label><input type="checkbox" id="pf-featured"' + (prod.featured ? ' checked' : '') + '> Featured</label>' +
        '<label><input type="checkbox" id="pf-isnew"' + (prod.isNew ? ' checked' : '') + '> New arrival</label>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="a-btn a-btn-ghost" data-mclose>Cancel</button>' +
        '<button class="a-btn a-btn-dark" id="pf-save">' + icon('check') + ' ' + (isNew ? 'Create Product' : 'Save Changes') + '</button>' +
      '</div>', true);

    /* colors editor */
    var colorsBox = document.getElementById('pf-colors');
    var imgData = prod.img || '';
    function colorRow(c) {
      var row = document.createElement('div');
      row.className = 'color-edit-row';
      row.innerHTML = '<input class="c-name" placeholder="Color name" value="' + Store.esc(c.name || '') + '">' +
        '<input type="color" class="c-hex" value="' + (c.hex || '#1b1b1e') + '">' +
        '<input class="c-fam" placeholder="Family (e.g. Black)" value="' + Store.esc(c.fam || '') + '">' +
        '<button class="icon-btn-a danger" type="button">' + icon('x') + '</button>';
      row.querySelector('button').addEventListener('click', function () { row.remove(); });
      colorsBox.appendChild(row);
    }
    (prod.colors && prod.colors.length ? prod.colors : [{ name: '', hex: '#1b1b1e', fam: '' }]).forEach(colorRow);
    document.getElementById('pf-addcolor').addEventListener('click', function () { colorRow({ name: '', hex: '#cccccc', fam: '' }); });

    /* sizes toggle */
    document.getElementById('pf-sizes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sz]');
      if (b) b.classList.toggle('on');
    });

    /* image upload */
    document.getElementById('pf-imgfile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      if (f.size > 1600000) { UI.toast('Image is too large — keep it under ~1.5 MB.', 'err'); return; }
      var rd = new FileReader();
      rd.onload = function () {
        imgData = rd.result;
        document.getElementById('pf-imgprev').src = imgData;
      };
      rd.readAsDataURL(f);
    });

    /* save */
    document.getElementById('pf-save').addEventListener('click', function () {
      var name = document.getElementById('pf-name').value.trim();
      var price = parseFloat(document.getElementById('pf-price').value);
      if (!name) { UI.toast('Please enter a product name.', 'err'); return; }
      if (!(price > 0)) { UI.toast('Please enter a valid price.', 'err'); return; }
      var saleRaw = document.getElementById('pf-sale').value;
      var sale = saleRaw === '' ? null : parseFloat(saleRaw);
      if (sale != null && sale >= price) { UI.toast('Sale price must be lower than the regular price.', 'err'); return; }

      var sizes = Array.prototype.slice.call(document.querySelectorAll('#pf-sizes button.on')).map(function (b) { return b.dataset.sz; });
      if (!sizes.length) { UI.toast('Select at least one size.', 'err'); return; }

      var colors = [];
      colorsBox.querySelectorAll('.color-edit-row').forEach(function (row) {
        var nm = row.querySelector('.c-name').value.trim();
        colors.push({
          name: nm || 'Default',
          hex: row.querySelector('.c-hex').value,
          fam: row.querySelector('.c-fam').value.trim() || 'Black'
        });
      });
      if (!colors.length) colors.push({ name: 'Default', hex: '#1b1b1e', fam: 'Black' });

      var updated = Object.assign({}, prod, {
        name: name,
        sport: document.getElementById('pf-sport').value,
        gender: document.getElementById('pf-gender').value,
        stock: Math.max(0, parseInt(document.getElementById('pf-stock').value, 10) || 0),
        price: price,
        sale: sale,
        desc: document.getElementById('pf-desc').value.trim(),
        sizes: sizes,
        colors: colors,
        featured: document.getElementById('pf-featured').checked,
        isNew: document.getElementById('pf-isnew').checked,
        img: imgData || prod.img || Store.PLACEHOLDER
      });
      Store.saveProduct(updated);
      UI.toast(isNew ? 'Product <b>' + Store.esc(name) + '</b> created.' : 'Changes saved.');
      closeModal();
      renderProducts_refresh();
    });
  }
  function renderProducts_refresh() {
    /* re-render product table in place */
    var rows = document.getElementById('pRows');
    if (!rows) return;
    content.innerHTML = '';
    renderProducts();
  }

  /* ============================== ORDERS =============================== */
  if (page === 'orders') renderOrders();

  function renderOrders() {
    var state = { q: '', status: '' };
    content.innerHTML = '' +
    '<div class="toolbar">' +
      '<div class="search-in">' + icon('search') + '<input id="oSearch" placeholder="Search by order #, name or email…"></div>' +
      '<select id="oStatus"><option value="">All statuses</option>' +
        Store.ORDER_STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>' +
    '</div>' +
    '<div class="table-wrap"><table class="atable"><thead><tr>' +
      '<th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th>' +
    '</tr></thead><tbody id="oRows"></tbody></table></div>';

    function list() {
      return Store.orders().filter(function (o) {
        if (state.status && o.status !== state.status) return false;
        if (state.q) {
          var hay = (o.number + ' ' + o.customer.name + ' ' + o.customer.email).toLowerCase();
          if (hay.indexOf(state.q) === -1) return false;
        }
        return true;
      });
    }

    function draw() {
      var rows = list();
      document.getElementById('oRows').innerHTML = rows.length ? rows.map(function (o) {
        return '<tr>' +
          '<td><b>' + o.number + '</b></td>' +
          '<td>' + new Date(o.ts).toLocaleDateString() + '</td>' +
          '<td>' + Store.esc(o.customer.name) + '<br><span style="font-size:12px;color:var(--a-mut)">' + Store.esc(o.customer.email) + '</span></td>' +
          '<td>' + o.items.reduce(function (s, i) { return s + i.qty; }, 0) + '</td>' +
          '<td class="price-s">' + Store.money(o.total) + '</td>' +
          '<td style="text-transform:uppercase;font-size:12px">' + o.payment + '</td>' +
          '<td><select class="st-select" data-status="' + o.id + '">' +
            Store.ORDER_STATUSES.map(function (s) { return '<option' + (o.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
          '</select></td>' +
          '<td><button class="a-btn a-btn-ghost a-btn-sm" data-view="' + o.id + '">' + icon('eye') + ' View</button></td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="8"><div class="empty-a">' + icon('bag') + '<p>No orders match.</p></div></td></tr>';
    }

    document.getElementById('oSearch').addEventListener('input', function (e) { state.q = e.target.value.toLowerCase(); draw(); });
    document.getElementById('oStatus').addEventListener('change', function (e) { state.status = e.target.value; draw(); });

    if (!content.dataset.oWired) {
      content.dataset.oWired = '1';
      content.addEventListener('change', function (e) {
        if (e.target.dataset.status) {
          Store.updateOrderStatus(e.target.dataset.status, e.target.value);
          UI.toast('Order updated to <b>' + e.target.value + '</b>.');
        }
      });
      content.addEventListener('click', function (e) {
        var v = e.target.closest('[data-view]');
        if (v) orderDetail(Store.orders().find(function (o) { return o.id === v.dataset.view; }));
      });
    }

    draw();
  }

  function orderDetail(o) {
    openModal(
      mHead('Order ' + o.number) +
      '<div style="margin-bottom:16px"><span class="status-badge ' + Store.statusClass(o.status) + '">' + o.status + '</span> ' +
        '<span style="font-size:13px;color:var(--a-mut)">Placed ' + new Date(o.ts).toLocaleString() + '</span></div>' +
      '<div class="od-grid">' +
        '<div class="od-box"><h4>Customer</h4>' +
          '<div><b>' + Store.esc(o.customer.name) + '</b></div>' +
          '<div>' + Store.esc(o.customer.email) + '</div>' +
          '<div>' + Store.esc(o.customer.phone || '') + '</div></div>' +
        '<div class="od-box"><h4>Shipping</h4>' +
          '<div>' + Store.esc(o.customer.address.line) + '</div>' +
          '<div>' + Store.esc(o.customer.address.city) + ', ' + Store.esc(o.customer.address.postal) + '</div>' +
          '<div>' + Store.esc(o.customer.address.country) + ' \u00B7 ' + o.shipMethod + '</div></div>' +
      '</div>' +
      '<h4 style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--a-mut)">Items</h4>' +
      o.items.map(function (it) {
        return '<div class="mini-item"><img src="' + Store.img(it.img) + '" alt="">' +
          '<span><b>' + Store.esc(it.name) + '</b><br><span class="mi-meta">US ' + Store.esc(it.size) + ' \u00B7 ' + Store.esc(it.color) + ' \u00D7 ' + it.qty + '</span></span>' +
          '<b>' + Store.money(it.price * it.qty) + '</b></div>';
      }).join('') +
      '<div style="margin-top:14px;font-size:14px">' +
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--a-mut)">Subtotal</span><b>' + Store.money(o.subtotal) + '</b></div>' +
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span style="color:var(--a-mut)">Shipping</span><b>' + (o.shipping === 0 ? 'FREE' : Store.money(o.shipping)) + '</b></div>' +
        (o.discount ? '<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--a-ok)"><span>Discount (' + o.promo + ')</span><b>\u2013' + Store.money(o.discount) + '</b></div>' : '') +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--a-line);margin-top:6px;font-size:16px"><b>Total (' + (o.payment === 'cod' ? 'COD' : 'Card') + ')</b><b>' + Store.money(o.total) + '</b></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:14px">' +
        '<label style="font-size:13px;font-weight:600">Update status:</label>' +
        '<select class="st-select" id="od-status">' + Store.ORDER_STATUSES.map(function (s) { return '<option' + (o.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<button class="a-btn a-btn-dark a-btn-sm" id="od-save">' + icon('check') + ' Save</button>' +
      '</div>');
    document.getElementById('od-save').addEventListener('click', function () {
      Store.updateOrderStatus(o.id, document.getElementById('od-status').value);
      UI.toast('Order status updated.');
      closeModal();
      renderOrders_refresh();
    });
  }
  function renderOrders_refresh() { content.innerHTML = ''; renderOrders(); }

  /* =============================== USERS =============================== */
  if (page === 'users') renderUsers();

  function renderUsers() {
    var q = '';
    content.innerHTML = '' +
    '<div class="toolbar"><div class="search-in">' + icon('search') + '<input id="uSearch" placeholder="Search users…"></div></div>' +
    '<div class="table-wrap"><table class="atable"><thead><tr>' +
      '<th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Status</th><th style="text-align:right">Actions</th>' +
    '</tr></thead><tbody id="uRows"></tbody></table></div>';

    function draw() {
      var rows = Store.users().filter(function (u) { return u.role === 'user'; })
        .filter(function (u) { return !q || (u.name + ' ' + u.email).toLowerCase().indexOf(q) !== -1; });
      document.getElementById('uRows').innerHTML = rows.length ? rows.map(function (u) {
        var n = Store.ordersFor(u.email).length;
        return '<tr>' +
          '<td><div class="cell-prod"><div class="avatar" style="width:40px;height:40px;border-radius:50%;background:var(--a-ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">' +
            Store.esc(u.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()) + '</div>' +
            '<div><b>' + Store.esc(u.name) + '</b><span>' + Store.esc(u.email) + '</span></div></div></td>' +
          '<td>' + Store.esc(u.phone || '\u2014') + '</td>' +
          '<td>' + new Date(u.joined).toLocaleDateString() + '</td>' +
          '<td>' + n + '</td>' +
          '<td><span class="status-badge ' + (u.status === 'active' ? 'st-delivered' : 'st-cancelled') + '">' + u.status + '</span></td>' +
          '<td><div class="row-actions" style="justify-content:flex-end">' +
            '<button class="icon-btn-a" data-uview="' + u.id + '" title="View">' + icon('eye') + '</button>' +
            '<button class="icon-btn-a" data-uban="' + u.id + '" title="Toggle status">' + icon(u.status === 'active' ? 'lock' : 'check') + '</button>' +
            '<button class="icon-btn-a danger" data-udel="' + u.id + '" title="Delete">' + icon('trash') + '</button>' +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="empty-a">' + icon('users') + '<p>No users found.</p></div></td></tr>';
    }

    document.getElementById('uSearch').addEventListener('input', function (e) { q = e.target.value.toLowerCase(); draw(); });

    if (content.dataset.uWired) return void draw();
    content.dataset.uWired = '1';
    content.addEventListener('click', function (e) {
      var view = e.target.closest('[data-uview]');
      if (view) {
        var u = Store.users().find(function (x) { return x.id === view.dataset.uview; });
        var os = Store.ordersFor(u.email);
        openModal(mHead('Customer — ' + Store.esc(u.name)) +
          '<div class="od-grid">' +
            '<div class="od-box"><h4>Contact</h4><div><b>' + Store.esc(u.email) + '</b></div><div>' + Store.esc(u.phone || '\u2014') + '</div><div>Joined ' + new Date(u.joined).toLocaleDateString() + '</div></div>' +
            '<div class="od-box"><h4>Address</h4><div>' + Store.esc(u.address.line || '\u2014') + '</div><div>' + Store.esc(u.address.city || '') + (u.address.city ? ', ' : '') + Store.esc(u.address.postal || '') + '</div><div>' + Store.esc(u.address.country || '') + '</div></div>' +
          '</div>' +
          '<h4 style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--a-mut)">Orders (' + os.length + ')</h4>' +
          (os.length ? os.map(function (o) {
            return '<div class="mini-item"><img src="' + Store.img(o.items[0] ? o.items[0].img : '') + '" alt="">' +
              '<span><b>' + o.number + '</b><br><span class="mi-meta">' + new Date(o.ts).toLocaleDateString() + '</span></span>' +
              '<span><span class="status-badge ' + Store.statusClass(o.status) + '">' + o.status + '</span> <b style="margin-left:8px">' + Store.money(o.total) + '</b></span></div>';
          }).join('') : '<p style="color:var(--a-mut)">No orders yet.</p>'));
        return;
      }
      var ban = e.target.closest('[data-uban]');
      if (ban) {
        var ub = Store.users().find(function (x) { return x.id === ban.dataset.uban; });
        ub.status = ub.status === 'active' ? 'banned' : 'active';
        Store.updateUser(ub);
        UI.toast(ub.name + ' is now <b>' + ub.status + '</b>.');
        draw();
        return;
      }
      var del = e.target.closest('[data-udel]');
      if (del) {
        var ud = Store.users().find(function (x) { return x.id === del.dataset.udel; });
        if (confirm('Delete account for ' + ud.name + '?')) {
          Store.deleteUser(ud.id);
          UI.toast('User deleted.', 'info');
          draw();
        }
      }
    });

    draw();
  }

  /* ============================= CATEGORIES ============================= */
  if (page === 'categories') renderCategories();

  function renderCategories() {
    var AUTO = ['new-arrivals', 'sale'];
    content.innerHTML = '' +
    '<div class="toolbar"><div style="flex:1;color:var(--a-mut);font-size:13.5px">Categories shown across the storefront. “New Arrivals” and “Sale” are automatic collections.</div>' +
      '<button class="a-btn a-btn-accent" id="cAdd">' + icon('plus') + ' Add Category</button></div>' +
    '<div class="cat-admin-grid" id="cGrid"></div>';

    function draw() {
      document.getElementById('cGrid').innerHTML = Store.categories().map(function (c) {
        var auto = AUTO.indexOf(c.slug) !== -1;
        var count = Store.productsInCategory(c.slug).length;
        return '<div class="cat-admin-card">' +
          '<img src="' + Store.img(c.image) + '" alt="">' +
          '<div class="ca-body">' +
            '<b>' + Store.esc(c.name) + '</b> <span class="slug">/' + c.slug + ' \u00B7 ' + count + ' products</span>' +
            '<p>' + Store.esc(c.desc) + '</p>' +
            '<div class="row-actions">' +
              '<button class="a-btn a-btn-ghost a-btn-sm" data-cedit="' + c.slug + '">' + icon('edit') + ' Edit</button>' +
              (auto ? '<span style="font-size:11.5px;color:var(--a-mut);align-self:center;margin-left:auto">Auto</span>'
                    : '<button class="a-btn a-btn-ghost a-btn-sm" data-cdel="' + c.slug + '" style="color:#c0381f">' + icon('trash') + ' Delete</button>') +
            '</div>' +
          '</div></div>';
      }).join('');
    }

    document.getElementById('cAdd').addEventListener('click', function () { categoryForm(null); });
    if (!content.dataset.cWired) {
      content.dataset.cWired = '1';
      content.addEventListener('click', catClick);
    }
    function catClick(e) {
      var ed = e.target.closest('[data-cedit]');
      if (ed) { categoryForm(Store.category(ed.dataset.cedit)); return; }
      var del = e.target.closest('[data-cdel]');
      if (del) {
        var c = Store.category(del.dataset.cdel);
        var n = Store.productsInCategory(c.slug).length;
        if (n > 0 && !confirm('"' + c.name + '" still matches ' + n + ' product(s). Delete anyway? Products will remain but lose this collection.')) return;
        if (n === 0 && !confirm('Delete category "' + c.name + '"?')) return;
        Store.deleteCategory(c.slug);
        UI.toast('Category deleted.', 'info');
        draw();
      }
    }

    draw();

    function categoryForm(c) {
      var isNew = !c;
      var cat = c || { slug: '', name: '', desc: '', image: '' };
      var imgData = cat.image || '';
      openModal(
        mHead(isNew ? 'Add Category' : 'Edit — ' + Store.esc(cat.name)) +
        '<div class="form-grid">' +
          '<div class="a-field"><label>Name *</label><input id="cf-name" value="' + Store.esc(cat.name) + '"' + (isNew ? '' : ' readonly style="background:var(--a-bg)"') + '></div>' +
          '<div class="a-field"><label>Slug</label><input id="cf-slug" value="' + Store.esc(cat.slug) + '"' + (isNew ? '' : ' readonly style="background:var(--a-bg)"') + ' placeholder="auto-generated"></div>' +
        '</div>' +
        '<div class="a-field"><label>Description</label><textarea id="cf-desc">' + Store.esc(cat.desc) + '</textarea></div>' +
        '<div class="a-field"><label>Category image</label><div class="img-upload">' +
          '<img class="prev" id="cf-imgprev" src="' + (cat.image ? Store.img(cat.image) : Store.PLACEHOLDER) + '" alt="">' +
          '<div><label class="upload-btn" for="cf-imgfile">' + icon('upload') + ' Upload image</label><input type="file" id="cf-imgfile" accept="image/*" hidden></div>' +
        '</div></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end">' +
          '<button class="a-btn a-btn-ghost" data-mclose>Cancel</button>' +
          '<button class="a-btn a-btn-dark" id="cf-save">' + icon('check') + ' Save Category</button>' +
        '</div>');

      document.getElementById('cf-name').addEventListener('input', function (e) {
        if (isNew) document.getElementById('cf-slug').value = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      });
      document.getElementById('cf-imgfile').addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        if (f.size > 1600000) { UI.toast('Image is too large — keep it under ~1.5 MB.', 'err'); return; }
        var rd = new FileReader();
        rd.onload = function () { imgData = rd.result; document.getElementById('cf-imgprev').src = imgData; };
        rd.readAsDataURL(f);
      });
      document.getElementById('cf-save').addEventListener('click', function () {
        var name = document.getElementById('cf-name').value.trim();
        var slug = document.getElementById('cf-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (!name) { UI.toast('Please enter a category name.', 'err'); return; }
        if (!isNew && slug !== cat.slug) { UI.toast('Slug cannot be changed for existing categories.', 'err'); return; }
        Store.saveCategory({ slug: slug, name: name, desc: document.getElementById('cf-desc').value.trim(), image: imgData || cat.image || Store.PLACEHOLDER });
        UI.toast(isNew ? 'Category <b>' + Store.esc(name) + '</b> created.' : 'Category updated.');
        closeModal();
        content.innerHTML = '';
        renderCategories();
      });
    }
  }
})();
