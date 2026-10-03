# AERON — Premium Footwear eCommerce

An original, fully client-side premium sneaker storefront + admin console.
Built with **HTML5, CSS3 and Vanilla JavaScript only** — no frameworks, no build step, no libraries.

> Brand, copy, logo and product imagery are original. The uploaded reference only influenced
> the visual language: editorial oversized typography, huge product imagery, spacious layouts.

---

## Run it

Open `index.html` in any browser — it works directly from the filesystem (Chrome/Firefox/Edge).
For an even smoother experience (fonts, previews) serve it:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Credentials (demo)

| Role    | Email              | Password |
|---------|--------------------|----------|
| Admin   | admin@aeron.store  | admin123 |
| Customer| demo@aeron.store   | demo123  |

**Promo codes:** `AERON10` (10% off) · `CLUB15` (15% off over $200) · `FREESHIP` (free shipping)

## Storefront pages

| Page            | Highlights |
|-----------------|------------|
| `index.html`    | Hero driven by the featured product, marquee, new arrivals, category tiles, trending, sale banner, best sellers, newsletter |
| `shop.html`     | Full grid with search, category / size / color / price filters, sorting, load-more |
| `category.html?cat=…` | Category hero + same filtering engine (`men`, `women`, `kids`, `sneakers`, `running`, `basketball`, `casual`, `new-arrivals`, `sale`) |
| `product.html?id=p1` | Gallery w/ thumbnails + click-zoom, colors, sizes, qty, add-to-cart, buy-now, wishlist, tabs, reviews, related, recently-viewed |
| `cart.html`     | Quantity controls, remove, move-to-wishlist, promo codes, live totals (persisted) |
| `checkout.html` | Contact / address / shipping method / payment UI, validation, order success + order number |
| `login.html` / `register.html` | Frontend auth with "keep me signed in" |
| `account.html?tab=…` | Profile editing, order history, wishlist, logout |

## Admin console (`/admin`)

| Page | Features |
|------|----------|
| `login.html`     | Dedicated admin sign-in, guarded |
| `dashboard.html` | Animated stat cards (revenue / orders / products / users), canvas sales chart, status donut, recent orders & products, quick actions |
| `products.html`  | Add / edit / delete products, search & filter, inline featured & new-arrival toggles, sizes, colors, image upload (base64) |
| `orders.html`    | Search, status filter, order detail modal, update status (Pending → Processing → Shipped → Delivered / Cancelled) |
| `categories.html`| Category CRUD with image upload (`new-arrivals` & `sale` are automatic collections) |
| `users.html`     | Search, view details, suspend/activate, delete customers |

**Everything the admin changes is saved to `localStorage` and appears instantly on the storefront.**

## Architecture

```
/assets
  /css   base.css (storefront) · admin.css (console)
  /js    db.js        → central localStorage data layer (products, categories, users,
                       orders, promos, cart, wishlist, sessions) — single source of truth
         ui.js        → shared chrome (nav/footer), icons, toasts, quick view, fly-to-cart,
                        custom cursor, magnetic buttons, scroll reveal, page transitions
         home.js · shop.js · product.js · cart.js · checkout.js · auth.js · account.js
         admin.js     → single engine rendering every admin view
/admin  six HTML shells for the console
```

`localStorage` keys: `aeron_db_v1`, `aeron_cart`, `aeron_wishlist`, `aeron_user_session`,
`aeron_admin_session`, `aeron_recently_viewed`, `aeron_promo_code`, `aeron_newsletter`.
Reset everything from DevTools → *Application → Local Storage → Clear*.

## Interactions included

Sticky blurred navbar, mobile full-screen menu, search overlay, preloader, custom cursor,
magnetic CTAs, scroll reveals, hero float + mouse parallax, hover image swap with graceful
fallback, fly-to-cart animation, toast notifications, smooth page fade transitions.
All animations respect `prefers-reduced-motion` and stay fast/purposeful.

## Tests

`node .test/db-test.js`  — 40 assertions over the data layer (cart, promos, auth, orders, CRUD)
`node .test/dom-test.js` — 61 assertions booting every page in jsdom and exercising UI flows

## Pending artwork

The image generator capped at 10 files this session. Until the remaining five are generated
(next turn), placeholders stand in and hover angles self-remove:
`products/p10.png` (real shot), `promo.png`, `products/p1-alt.png`, `products/p3-alt.png`,
`products/p8-alt.png`.
