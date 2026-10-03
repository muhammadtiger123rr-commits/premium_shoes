from decimal import Decimal
from pathlib import Path
import re
import urllib.parse

from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import Cart, CartItem, Category, Product, Wishlist


class WishlistDBTests(TestCase):
    """Wishlist is per-user and persists in the database (no more
    localStorage). The /wishlist/toggle/<id>/ endpoint (POST) adds/removes the
    current user's saved products and /wishlist/ lists them."""

    def setUp(self):
        cat = Category.objects.create(name="Sneakers", slug="sneakers")
        self.p1 = Product.objects.create(
            name="Aero Run", category=cat, price="95.00", stock=10,
            sizes=["8", "9"],
            colors=[{"name": "Black", "hex": "#111111", "fam": "black"}],
        )
        self.p2 = Product.objects.create(
            name="Aero Court", category=cat, price="110.00", stock=4,
            sizes=["9"], colors=[],
        )
        self.u = User.objects.create_user(username="erin", password="secret1")
        self.c = self.client

    def login(self):
        return self.c.login(username="erin", password="secret1")

    def ajax(self):
        # The toggle endpoint only returns JSON to AJAX calls (the heart buttons
        # post through fetch with this header), matching the other endpoints.
        return {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}

    def toggle(self, pid):
        return self.c.post(
            reverse("wishlist_toggle", args=[pid]), **self.ajax()
        )

    def wished(self):
        return {
            p
            for p in Wishlist.objects.filter(user=self.u).values_list(
                "product_id", flat=True
            )
        }

    # ---------------- auth ----------------
    def test_anonymous_toggle_redirects_to_login(self):
        r = self.toggle(self.p1.id)
        self.assertEqual(r.status_code, 302)
        self.assertIn("login", r.url)

    def test_anonymous_page_redirects_to_login(self):
        r = self.c.get(reverse("wishlist"))
        self.assertEqual(r.status_code, 302)
        self.assertIn("login", r.url)

    # ---------------- add / remove ----------------
    def test_add_returns_added_and_count(self):
        self.assertTrue(self.login())
        r = self.toggle(self.p1.id)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": True, "added": True, "count": 1})
        self.assertEqual(self.wished(), {self.p1.id})

    def test_second_toggle_removes(self):
        self.assertTrue(self.login())
        self.toggle(self.p1.id)
        r = self.toggle(self.p1.id)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": True, "added": False, "count": 0})
        self.assertEqual(self.wished(), set())

    def test_many_toggles_never_duplicate_rows(self):
        self.assertTrue(self.login())
        for _ in range(5):
            self.toggle(self.p1.id)
        rows = Wishlist.objects.filter(user=self.u, product=self.p1).count()
        self.assertLessEqual(rows, 1)

    def test_wishlists_isolated_per_user(self):
        other = User.objects.create_user(username="zoe", password="secret2")
        Wishlist.objects.create(user=other, product=self.p1)
        self.assertTrue(self.login())
        self.toggle(self.p2.id)
        # Erin only ever sees her own saved P2, never Zoe's P1.
        self.assertEqual(self.wished(), {self.p2.id})
        self.assertEqual(Wishlist.objects.filter(user=other).count(), 1)

    # ---------------- page ----------------
    def test_page_lists_saved_products(self):
        self.assertTrue(self.login())
        self.toggle(self.p1.id)
        r = self.c.get(reverse("wishlist"))
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "wishlist.html")
        self.assertContains(r, "Aero Run")
        self.assertNotContains(r, "Aero Court")

    def test_page_empty_state(self):
        self.assertTrue(self.login())
        r = self.c.get(reverse("wishlist"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "wishlist is empty")

    def test_page_bootstrap_reflects_saved_state(self):
        self.assertTrue(self.login())
        self.toggle(self.p1.id)
        r = self.c.get(reverse("wishlist"))
        self.assertContains(r, "window.__WISHLIST = [" + str(self.p1.id) + "]")
        self.assertContains(r, "window.__WISHLIST_COUNT = 1")

    def test_remove_from_page_clears_row_and_count(self):
        self.assertTrue(self.login())
        self.toggle(self.p1.id)
        r = self.toggle(self.p1.id)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": True, "added": False, "count": 0})


class ShopCardQuickActionsTests(TestCase):
    """The shop/category cards must render both quick actions with the data the
    shared ui.js quick-view helper needs (Eye = quickview, Heart = wishlist):
    per-product wishlist toggle URLs, the quick-view data attributes, the
    page-wide wishlist bootstrap and never a duplicated type attribute."""

    def setUp(self):
        self.cat = Category.objects.create(
            name="Running", slug="running", description="Fast shoes."
        )
        self.p1 = Product.objects.create(
            name="Aero Run", category=self.cat, price="95.00", sale_price="85.00",
            stock=10, rating="4.8", reviews=12,
            gender="men", sport="running",
            sizes=["8", "9"],
            colors=[{"name": "Black", "hex": "#111111", "fam": "black"}],
            description="A bouncy daily trainer.",
        )
        # Sizeless style: validates the Eye still gets rendered and its modal
        # simply skips the size picker.
        self.p2 = Product.objects.create(
            name="Aero Court", category=self.cat, price="110.00", stock=4,
            gender="women", sport="sneakers",
            sizes=[], colors=[], rating="4.2", reviews=3,
            description="A hardcourt classic.",
        )
        self.u = User.objects.create_user(username="erin", password="secret1")
        self.c = self.client
        # The shop is behind the site-wide login, so browse it signed in.
        self.c.force_login(self.u)

    def toggle(self, pid):
        return self.c.post(
            reverse("wishlist_toggle", args=[pid]),
            **{"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}
        )

    # ---------------- shop ----------------
    def test_shop_renders_heart_and_eye_with_db_data(self):
        r = self.c.get(reverse("shop"))
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "shop.html")
        # Heart: real DB toggle endpoint per product.
        self.assertContains(r, f'data-action="wish" data-url="/wishlist/toggle/{self.p1.id}/" data-id="{self.p1.id}"')
        # Eye: per-card quick-view data the JS modal reads.
        self.assertContains(r, f'data-action="quickview" data-id="{self.p1.id}"')
        self.assertContains(r, 'data-reg="95.00"')
        self.assertContains(r, 'data-sizes="8,9"')
        self.assertContains(r, 'data-desc="A bouncy daily trainer."')
        self.assertContains(r, 'data-reviews="12"')
        self.assertContains(r, 'data-catlabel="Men · Running"')
        # Page-wide wishlist bootstrap used by JS-rendered hearts/quick views.
        self.assertContains(r, "window.__WISH_URL")

    def test_shop_card_duplicate_type_is_gone(self):
        r = self.c.get(reverse("shop"))
        self.assertNotContains(r, 'type="button" type="button"')
        # eye + heart per card, plus one button per colour swatch. Counting the
        # expected buttons rather than a magic number still catches a duplicated
        # type attribute, which would push the count above what the cards need.
        cards = r.content.count(b'class="pcard"')
        swatches = r.content.count(b'data-action="color"')
        self.assertEqual(r.content.count(b'type="button"'), cards * 2 + swatches)

    def test_shop_sale_price_flags_on_sale(self):
        r = self.c.get(reverse("shop"))
        # p1 is on sale: display (data-price) is the sale price, data-reg keeps
        # the regular price so the quick view can render the strikethrough.
        self.assertContains(r, 'data-price="85.00"')
        self.assertContains(r, 'data-reg="95.00"')

    def test_shop_sizeless_card_still_renders_quickview(self):
        r = self.c.get(reverse("shop"))
        self.assertContains(r, f'data-action="quickview" data-id="{self.p2.id}"')
        self.assertContains(r, 'data-sizes=""')
        self.assertContains(r, 'data-colors=""')
        self.assertContains(r, 'data-desc="A hardcourt classic."')

    def test_shop_bootstrap_reflects_saved_wishlist(self):
        self.c.login(username="erin", password="secret1")
        self.toggle(self.p1.id)
        r = self.c.get(reverse("shop"))
        self.assertContains(r, "window.__WISHLIST = [" + str(self.p1.id) + "]")
        self.assertContains(r, "window.__WISHLIST_COUNT = 1")
        # The saved product's heart renders in the "on" state.
        self.assertContains(r, f'class="qbtn on" data-action="wish" data-url="/wishlist/toggle/{self.p1.id}/"')

    # ---------------- category ----------------
    def test_category_renders_same_quick_actions(self):
        r = self.c.get(reverse("category", args=[self.cat.slug]))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, f'data-action="wish" data-url="/wishlist/toggle/{self.p1.id}/" data-id="{self.p1.id}"')
        self.assertContains(r, f'data-action="quickview" data-id="{self.p1.id}"')
        self.assertContains(r, 'data-desc="A bouncy daily trainer."')
        self.assertContains(r, "window.__WISH_URL")
        self.assertNotContains(r, 'type="button" type="button"')


class ShopPaginationTests(TestCase):
    """The shop grid is paginated by Django's Paginator, 8 styles to a page.

    The "Load More" button and its client-side hiding are gone: every page is a
    real server render carrying exactly 8 cards, the pager links Previous /
    page numbers / Next, and the sidebar filters live in the query string so
    they survive paging (and can reach products that live on another page).
    """

    def setUp(self):
        self.cat = Category.objects.create(
            name="Running", slug="running", description="Fast shoes."
        )
        self.styles = []
        for i in range(20):
            self.styles.append(Product.objects.create(
                name=f"Style {i:02d}", category=self.cat,
                price=f"{100 + i}.00", stock=5, rating="4.0", reviews=i,
                gender="men", sport="running",
                sizes=["9"] if i % 2 else ["8"],
                colors=[{"name": "Black", "hex": "#000000", "fam": "black"}],
            ))
        # The shop is behind the site-wide login, so browse it signed in.
        self.client.force_login(
            User.objects.create_user(username="raj", password="secret1")
        )

    def body(self, query=""):
        r = self.client.get(reverse("shop") + query)
        self.assertEqual(r.status_code, 200)
        return r.content.decode()

    def names(self, body):
        """The product names on the rendered page, in render order."""
        return re.findall(r'class="pcard-name"><a href="[^"]*">([^<]*)</a>', body)

    # ---------------- page size ----------------
    def test_first_page_holds_exactly_eight_styles(self):
        body = self.body()
        self.assertEqual(body.count('class="pcard"'), 8)
        self.assertIn("Showing 1–8 of 20 styles", body)

    def test_pages_split_the_catalogue_with_no_gaps_or_repeats(self):
        pages = [self.names(self.body("?page=%d" % n)) for n in (1, 2, 3)]
        self.assertEqual([len(p) for p in pages], [8, 8, 4])
        self.assertEqual(
            set().union(*pages), {p.name for p in self.styles}
        )
        self.assertFalse(set(pages[0]) & set(pages[1]))

    def test_a_page_beyond_the_end_falls_back_to_the_last_page(self):
        self.assertEqual(
            self.names(self.body("?page=99")), self.names(self.body("?page=3"))
        )

    def test_the_load_more_button_is_gone(self):
        body = self.body()
        self.assertNotIn("loadMore", body)
        self.assertNotIn("Load More", body)
        # The grid is marked as server-paginated for shop.js.
        self.assertIn('data-mode="page"', body)

    # ---------------- controls ----------------
    def test_page_one_disables_previous_and_links_next(self):
        body = self.body()
        self.assertIn(
            '<span class="pg-arrow off" aria-disabled="true">‹ Previous</span>',
            body,
        )
        self.assertIn('<span class="pg-num on" aria-current="page">1</span>', body)
        self.assertIn('<a class="pg-num" href="?page=2">2</a>', body)
        self.assertIn('rel="next"', body)
        self.assertNotIn('rel="prev"', body)

    def test_middle_page_links_both_arrows_and_its_own_number(self):
        body = self.body("?page=2")
        self.assertIn('<span class="pg-num on" aria-current="page">2</span>', body)
        self.assertIn('<a class="pg-num" href="?page=1">1</a>', body)
        self.assertIn('rel="prev"', body)
        self.assertIn('rel="next"', body)

    def test_a_long_run_of_pages_elides_the_middle(self):
        for i in range(20, 121):
            Product.objects.create(
                name=f"Bulk {i}", category=self.cat, price="150.00"
            )
        body = self.body("?page=6")
        self.assertIn('<span class="pg-gap">…</span>', body)
        self.assertIn('<span class="pg-num on" aria-current="page">6</span>', body)

    # ---------------- filters still work, across pages ----------------
    def test_search_is_applied_by_the_server(self):
        # "Style 1" is a substring of the ten "Style 1x" names.
        self.assertEqual(
            self.names(self.body("?q=Style 1")),
            ["Style 10", "Style 11", "Style 12", "Style 13",
             "Style 14", "Style 15", "Style 16", "Style 17"],
        )
        self.assertIn('id="fSearch" value="Style 1"', self.body("?q=Style 1"))

    def test_a_size_filter_reaches_products_on_another_page(self):
        # Only the 10 odd-numbered styles carry size 9, and the last two of
        # them can only be found by turning to page 2 - impossible while the
        # filter only ran over the eight cards of page 1.
        self.assertEqual(len(self.names(self.body("?size=9"))), 8)
        self.assertEqual(
            self.names(self.body("?size=9&page=2")), ["Style 17", "Style 19"]
        )

    def test_a_colour_filter_paginates_too(self):
        body = self.body("?color=black")
        self.assertIn("Showing 1–8 of 20 styles", body)
        self.assertEqual(len(self.names(self.body("?color=black&page=3"))), 4)

    def test_the_price_cap_and_sort_order_survive_paging(self):
        # Everything up to 105 keeps the six cheapest styles.
        self.assertEqual(
            self.names(self.body("?price=105")),
            ["Style 00", "Style 01", "Style 02", "Style 03", "Style 04", "Style 05"],
        )
        self.assertEqual(self.names(self.body("?sort=price-desc"))[0], "Style 19")
        self.assertIn('<option value="price-desc" selected>', self.body("?sort=price-desc"))

    def test_filters_are_carried_by_the_pager_links(self):
        body = self.body("?size=9&color=black&price=120&sort=price-desc&page=2")
        self.assertIn("size=9", body)
        self.assertIn("color=black", body)
        self.assertIn("price=120", body)
        self.assertIn("sort=price-desc", body)
        # Previous/Next keep every filter and only change the page.
        self.assertRegex(body, r'href="\?[^"]*size=9[^"]*page=1"[^>]*rel="prev"')

    def test_chips_toggle_their_own_value_and_keep_the_others(self):
        body = self.body("?q=services&size=9")
        # The active size chip drops itself, the others add themselves, and the
        # search term rides along either way.
        self.assertIn('class="chip on" data-size="9" href="?q=services"', body)
        self.assertIn('class="chip" data-size="8" href="?q=services&amp;size=8&amp;size=9"', body)

    def test_no_match_shows_the_empty_state_not_a_page(self):
        body = self.body("?q=zzzz")
        self.assertEqual(self.names(body), [])
        self.assertIn("No shoes match those filters", body)
        self.assertIn("0 styles", body)
        self.assertNotIn('class="pager"', body)


class QuickActionPageTransitionTests(TestCase):
    """Clicking a card's Eye or Heart must never blank the page.

    Both buttons are nested inside the card's product link, so the shared
    page-transition handler in ui.js used to see a plain anchor, add the
    "leaving" class (html.leaving fades body to opacity 0) and rely on a
    navigation that the quick-action handler then cancelled with
    preventDefault(). The class was never removed, leaving a permanently
    white page whose DOM was still present and hit-testable. The transition
    handler must therefore bail out on [data-action] clicks *before* it can
    reach the classList.add('leaving') call.
    """

    def setUp(self):
        cat = Category.objects.create(name="Running", slug="running")
        self.p1 = Product.objects.create(
            name="Aero Run", category=cat, price="95.00", stock=10,
            sizes=["8", "9"],
            colors=[{"name": "Black", "hex": "#111111", "fam": "black"}],
        )
        # The shop is behind the site-wide login, so browse it signed in.
        self.client.force_login(
            User.objects.create_user(username="tina", password="secret1")
        )
        self.ui_js = Path(settings.BASE_DIR) / "static" / "assets" / "js" / "ui.js"
        self.source = self.ui_js.read_text(encoding="utf-8")

    def _initPageTransitionBody(self):
        start = self.source.index("function initPageTransition()")
        end = self.source.index("\n  }", start)
        return self.source[start:end]

    def test_eye_and_heart_are_buttons_nested_in_the_card_link(self):
        """The precondition of the bug: the quick actions sit inside an <a>,
        which is what made the transition handler fire for them."""
        r = self.client.get(reverse("shop"))
        self.assertEqual(r.status_code, 200)
        body = r.content.decode()
        media = body[body.index('class="pcard-media"') :]
        self.assertIn('data-action="quickview"', media[: media.index("</a>")])
        self.assertIn('data-action="wish"', media[: media.index("</a>")])

    def test_page_transition_ignores_quick_action_clicks(self):
        body = self._initPageTransitionBody()
        self.assertIn("closest('[data-action]')", body)

    def test_quick_action_guard_precedes_the_leaving_class(self):
        """Ordering is the whole fix: the guard has to run before 'leaving' is
        ever added, otherwise the body still fades out."""
        body = self._initPageTransitionBody()
        guard = body.index("closest('[data-action]')")
        leaving = body.index("classList.add('leaving')")
        self.assertLess(guard, leaving)

    def test_transition_still_runs_for_real_links(self):
        """The guard must not disable the leave animation for genuine
        navigation (e.g. the product link or the modal's "Full details")."""
        body = self._initPageTransitionBody()
        self.assertIn("closest('a')", body)
        self.assertIn("e.defaultPrevented", body)
        self.assertIn("classList.add('leaving')", body)

    def test_wishlist_state_compares_ids_as_numbers(self):
        """data-id is a string but the server publishes window.__WISHLIST as
        JSON numbers, so a plain indexOf() never matched: removing an item
        left it in the array and the header badge showed a stale count."""
        self.assertNotIn("window.__WISHLIST.indexOf(pid)", self.source)
        self.assertIn("function wishIndex(pid)", self.source)
        # Both the read and the write path must go through the numeric helper.
        self.assertIn("return wishIndex(pid) !== -1;", self.source)
        set_wished = self.source[
            self.source.index("function setWished(") : self.source.index("function toggleWish(")
        ]
        self.assertIn("wishIndex(pid)", set_wished)
        self.assertIn("push(Number(pid))", set_wished)


class ProductColorSelectionTests(TestCase):
    """The product detail page must offer the product's colours and let the
    customer pick exactly one.

    Product.colors is stored in two shapes in this database - dicts
    ({"name": ..., "hex": ...}) and plain strings ("Ivory") - and the real
    seeded data even contains a blank entry. Both shapes must render, the hex
    is used when it is valid, the name is always visible (so a colour with no
    usable hex is still identifiable), and blank entries must not become
    mystery grey dots. The chosen colour is mirrored into window.PD.color by
    product.js for the next Cart stage."""

    def setUp(self):
        self.cat = Category.objects.create(name="Sneakers", slug="sneakers")
        # object-based colours, as products 1-3 are stored
        self.dict_colors = Product.objects.create(
            name="Aero Run", category=self.cat, price="95.00", stock=10,
            sizes=["8", "9"],
            colors=[
                {"name": "Black", "hex": "#000000"},
                {"name": "White", "hex": "#ffffff"},
                {"name": "Red", "hex": "#ff0000"},
            ],
        )
        # string-based colours with a blank entry, as product 9 is stored
        self.str_colors = Product.objects.create(
            name="Meridian Knit", category=self.cat, price="110.00", stock=4,
            sizes=["5", "6"], colors=["Ivory", ""],
        )
        # a colour name with no matching CSS colour in the name map
        self.unknown_hex = Product.objects.create(
            name="Mystery", category=self.cat, price="60.00", stock=2,
            colors=["Zorblax"],
        )
        # a dict that carries a name but no hex
        self.no_hex_key = Product.objects.create(
            name="NoHex", category=self.cat, price="70.00", stock=2,
            colors=[{"name": "Navy"}],
        )
        self.no_colors = Product.objects.create(
            name="Plain", category=self.cat, price="80.00", stock=3, colors=[],
        )
        # The product page is behind the site-wide login, so browse it signed in.
        self.client.force_login(
            User.objects.create_user(username="paula", password="secret1")
        )
        self.pd_js = Path(settings.BASE_DIR) / "static" / "assets" / "js" / "product.js"
        self.pd_source = self.pd_js.read_text(encoding="utf-8")

    def page(self, product):
        r = self.client.get(reverse("product", args=[product.id]))
        self.assertEqual(r.status_code, 200)
        return r.content.decode()

    # ---------------- shape 1: object-based colours ----------------
    def test_dict_colors_render_one_option_each(self):
        body = self.page(self.dict_colors)
        self.assertIn('data-color="Black" data-hex="#000000" data-i="0"', body)
        self.assertIn('data-color="White" data-hex="#ffffff" data-i="1"', body)
        self.assertIn('data-color="Red" data-hex="#ff0000" data-i="2"', body)
        self.assertEqual(body.count('class="color-choice'), 3)

    def test_dict_colors_show_the_hex_as_the_swatch_background(self):
        body = self.page(self.dict_colors)
        self.assertIn('<i class="color-dot" style="background:#000000">', body)
        self.assertIn('<i class="color-dot" style="background:#ff0000">', body)

    def test_dict_colors_show_the_name_as_readable_text(self):
        body = self.page(self.dict_colors)
        for name in ("Black", "White", "Red"):
            self.assertIn('<span class="color-name">%s</span>' % name, body)

    # ---------------- shape 2: string-based colours ----------------
    def test_string_colors_render_and_resolve_hex_from_the_name(self):
        body = self.page(self.str_colors)
        self.assertIn('data-color="Ivory" data-hex="#fffff0"', body)
        self.assertIn('<span class="color-name">Ivory</span>', body)
        self.assertEqual(body.count('class="color-choice'), 1)

    def test_blank_color_entry_is_dropped_not_rendered_as_grey_dot(self):
        """Product 9 stores ['Ivory', '']; the blank entry used to render an
        unidentifiable grey dot called "Color"."""
        body = self.page(self.str_colors)
        self.assertNotIn('data-color="Color"', body)
        self.assertNotIn('data-color=""', body)
        self.assertNotIn("background:#9d9d9d", body)
        self.assertIn('id="colorLabel">Ivory<', body)

    # ---------------- hex fallback keeps the name readable ----------------
    def test_unmapped_name_falls_back_to_a_hex_but_keeps_the_name(self):
        body = self.page(self.unknown_hex)
        self.assertIn('<span class="color-name">Zorblax</span>', body)
        self.assertIn('id="colorLabel">Zorblax<', body)
        self.assertIn("background:#9d9d9d", body)  # documented neutral fallback

    def test_dict_without_hex_key_resolves_from_the_name(self):
        body = self.page(self.no_hex_key)
        self.assertIn('data-color="Navy" data-hex="#000080"', body)
        self.assertIn('<span class="color-name">Navy</span>', body)

    # ---------------- exactly one selection ----------------
    def test_exactly_one_option_is_pre_selected(self):
        for product in (self.dict_colors, self.str_colors, self.unknown_hex):
            body = self.page(product)
            with self.subTest(product=product.name):
                self.assertEqual(body.count('class="color-choice on"'), 1)
                self.assertEqual(body.count('aria-pressed="true"'), 1)
                self.assertEqual(
                    body.count('aria-pressed="false"'),
                    body.count('class="color-choice') - 1,
                )

    def test_color_row_is_a_labelled_single_select_group(self):
        body = self.page(self.dict_colors)
        self.assertIn('id="colorRow" role="group" aria-labelledby="colorLbl"', body)
        self.assertIn('id="colorLbl">Color <span id="colorLabel">Black<', body)

    def test_options_are_real_buttons(self):
        body = self.page(self.dict_colors)
        self.assertEqual(body.count('<button type="button" class="color-choice'), 3)

    # ---------------- products without colours ----------------
    def test_product_without_colors_renders_no_color_section(self):
        body = self.page(self.no_colors)
        self.assertNotIn('id="colorRow"', body)
        self.assertNotIn('id="colorSec"', body)
        self.assertNotIn("color-choice", body)
        # the rest of the page is unaffected
        self.assertIn('id="sizeRow"', body)
        self.assertIn('id="addBtn"', body)

    # ---------------- nothing else on the page changed ----------------
    def test_size_qty_and_cta_are_untouched(self):
        body = self.page(self.dict_colors)
        self.assertIn('data-size="8"', body)
        self.assertIn('data-size="9"', body)
        self.assertIn('id="qtyMinus"', body)
        self.assertIn('id="qtyPlus"', body)
        self.assertIn('id="qtyVal">1<', body)
        self.assertIn('id="addBtn"', body)
        self.assertIn('id="buyBtn"', body)
        self.assertIn('window.__ADD_URL = "/cart/add/%d/"' % self.dict_colors.id, body)
        self.assertIn('id="wishBtn" data-action="wish"', body)

    def test_other_pages_are_unaffected(self):
        for url in (reverse("shop"), reverse("home"),
                    reverse("category", args=[self.cat.slug])):
            with self.subTest(url=url):
                r = self.client.get(url)
                self.assertEqual(r.status_code, 200)
                # the picker markup belongs to the product page only
                self.assertNotIn("color-choice", r.content.decode())

    # ---------------- selected colour is stored for the Cart stage ----------
    def test_product_js_exposes_the_selected_color_in_pd_state(self):
        """window.PD is the hand-off point the next Cart stage reads."""
        self.assertIn("window.PD = PD;", self.pd_source)
        self.assertIn("var PD = {", self.pd_source)
        for key in ("color: null", "size: ''", "quantity: 1"):
            self.assertIn(key, self.pd_source)
        self.assertIn("PD.color = {", self.pd_source)
        self.assertIn("name: btn.dataset.color", self.pd_source)
        self.assertIn("hex: btn.dataset.hex", self.pd_source)
        self.assertIn("index: parseInt(btn.dataset.i, 10)", self.pd_source)

    def test_product_js_enforces_single_selection(self):
        """Every option is cleared, then only the clicked one is marked, both
        visually (.on) and for assistive tech (aria-pressed)."""
        select = self.pd_source[
            self.pd_source.index("function selectColor("):self.pd_source.index(
                "/* ---------------- size select")
        ]
        self.assertIn("var on = x === btn;", select)
        self.assertIn("x.classList.toggle('on', on)", select)
        self.assertIn("x.setAttribute('aria-pressed', on ? 'true' : 'false')", select)
        self.assertIn("closest('.color-choice')", select)

    def test_product_js_seeds_pd_color_from_the_preselected_option(self):
        """The server pre-selects the first colour, so PD.color is populated
        before the customer interacts with anything."""
        self.assertIn("colorRow.querySelector('.color-choice.on')", self.pd_source)
        self.assertIn("if (initialColor) selectColor(initialColor);", self.pd_source)

    def test_product_js_does_not_post_the_color_yet(self):
        """Superseded by Stage 3 (Cart Color + Size Integration).

        Kept as a reminder of the stage boundary: Stage 2 stored the choice in
        window.PD only. addToCartDB now DOES post it, which
        CartColorIntegrationTests::test_ui_js_posts_the_color_field locks in.
        """
        self.skipTest("Stage 3: the selected color is now sent with Add to Cart")


class CartColorIntegrationTests(TestCase):
    """The colour chosen on the Product Detail page must travel with the add
    and be stored on the cart line next to the product, size and quantity.

    CartItem.color is a blank-able CharField (default ""), and cart uniqueness
    is (cart, product, size, color). So:

      * the same shoe in a different colour becomes its own line;
      * the same shoe in the same colour but a different size is its own line;
      * an identical colour + size adds into the existing line instead;
      * rows that predate colours (color = "") keep working, merging and
        rendering exactly as they did before.
    """

    def setUp(self):
        self.cat = Category.objects.create(name="Sneakers", slug="sneakers")
        self.p = Product.objects.create(
            name="Aero Run", category=self.cat, price="100.00", stock=50,
            sizes=["8", "9", "10"],
            colors=[
                {"name": "Black", "hex": "#000000"},
                {"name": "White", "hex": "#ffffff"},
                {"name": "Red", "hex": "#ff0000"},
            ],
        )
        # A sizeless, colourless style - the product-card quick-add path.
        self.plain = Product.objects.create(
            name="Plain Slip", category=self.cat, price="40.00", stock=20,
            sizes=[], colors=[],
        )
        self.u = User.objects.create_user(username="buyer", email="buyer@example.com",
                                          password="pw12345!")
        self.other = User.objects.create_user(username="someone", email="s@example.com",
                                              password="pw12345!")
        self.client.force_login(self.u)
        self.ui_js = (Path(settings.BASE_DIR) / "static" / "assets" / "js"
                      / "ui.js").read_text(encoding="utf-8")
        self.pd_js = (Path(settings.BASE_DIR) / "static" / "assets" / "js"
                      / "product.js").read_text(encoding="utf-8")

    # ---------------- helpers ----------------
    def add(self, product=None, size="", color="", quantity=1):
        product = product or self.p
        return self.client.post(
            reverse("add_to_cart", args=[product.id]),
            {"size": size, "color": color, "quantity": quantity},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

    def lines(self):
        return list(CartItem.objects.filter(cart__user=self.u).order_by("id"))

    # ---------------- colour is stored with the line ----------------
    def test_add_to_cart_stores_the_selected_color(self):
        r = self.add(size="9", color="Red", quantity=2)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ok"])
        item = self.lines()[0]
        self.assertEqual(item.product, self.p)
        self.assertEqual(item.size, "9")
        self.assertEqual(item.color, "Red")
        self.assertEqual(item.quantity, 2)

    def test_json_response_echoes_size_and_color(self):
        data = self.add(size="9", color="White", quantity=1).json()
        self.assertEqual(data["color"], "White")
        self.assertEqual(data["size"], "9")
        self.assertEqual(data["quantity"], 1)
        self.assertEqual(data["count"], 1)

    def test_color_is_stored_for_both_stored_color_shapes(self):
        """The same product field shape must not change cart behaviour."""
        dict_product = Product.objects.create(
            name="Dict", category=self.cat, price="50.00", stock=5,
            sizes=["7"], colors=[{"name": "Navy", "hex": "#000080"}],
        )
        str_product = Product.objects.create(
            name="Str", category=self.cat, price="50.00", stock=5,
            sizes=["7"], colors=["Ivory", ""],
        )
        self.add(product=dict_product, size="7", color="Navy")
        self.add(product=str_product, size="7", color="Ivory")
        self.assertEqual(self.lines()[0].color, "Navy")
        self.assertEqual(self.lines()[1].color, "Ivory")

    # ---------------- uniqueness distinguishes the combinations ----------
    def test_same_product_different_colors_are_separate_lines(self):
        self.add(size="9", color="Black", quantity=1)
        self.add(size="9", color="Red", quantity=1)
        self.add(size="9", color="White", quantity=1)
        lines = self.lines()
        self.assertEqual(len(lines), 3)
        self.assertEqual([li.color for li in lines], ["Black", "Red", "White"])
        self.assertTrue(all(li.quantity == 1 for li in lines))

    def test_same_color_different_sizes_are_separate_lines(self):
        self.add(size="8", color="Black", quantity=1)
        self.add(size="9", color="Black", quantity=2)
        self.add(size="10", color="Black", quantity=1)
        lines = self.lines()
        self.assertEqual(len(lines), 3)
        self.assertEqual([(li.size, li.quantity) for li in lines],
                         [("8", 1), ("9", 2), ("10", 1)])
        self.assertTrue(all(li.color == "Black" for li in lines))

    def test_identical_color_and_size_merges_into_one_line(self):
        self.add(size="9", color="Red", quantity=2)
        self.add(size="9", color="Red", quantity=3)
        lines = self.lines()
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].quantity, 5)

    def test_full_matrix_of_color_size_pairs_stays_distinct(self):
        for color in ("Black", "White", "Red"):
            for size in ("8", "9", "10"):
                self.add(size=size, color=color, quantity=1)
        self.assertEqual(len(self.lines()), 9)
        self.assertEqual(len({(li.color, li.size) for li in self.lines()}), 9)

    def test_unique_together_includes_color(self):
        meta = CartItem._meta
        self.assertIn(("cart", "product", "size", "color"), meta.unique_together)

    def test_database_rejects_a_duplicate_color_size_line(self):
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p, size="9", color="Red", quantity=1)
        with self.assertRaises(IntegrityError):
            CartItem.objects.create(cart=cart, product=self.p, size="9",
                                    color="Red", quantity=1)

    def test_carts_stay_isolated_per_user(self):
        self.add(size="9", color="Red")
        self.client.force_login(self.other)
        self.add(size="9", color="Red")
        self.assertEqual(CartItem.objects.filter(cart__user=self.u).count(), 1)
        self.assertEqual(CartItem.objects.filter(cart__user=self.other).count(), 1)

    # ---------------- validation ----------------
    def test_color_not_offered_by_the_product_is_rejected(self):
        r = self.add(size="9", color="Chartreuse")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.json()["ok"])
        self.assertIn("color", r.json()["errors"])
        self.assertEqual(CartItem.objects.count(), 0)

    def test_color_from_a_different_product_is_rejected(self):
        other_product = Product.objects.create(
            name="Other", category=self.cat, price="50.00", stock=5,
            sizes=["9"], colors=["Chartreuse"],
        )
        self.add(size="9", color="Chartreuse")  # rejected for self.p
        self.assertEqual(CartItem.objects.count(), 0)
        r = self.add(product=other_product, size="9", color="Chartreuse")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.lines()[0].color, "Chartreuse")

    def test_invalid_size_still_rejected_alongside_a_valid_color(self):
        r = self.add(size="99", color="Red")
        self.assertEqual(r.status_code, 400)
        self.assertIn("size", r.json()["errors"])
        self.assertEqual(CartItem.objects.count(), 0)

    def test_invalid_quantity_still_rejected_alongside_a_valid_color(self):
        r = self.add(size="9", color="Red", quantity=0)
        self.assertEqual(r.status_code, 400)
        self.assertIn("quantity", r.json()["errors"])

    def test_missing_color_field_is_treated_as_no_color(self):
        """Product cards post no color at all; that must not error."""
        r = self.client.post(
            reverse("add_to_cart", args=[self.p.id]),
            {"size": "9", "quantity": 1},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.lines()[0].color, "")

    def test_blank_color_is_treated_as_no_color(self):
        self.add(size="9", color="   ")
        self.assertEqual(self.lines()[0].color, "")

    # ---------------- legacy rows without a colour ----------------
    def test_existing_colourless_item_still_merges_and_displays(self):
        """A row created before colours existed (color = "") keeps working:
        a colourless add finds it and bumps it, exactly as pre-Stage-3."""
        cart = Cart.objects.create(user=self.u)
        legacy = CartItem.objects.create(
            cart=cart, product=self.p, size="9", color="", quantity=1
        )
        self.add(size="9", quantity=2)
        self.assertEqual(CartItem.objects.count(), 1)
        legacy.refresh_from_db()
        self.assertEqual(legacy.quantity, 3)
        self.assertEqual(legacy.color, "")

    def test_legacy_item_shows_no_color_on_the_cart_page(self):
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p, size="9", quantity=2)
        body = self.client.get(reverse("cart")).content.decode()
        self.assertNotIn('class="cr-color"', body)
        self.assertNotIn("cr-swatch", body)
        self.assertIn("US 9", body)
        # the row still shows the product, price and quantity as before
        self.assertIn("Aero Run", body)
        self.assertIn("$200", body)  # line total 2 x 100

    def test_a_colour_add_does_not_merge_into_a_legacy_line(self):
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p, size="9", color="", quantity=1)
        self.add(size="9", color="Red", quantity=1)
        lines = self.lines()
        self.assertEqual(len(lines), 2)
        self.assertEqual({li.color for li in lines}, {"", "Red"})

    def test_sizeless_colourless_product_still_adds(self):
        r = self.add(product=self.plain, quantity=1)
        self.assertEqual(r.status_code, 200)
        item = self.lines()[0]
        self.assertEqual((item.size, item.color, item.quantity), ("", "", 1))
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn("One Size", body)
        self.assertNotIn('class="cr-color"', body)

    def test_colour_that_the_product_no_longer_offers_shows_name_without_swatch(self):
        """Old cart rows survive even if the product's colour list changes."""
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p, size="9",
                                color="Chartreuse", quantity=1)
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn("Chartreuse", body)
        self.assertNotIn("cr-swatch", body)  # no dot invented for an unknown colour

    # ---------------- cart page display ----------------
    def test_cart_page_shows_the_stored_color_with_a_swatch(self):
        self.add(size="9", color="Red", quantity=1)
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn('<span class="cr-color">', body)
        self.assertIn('class="cr-swatch" style="background:#ff0000"', body)
        self.assertIn("Red", body)

    def test_cart_page_shows_every_colored_line(self):
        self.add(size="8", color="Black")
        self.add(size="9", color="White")
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn("Black", body)
        self.assertIn("White", body)
        self.assertIn("background:#000000", body)
        self.assertIn("background:#ffffff", body)

    def test_totals_are_unchanged_by_the_color_column(self):
        self.add(size="8", color="Black", quantity=1)
        self.add(size="9", color="White", quantity=1)
        page = self.client.get(reverse("cart")).context
        self.assertEqual(page["subtotal"], Decimal("200.00"))
        # 200 is over the 150 threshold, so shipping stays free
        self.assertEqual(page["shipping"], Decimal("0.00"))
        self.assertEqual(page["total"], Decimal("200.00"))

    def test_shipping_charges_below_the_threshold_with_colour_lines(self):
        cheap = Product.objects.create(
            name="Cheap", category=self.cat, price="40.00", stock=5,
            sizes=["7"], colors=["Ivory"],
        )
        self.add(product=cheap, size="7", color="Ivory", quantity=1)
        page = self.client.get(reverse("cart")).context
        self.assertEqual(page["subtotal"], Decimal("40.00"))
        self.assertEqual(page["shipping"], Decimal("12.00"))
        self.assertEqual(page["total"], Decimal("52.00"))

    def test_free_shipping_threshold_still_applies(self):
        self.add(size="8", color="Black", quantity=2)  # 200 > 150
        page = self.client.get(reverse("cart")).context
        self.assertEqual(page["shipping"], Decimal("0.00"))
        self.assertEqual(page["total"], Decimal("200.00"))

    # ---------------- quantity / remove / clear still work ----------------
    def test_quantity_increase_decreases_and_removes(self):
        self.add(size="9", color="Red", quantity=2)
        item = self.lines()[0]
        url = reverse("cart_update", args=[item.id])

        def step(action):
            r = self.client.post(url, {"action": action},
                                 HTTP_X_REQUESTED_WITH="XMLHttpRequest")
            self.assertTrue(r.json()["ok"])
            return r.json()

        data = step("inc")
        item.refresh_from_db()
        self.assertEqual(item.quantity, 3)
        self.assertEqual(data["quantity"], 3)
        self.assertEqual(data["line_total"], "300.00")

        step("dec")
        item.refresh_from_db()
        self.assertEqual(item.quantity, 2)

        # 2 -> 1 keeps the line, then the next dec removes it (the cart's
        # "below 1 removes" rule) and the colour goes with it.
        step("dec")
        item.refresh_from_db()
        self.assertEqual(item.quantity, 1)
        self.assertEqual(item.color, "Red")
        # the next dec hits the "below 1 removes" rule: the line and its
        # colour are deleted, and the JSON reports it
        removal = step("dec")
        self.assertTrue(removal["removed"])
        self.assertIsNone(removal["quantity"])
        self.assertEqual(CartItem.objects.count(), 0)

    def test_increasing_one_color_does_not_touch_a_sibling_line(self):
        self.add(size="9", color="Black", quantity=1)
        self.add(size="9", color="Red", quantity=1)
        black, red = self.lines()
        self.client.post(reverse("cart_update", args=[black.id]), {"action": "inc"},
                         HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        black.refresh_from_db()
        red.refresh_from_db()
        self.assertEqual((black.quantity, red.quantity), (2, 1))
        self.assertEqual((black.color, red.color), ("Black", "Red"))

    def test_remove_only_deletes_that_color_line(self):
        self.add(size="9", color="Black")
        self.add(size="9", color="Red")
        black, red = self.lines()
        self.client.post(reverse("cart_remove", args=[black.id]))
        remaining = self.lines()
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0].color, "Red")

    def test_cannot_remove_another_users_line(self):
        self.add(size="9", color="Red")
        item = self.lines()[0]
        self.client.force_login(self.other)
        self.client.post(reverse("cart_remove", args=[item.id]))
        self.assertEqual(CartItem.objects.filter(id=item.id).exists(), True)

    def test_clear_cart_removes_every_colored_line(self):
        self.add(size="8", color="Black")
        self.add(size="9", color="Red")
        self.add(size="10", color="White")
        self.assertEqual(CartItem.objects.count(), 3)
        self.client.post(reverse("cart_clear"))
        self.assertEqual(CartItem.objects.count(), 0)

    def test_cart_update_json_totals_include_all_colored_lines(self):
        self.add(size="8", color="Black", quantity=1)
        self.add(size="9", color="Red", quantity=2)
        item = self.lines()[0]
        data = self.client.post(reverse("cart_update", args=[item.id]), {"action": "inc"},
                                HTTP_X_REQUESTED_WITH="XMLHttpRequest").json()
        self.assertEqual(data["subtotal"], "400.00")
        self.assertEqual(data["total"], "400.00")
        self.assertEqual(data["cart_count"], 4)

    def test_badge_context_counts_every_colored_line(self):
        self.add(size="8", color="Black", quantity=2)
        self.add(size="9", color="Red", quantity=3)
        from myapp.context_processors import cart_count

        class FakeRequest:
            user = self.u

        self.assertEqual(cart_count(FakeRequest())["cart_count"], 5)

    # ---------------- Buy Now sends the colour ----------------
    def test_buy_now_uses_the_same_add_endpoint_so_the_colour_is_stored(self):
        """Buy Now is a client-side call to the same add_to_cart view, so the
        colour it posts lands in the cart exactly like Add to Cart."""
        self.add(size="9", color="White", quantity=1)
        self.assertEqual(self.lines()[0].color, "White")

    # ---------------- JS contract ----------------
    def test_ui_js_posts_the_color_field(self):
        body = self.ui_js[
            self.ui_js.index("function addToCartDB("):self.ui_js.index(
                "function syncCartBadge(")
        ]
        self.assertIn("if (opts.color) params.append('color', opts.color);", body)

    def test_product_js_sends_pd_color_on_add_and_buy_now(self):
        add = self.pd_js[
            self.pd_js.index("/* ---------------- add to cart (Django)"):self.pd_js.index(
                "/* ---------------- buy now (Django)")
        ]
        buy = self.pd_js[
            self.pd_js.index("/* ---------------- buy now (Django)"):self.pd_js.index(
                "/* ---------------- gallery thumbs")
        ]
        for name, block in (("add to cart", add), ("buy now", buy)):
            with self.subTest(flow=name):
                self.assertIn("var color = PD.color ? PD.color.name : '';", block)
                self.assertIn("{ size: size, color: color, quantity: quantity }", block)

    def test_cart_template_keeps_the_existing_row_markup(self):
        """The colour is added inside the existing variant line, so the row
        design (image, name, variant, stepper, price, remove) is unchanged."""
        tpl = (Path(settings.BASE_DIR) / "templates" / "cart.html").read_text(encoding="utf-8")
        self.assertIn('class="cr-variant"', tpl)
        self.assertIn('{{ item.size|default:"One Size" }}', tpl)
        self.assertIn('class="qty-stepper"', tpl)
        self.assertIn('class="cr-price"', tpl)
        self.assertIn("cart_remove", tpl)
        self.assertIn("cart_clear", tpl)
        # the colour is conditional so legacy rows render exactly as before
        self.assertIn("{% if item.color %}", tpl)
        self.assertIn("{% if item.color_hex %}", tpl)

    def test_string_representation_mentions_the_color(self):
        cart = Cart.objects.create(user=self.u)
        self.assertIn("Red", str(CartItem(cart=cart, product=self.p, size="9",
                                          color="Red", quantity=1)))
        self.assertIn("any size", str(CartItem(cart=cart, product=self.p, color="")))


class QuickAddColorSelectionTests(TestCase):
    """The two shop-level add flows - the product-card "Add to Cart" button and
    the Quick View dialog - must let the customer choose a colour and send it to
    the same add_to_cart endpoint, so it is stored on the cart line and shown on
    the cart page.

    Both flows reuse the product's own colour data and the existing product-page
    swatch UI. Nothing is ever pre-selected: the first colour is never chosen on
    the customer's behalf. Styles with no colours are untouched and still add
    colourlessly, and size/quantity behaviour is unchanged.
    """

    def setUp(self):
        self.cat = Category.objects.create(name="Sneakers", slug="sneakers")
        self.p = Product.objects.create(
            name="Aero Run", category=self.cat, price="100.00", stock=50,
            sizes=["8", "9", "10"],
            colors=[
                {"name": "Black", "hex": "#000000"},
                {"name": "White", "hex": "#ffffff"},
                {"name": "Red", "hex": "#ff0000"},
            ],
        )
        # A colourless style - its card must look and behave exactly as before.
        self.plain = Product.objects.create(
            name="Plain Slip", category=self.cat, price="40.00", stock=20,
            sizes=[], colors=[],
        )
        self.u = User.objects.create_user(username="buyer", email="buyer@example.com",
                                          password="pw12345!")
        self.client.force_login(self.u)
        self.ui_js = (Path(settings.BASE_DIR) / "static" / "assets" / "js"
                      / "ui.js").read_text(encoding="utf-8")

    # ---------------- helpers ----------------
    def card_for(self, product):
        """The rendered .pcard markup for one product, so an assertion is
        scoped to that card and not to every card on the page."""
        body = self.client.get(reverse("shop")).content.decode()
        start = body.index('data-id="%s"' % product.id)
        start = body.rindex("<article", 0, start)
        return body[start:body.index("</article>", start)]

    def quick_add(self, product=None, color=""):
        """What the card button and the Quick View dialog both POST."""
        product = product or self.p
        return self.client.post(
            reverse("add_to_cart", args=[product.id]),
            {"color": color, "quantity": 1},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

    # ---------------- the card picker ----------------
    def test_card_renders_one_swatch_per_colour(self):
        card = self.card_for(self.p)
        self.assertIn('class="pcard-colors"', card)
        for name, hexv in (("Black", "#000000"), ("White", "#ffffff"), ("Red", "#ff0000")):
            with self.subTest(color=name):
                self.assertIn('data-color="%s"' % name, card)
                self.assertIn("background:%s" % hexv, card)

    def test_card_never_preselects_a_colour(self):
        """The first swatch must not be chosen for the customer."""
        card = self.card_for(self.p)
        self.assertNotIn("color-dot on", card)
        self.assertNotIn('aria-pressed="true"', card)
        # all three swatches ship unselected
        self.assertEqual(card.count('aria-pressed="false"'), 3)

    def test_colourless_card_has_no_colour_picker(self):
        card = self.card_for(self.plain)
        self.assertNotIn("pcard-colors", card)
        self.assertNotIn("data-color=", card)

    # ---------------- what reaches the endpoint ----------------
    def test_chosen_colour_is_stored_and_shown_in_the_cart(self):
        r = self.quick_add(color="Red")
        self.assertEqual(r.status_code, 200)
        item = CartItem.objects.get()
        self.assertEqual(item.color, "Red")
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn('<span class="cr-color">', body)
        self.assertIn('class="cr-swatch" style="background:#ff0000"', body)
        self.assertIn("Red", body)

    def test_two_different_colours_become_two_cart_lines(self):
        self.quick_add(color="Red")
        self.quick_add(color="White")
        self.assertEqual({li.color for li in CartItem.objects.all()}, {"Red", "White"})
        body = self.client.get(reverse("cart")).content.decode()
        for label in ("Red", "White", "background:#ff0000", "background:#ffffff"):
            with self.subTest(shown=label):
                self.assertIn(label, body)

    def test_colourless_style_still_adds_and_stays_colourless(self):
        r = self.quick_add(product=self.plain, color="")
        self.assertEqual(r.status_code, 200)
        item = CartItem.objects.get()
        self.assertEqual((item.color, item.size), ("", ""))
        body = self.client.get(reverse("cart")).content.decode()
        self.assertIn("One Size", body)
        self.assertNotIn('class="cr-color"', body)

    def test_legacy_colourless_row_renders_exactly_as_before(self):
        """A row that predates colours is untouched by the new pickers."""
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p, size="9", quantity=2)
        body = self.client.get(reverse("cart")).content.decode()
        self.assertNotIn('class="cr-color"', body)
        self.assertNotIn("cr-swatch", body)
        self.assertIn("US 9", body)
        self.assertIn("Aero Run", body)

    # ---------------- the flows really send it ----------------
    def test_card_quick_add_sends_the_chosen_colour(self):
        block = self.ui_js[self.ui_js.index("function cardAdd"):
                            self.ui_js.index("function findWishURL")]
        self.assertIn("var color = card ? chosenColor(card) : '';", block)
        # the add is held back until a swatch is picked, never defaulted
        self.assertIn("if (hasColorPicker(card) && !color) { showColorErr(card); return; }", block)
        self.assertIn("addToCartDB(pid, url, { color: color, quantity: 1 })", block)

    def test_card_quick_add_keeps_its_size_and_quantity_behaviour(self):
        block = self.ui_js[self.ui_js.index("function cardAdd"):
                            self.ui_js.index("function findWishURL")]
        # unchanged: the card still sends no size and always one item
        self.assertNotIn("size:", block)

    def test_quick_view_sends_the_chosen_colour(self):
        block = self.ui_js[self.ui_js.index("function quickView"):
                            self.ui_js.index("function closeModal")]
        self.assertIn("qv-colors", block)
        self.assertIn("if (colorScope && !color) { showColorErr(colorScope); return; }", block)
        self.assertIn("{ size: size || '', color: color, quantity: 1 }", block)

    def test_quick_view_keeps_its_size_requirement(self):
        block = self.ui_js[self.ui_js.index("function quickView"):
                            self.ui_js.index("function closeModal")]
        self.assertIn("if (sizes.length && !size)", block)

    def test_no_flow_falls_back_to_the_first_colour(self):
        """The Quick View guest path used to hard-code colours[0]."""
        self.assertNotIn("p.colors[0].name", self.ui_js)
        self.assertNotIn('class="color-choice on"', self.ui_js)

    def test_picker_marks_the_clicked_swatch_pressed(self):
        block = self.ui_js[self.ui_js.index("function pickColor"):
                            self.ui_js.index("function chosenColor")]
        self.assertIn("x.setAttribute('aria-pressed', on ? 'true' : 'false');", block)


class SiteLoginRequiredTests(TestCase):
    """The whole storefront sits behind the login.

    Home, shop, category and product were the only pages a visitor could reach
    without an account; they now redirect anonymous visitors to the login page
    like every other page. Login/register/logout stay reachable so nobody can
    be trapped, and the existing "next" handling returns the visitor to the page
    they actually asked for."""

    def setUp(self):
        self.cat = Category.objects.create(name="Running", slug="running")
        self.p = Product.objects.create(
            name="Aero Run", category=self.cat, price="95.00", stock=10,
            sizes=["8", "9"],
            colors=[{"name": "Black", "hex": "#111111", "fam": "black"}],
        )
        self.u = User.objects.create_user(
            username="nina", email="nina@example.com", password="secret1"
        )
        self.login_url = reverse("login")

    def protected(self):
        return [
            reverse("home"),
            reverse("shop"),
            reverse("category", args=[self.cat.slug]),
            reverse("product", args=[self.p.id]),
        ]

    # ---------------- anonymous visitors are sent to the login page --------
    def test_public_pages_redirect_anonymous_visitors(self):
        for url in self.protected():
            with self.subTest(url=url):
                r = self.client.get(url)
                self.assertRedirects(r, self.login_url + f"?next={url}")

    def test_login_page_is_never_served_as_a_redirect(self):
        """No loop: the login page itself must stay reachable."""
        r = self.client.get(self.login_url)
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "login.html")

    def test_register_page_stays_reachable(self):
        r = self.client.get(reverse("register"))
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "register.html")

    def test_login_carries_the_visited_page_forward(self):
        """Logging in lands back on the page that was originally requested."""
        target = reverse("product", args=[self.p.id])
        r = self.client.post(
            self.login_url + f"?next={target}",
            {"email": "nina@example.com", "password": "secret1"},
        )
        self.assertRedirects(r, target)
        self.assertEqual(self.client.get(target).status_code, 200)

    def test_signup_still_works_without_an_account(self):
        r = self.client.post(reverse("register"), {
            "name": "Nina Novak", "username": "ninovanovak",
            "email": "nina2@example.com",
            "password": "secret1", "password2": "secret1",
        })
        self.assertRedirects(r, self.login_url)

    # ---------------- signed-in visitors are unaffected --------------------
    def test_signed_in_visitors_reach_every_page(self):
        self.client.force_login(self.u)
        for url in self.protected():
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_signed_in_visitors_skip_the_login_page(self):
        self.client.force_login(self.u)
        self.assertRedirects(self.client.get(self.login_url), reverse("home"))

    def test_logout_returns_to_the_login_page(self):
        self.client.force_login(self.u)
        self.assertEqual(self.client.get(reverse("logout")).status_code, 302)
        self.assertEqual(self.client.get(reverse("home")).status_code, 302)

    # ---------------- no direct-URL bypass ---------------------------------
    def test_posting_to_a_protected_page_does_not_bypass_the_login(self):
        r = self.client.post(reverse("add_to_cart", args=[self.p.id]), {
            "size": "9", "quantity": 1,
        })
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r["Location"].startswith(self.login_url))
        self.assertFalse(CartItem.objects.filter(cart__user=self.u).exists())


@override_settings(SOCIALACCOUNT_PROVIDERS={
    "google": {
        "APP": {
            "client_id": "test-client-id.apps.googleusercontent.com",
            "secret": "test-client-secret",
            "key": "",
        },
    },
})
class GoogleLoginButtonTests(TestCase):
    """The login page offers "Continue with Google" as a real allauth POST.

    allauth's OAuth2 view only starts the handshake on POST - its
    SOCIALACCOUNT_LOGIN_ON_GET defaults to False, so a plain GET renders an
    intermediate page instead of redirecting to Google. The button therefore has
    to be a <form method="post"> aimed at allauth's own view rather than a link.
    The credentials stay in settings, so the template hard-codes nothing."""

    def google_form(self, url=None):
        """The Google form's own markup, cut out of the rendered login page."""
        body = self.client.get(url or reverse("login")).content.decode()
        block = body[body.index("auth-or"):]
        return block[block.index("<form"): block.index("</form>")]

    # ---------------- it renders ----------------
    def test_login_page_offers_the_button(self):
        r = self.client.get(reverse("login"))
        self.assertEqual(r.status_code, 200)
        self.assertTemplateUsed(r, "login.html")
        body = r.content.decode()
        self.assertIn("Continue with Google", body)
        self.assertIn('action="/accounts/google/login/"', body)
        self.assertIn('class="btn btn-ghost btn-lg btn-block btn-google"', body)

    def test_the_button_posts_to_allauth_with_a_csrf_token(self):
        form = self.google_form()
        self.assertIn('method="post"', form)
        self.assertIn("csrfmiddlewaretoken", form)
        self.assertIn('type="submit"', form)

    def test_the_button_reuses_the_existing_button_design(self):
        """No new button styling: it is built from the shared .btn classes."""
        form = self.google_form()
        for cls in ("btn", "btn-ghost", "btn-lg", "btn-block"):
            self.assertIn(cls, form)
        # The divider between the two forms is the only new style rule.
        body = self.client.get(reverse("login")).content.decode()
        self.assertIn('<p class="auth-or">or</p>', body)
        self.assertLess(
            body.index('class="auth-or"'),
            body.index(reverse("google_login")),
        )

    def test_the_template_hard_codes_no_credentials_or_oauth_urls(self):
        tpl = (Path(settings.BASE_DIR) / "templates" / "login.html").read_text(
            encoding="utf-8"
        )
        for leak in ("client_id", "client_secret", "accounts.google.com",
                     "oauth2", "AIza", "GOCSPX"):
            self.assertNotIn(leak, tpl)

    # ---------------- pressing it starts the flow ----------------
    def test_a_plain_get_does_not_start_the_handshake(self):
        """Why this is a form and not a link: GET renders a page, POST redirects."""
        self.assertEqual(self.client.get(reverse("google_login")).status_code, 200)

    def test_posting_the_form_starts_the_oauth_handshake(self):
        r = self.client.post(reverse("google_login"))
        self.assertEqual(r.status_code, 302)
        loc = r["Location"]
        self.assertTrue(
            loc.startswith("https://accounts.google.com/o/oauth2/v2/auth"), loc[:60]
        )
        params = urllib.parse.parse_qs(loc.split("?", 1)[1])
        self.assertEqual(
            params["client_id"][0], "test-client-id.apps.googleusercontent.com"
        )

    def test_the_handshake_targets_the_existing_callback_route(self):
        r = self.client.post(reverse("google_login"))
        params = urllib.parse.parse_qs(r["Location"].split("?", 1)[1])
        self.assertTrue(
            params["redirect_uri"][0].endswith(
                "/accounts/google/login/callback/"
            ),
            params["redirect_uri"][0],
        )

    # ---------------- the page's own login is unchanged ----------------
    def test_email_password_form_is_still_there(self):
        body = self.client.get(reverse("login")).content.decode()
        self.assertIn('action="/login/"', body)
        for field in ('id="loginForm"', 'name="email"', 'name="password"',
                      'name="remember"'):
            self.assertIn(field, body)

    def test_email_password_login_still_works(self):
        User.objects.create_user(
            username="gina", email="gina@example.com", password="secret1"
        )
        r = self.client.post(
            reverse("login"), {"email": "gina@example.com", "password": "secret1"}
        )
        self.assertRedirects(r, reverse("shop"))
        self.assertTrue(self.client.session.get("_auth_user_id"))

    # ---------------- next is carried over ----------------
    def test_the_google_form_keeps_the_page_the_user_was_headed_to(self):
        target = reverse("account")
        form = self.google_form(reverse("login") + f"?next={target}")
        self.assertIn(f'name="next" value="{target}"', form)

    def test_the_google_form_omits_next_when_there_is_none(self):
        self.assertNotIn('name="next"', self.google_form())


class LogoutButtonTests(TestCase):
    """The nav offers a visible Log out control to signed-in visitors.

    The header/mobile menu is built by ui.js, so base.html publishes the session
    state and the real logout URL as window.__AUTH; ui.js then renders the
    control using the classes it already uses for the other nav actions. The
    click lands on the existing /logout/ view - no new URL, no new logout system.
    """

    def setUp(self):
        self.u = User.objects.create_user(
            username="nora", email="nora@example.com", password="secret1"
        )
        self.js = (Path(settings.BASE_DIR) / "static" / "assets" / "js" / "ui.js")
        self.source = self.js.read_text(encoding="utf-8")

    def navHTML(self):
        start = self.source.index("function navHTML(")
        end = self.source.index("\n  }", start)
        return self.source[start:end]

    # ---------------- the control is published for signed-in visitors -------
    def test_signed_in_pages_publish_the_logout_url(self):
        self.client.force_login(self.u)
        body = self.client.get(reverse("shop")).content.decode()
        self.assertIn('logoutUrl: "/logout/"', body)
        self.assertIn("isAuthenticated: true", body)

    def test_anonymous_pages_do_not_offer_a_logout(self):
        body = self.client.get(reverse("login")).content.decode()
        self.assertIn("isAuthenticated: false", body)

    # ---------------- it is visible on desktop and on mobile ----------------
    def test_the_desktop_nav_renders_a_logout_control(self):
        html = self.navHTML()
        self.assertIn("logoutLink", html)
        self.assertIn("aria-label=\"Log out\"", html)
        # It sits inside .nav-actions, beside the other icon controls.
        self.assertIn("logoutLink +", html)
        self.assertIn('class="nav-actions"', html)

    def test_the_mobile_menu_renders_a_logout_control(self):
        html = self.navHTML()
        self.assertIn("logoutMlink", html)
        self.assertIn("Log out</a>", html)
        # It sits inside .mnav-foot, beside Account and Cart.
        self.assertIn('<div class="mnav-foot">', html)
        self.assertIn("logoutMlink +", html)

    def test_the_logout_control_uses_the_existing_icon_and_classes(self):
        html = self.navHTML()
        self.assertIn("icon('logout')", html)
        self.assertIn('class="nav-ic"', html)
        # No new styling was introduced for it.
        self.assertNotIn("nav-logout", html)

    def test_the_nav_falls_back_to_signed_out_without_the_bootstrap(self):
        """The offline prototype publishes no __AUTH and must not break."""
        self.assertIn("window.__AUTH || { isAuthenticated: false }", self.source)

    # ---------------- clicking it really logs you out -----------------------
    def test_logout_ends_the_session_and_lands_on_the_login_page(self):
        self.client.force_login(self.u)
        self.assertEqual(self.client.get(reverse("home")).status_code, 200)
        r = self.client.get(reverse("logout"))
        self.assertRedirects(r, reverse("login"))
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_after_logout_the_storefront_is_locked_again(self):
        self.client.force_login(self.u)
        self.client.get(reverse("logout"))
        for url in (reverse("home"), reverse("shop"), reverse("account")):
            with self.subTest(url=url):
                r = self.client.get(url)
                self.assertEqual(r.status_code, 302)
                self.assertTrue(r["Location"].startswith(reverse("login")))

    def test_logging_out_twice_is_harmless(self):
        self.client.force_login(self.u)
        self.client.get(reverse("logout"))
        self.assertRedirects(self.client.get(reverse("logout")), reverse("login"))



class PromoCodeTests(TestCase):
    """AERON10 takes 10% off the checkout subtotal, decided on the server.

    The announcement bar already advertises the code and base.css already ships
    the .promo-row / .sum-line.discount styles, so only the markup and the server
    maths were missing. The code in force lives in the session, never in the
    order form: the discount is always a percentage of the subtotal this view
    recomputed from the database, so a posted total or discount is ignored.
    """

    def setUp(self):
        self.cat = Category.objects.create(name="Running", slug="running")
        # 95.00 + (55.50 x 2) = 206.00 subtotal, which is over the $150
        # free-shipping threshold, so shipping is 0.00 and easy to reason about.
        self.p1 = Product.objects.create(
            name="Aero Run", category=self.cat, price="95.00", stock=10,
            sizes=["9"], colors=[],
        )
        self.p2 = Product.objects.create(
            name="Meridian", category=self.cat, price="55.50", stock=10,
            sizes=["9"], colors=[],
        )
        self.u = User.objects.create_user(
            username="pat", email="pat@example.com", password="secret1"
        )
        cart = Cart.objects.create(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p1, size="9", quantity=1)
        CartItem.objects.create(cart=cart, product=self.p2, size="9", quantity=2)
        self.client.force_login(self.u)

    def apply(self, code):
        return self.client.post(
            reverse("checkout"), {"promo_action": "apply", "promo_code": code}
        )

    def order_details(self):
        return {
            "full_name": "Pat Reed", "email": "pat@example.com",
            "phone": "+1 555 0102", "address": "1 Test Way", "city": "Portland",
            "postal_code": "97201",
        }

    def place_order(self, **extra):
        from myapp.models import Order

        self.client.post(reverse("checkout"), {**self.order_details(), **extra})
        return Order.objects.filter(user=self.u).order_by("-id").first()

    # ---------------- the input and the Apply button are on the page -------
    def test_the_checkout_page_has_a_promo_input_and_apply_button(self):
        r = self.client.get(reverse("checkout"))
        self.assertEqual(r.status_code, 200)
        body = r.content.decode()
        self.assertIn('id="coPromoInput"', body)
        self.assertIn('name="promo_code"', body)
        self.assertIn('id="coPromoBtn"', body)
        self.assertIn(">Apply</button>", body)
        self.assertIn('name="promo_action" value="apply"', body)

    def test_the_promo_form_reuses_the_existing_checkout_styles(self):
        """The .promo-row / .promo-msg / .sum-line.discount rules already exist."""
        body = self.client.get(reverse("checkout")).content.decode()
        self.assertIn('class="promo-row"', body)
        self.assertIn('class="promo-msg"', body)
        css = (Path(settings.BASE_DIR) / "static" / "assets" / "css"
               / "base.css").read_text(encoding="utf-8")
        self.assertIn(".promo-row", css)
        self.assertIn(".sum-line.discount", css)

    # ---------------- AERON10 takes exactly 10% off the subtotal -----------
    def test_aeron10_discounts_exactly_ten_percent(self):
        self.apply("AERON10")
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["subtotal"], Decimal("206.00"))
        self.assertEqual(ctx["discount"], Decimal("20.60"))
        self.assertEqual(ctx["total"], Decimal("185.40"))

    def test_the_code_is_case_insensitive(self):
        self.apply("aeron10")
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["promo_code"], "AERON10")
        self.assertEqual(ctx["discount"], Decimal("20.60"))

    def test_the_discount_is_shown_clearly_on_the_page(self):
        self.apply("AERON10")
        body = self.client.get(reverse("checkout")).content.decode()
        self.assertIn("Discount (AERON10", body)
        self.assertIn("20.60", body)
        self.assertIn("185.40", body)
        self.assertIn('class="sum-line discount"', body)

    def test_shipping_is_untouched_by_the_discount(self):
        self.apply("AERON10")
        ctx = self.client.get(reverse("checkout")).context
        # Shipping still keys off the undiscounted subtotal, so the free
        # shipping rule is unchanged by the promo.
        self.assertEqual(ctx["shipping"], Decimal("0.00"))
        self.assertEqual(
            ctx["total"], ctx["subtotal"] - ctx["discount"] + ctx["shipping"]
        )

    def test_a_paid_shipping_charge_is_added_after_the_discount(self):
        """Below the $150 threshold the flat $12 must survive the promo."""
        CartItem.objects.filter(product=self.p2).delete()
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["subtotal"], Decimal("95.00"))
        self.assertEqual(ctx["shipping"], Decimal("12.00"))
        self.apply("AERON10")
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["discount"], Decimal("9.50"))
        self.assertEqual(ctx["total"], Decimal("97.50"))  # 95.00 - 9.50 + 12.00

    def test_an_applied_code_survives_a_page_reload(self):
        self.apply("AERON10")
        for _ in range(3):
            self.assertEqual(
                self.client.get(reverse("checkout")).context["discount"],
                Decimal("20.60"),
            )

    # ---------------- invalid codes change nothing -------------------------
    def test_an_invalid_code_shows_an_error_and_keeps_the_total(self):
        r = self.apply("NOPE10")
        # fetch_redirect_response=False: following the redirect would render
        # the page and consume the one-shot notice we are about to assert on.
        self.assertRedirects(
            r, reverse("checkout"), fetch_redirect_response=False
        )
        # One GET only: the notice is one-shot, so a second load would find it
        # already consumed.
        page = self.client.get(reverse("checkout"))
        ctx = page.context
        self.assertEqual(ctx["discount"], Decimal("0.00"))
        self.assertEqual(ctx["total"], ctx["subtotal"] + ctx["shipping"])
        self.assertEqual(ctx["promo_notice"][0], "err")
        self.assertIn("NOPE10", ctx["promo_notice"][1])
        self.assertIn("is not a valid promo code", page.content.decode())

    def test_an_invalid_code_does_not_disturb_an_already_applied_one(self):
        self.apply("AERON10")
        self.apply("BOGUS")
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["discount"], Decimal("20.60"))
        self.assertEqual(ctx["total"], Decimal("185.40"))
        self.assertEqual(ctx["promo_notice"][0], "err")

    def test_an_empty_submission_is_reported(self):
        self.apply("")
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["discount"], Decimal("0.00"))
        self.assertEqual(ctx["promo_notice"][0], "err")

    def test_no_discount_row_is_rendered_without_a_code(self):
        body = self.client.get(reverse("checkout")).content.decode()
        self.assertNotIn("sum-line discount", body)

    # ---------------- the discount is decided on the server ----------------
    def test_a_posted_total_or_discount_is_ignored(self):
        self.apply("AERON10")
        order = self.place_order(
            discount="999.00", total="0.01", promo_code="FREE100"
        )
        self.assertEqual(order.subtotal, Decimal("206.00"))
        self.assertEqual(order.total, Decimal("185.40"))

    def test_the_placed_order_really_is_ten_percent_off(self):
        self.apply("AERON10")
        order = self.place_order()
        self.assertEqual(order.total, order.subtotal - Decimal("20.60"))
        self.assertEqual(
            order.total, order.subtotal * Decimal("0.90") + order.shipping
        )

    def test_the_code_is_consumed_by_the_order_it_was_used_on(self):
        self.apply("AERON10")
        self.place_order()
        self.assertNotIn("promo_code", self.client.session)
        cart = Cart.objects.get(user=self.u)
        CartItem.objects.create(cart=cart, product=self.p1, size="9", quantity=1)
        ctx = self.client.get(reverse("checkout")).context
        self.assertEqual(ctx["discount"], Decimal("0.00"))

    def test_an_empty_bag_drops_the_code(self):
        self.apply("AERON10")
        self.place_order()
        self.assertEqual(
            self.client.get(reverse("checkout")).context["cart_empty"], True
        )
        self.assertNotIn("promo_code", self.client.session)

    # ---------------- nothing beyond AERON10 exists -----------------------
    def test_there_is_a_single_code_and_no_other_promo_rules(self):
        from myapp.views import PROMO_CODES

        self.assertEqual(PROMO_CODES, {"AERON10": Decimal("10")})
        for absent in ("FREE", "SAVE10", "WELCOME", "AERON20"):
            with self.subTest(code=absent):
                self.apply(absent)
                self.assertEqual(
                    self.client.get(reverse("checkout")).context["discount"],
                    Decimal("0.00"),
                )


class ProductStockTests(TestCase):
    """Product.stock is the whole inventory, and nothing else.

    One plain number on the Product, set and edited alongside the product in
    the admin. The product page reports it as In Stock / Out of Stock, the cart
    refuses to hold more of a style than the style has, checkout checks it again
    on the way in, and a placed order takes exactly the ordered quantity off it
    — so a style that reaches 0 cannot be bought again.

    There is deliberately no per-size, per-colour or per-variant stock: the
    lines a bag holds for one style (different sizes or colours) all compete
    for that single number.
    """

    def setUp(self):
        self.cat = Category.objects.create(name="Sneakers", slug="sneakers")
        self.p = Product.objects.create(
            name="Aero Run", category=self.cat, price="100.00", stock=10,
            sizes=["8", "9", "10"],
            colors=[
                {"name": "Black", "hex": "#000000"},
                {"name": "White", "hex": "#ffffff"},
            ],
        )
        self.u = User.objects.create_user(
            username="sam", email="sam@example.com", password="secret1"
        )
        self.client.force_login(self.u)

    # ---------------- helpers ----------------
    def set_stock(self, product, n):
        """Set the stock the way an admin edit would: straight in the database."""
        Product.objects.filter(pk=product.pk).update(stock=n)
        product.refresh_from_db()

    def add(self, product=None, size="", color="", quantity=1):
        product = product or self.p
        return self.client.post(
            reverse("add_to_cart", args=[product.id]),
            {"size": size, "color": color, "quantity": quantity},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

    def line(self, product=None, size="", color=""):
        product = product or self.p
        return CartItem.objects.filter(
            cart__user=self.u, product=product, size=size, color=color
        ).first()

    def step(self, item, action="inc", **extra):
        # action="" is how a caller sends an explicit quantity instead of a step.
        return self.client.post(
            reverse("cart_update", args=[item.id]),
            {"action": action, **extra},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )

    def order_details(self):
        return {
            "full_name": "Sam Reed", "email": "sam@example.com",
            "phone": "+1 555 0110", "address": "2 Test Way", "city": "Portland",
            "postal_code": "97201",
        }

    def place_order(self):
        return self.client.post(reverse("checkout"), self.order_details())

    def page(self, product=None):
        product = product or self.p
        return self.client.get(reverse("product", args=[product.id])).content.decode()

    # ---------------- stock is set and edited with the product ---------------
    def admin_login(self):
        boss = User.objects.create_superuser(
            username="root", email="root@example.com", password="secret1"
        )
        self.client.force_login(boss)
        return boss

    def product_form(self, stock):
        # The admin's auto-generated product form: name, category, price, stock,
        # rating and reviews are the required fields, and the two JSON fields
        # take their value as JSON text.
        return {
            "name": "Trail Pro", "category": self.cat.id, "price": "129.00",
            "stock": str(stock), "rating": "0", "reviews": "0",
            "colors": "[]", "sizes": "[]",
        }

    def test_the_admin_product_form_carries_the_stock_field(self):
        self.admin_login()
        add = self.client.get(reverse("admin:myapp_product_add")).content.decode()
        self.assertIn('name="stock"', add)
        change = self.client.get(
            reverse("admin:myapp_product_change", args=[self.p.id])
        ).content.decode()
        self.assertIn('name="stock"', change)
        # The change form opens on the stock the product actually has.
        self.assertIn('value="%d"' % self.p.stock, change)

    def test_stock_is_saved_when_the_admin_adds_a_product(self):
        self.admin_login()
        r = self.client.post(
            reverse("admin:myapp_product_add"), self.product_form(17)
        )
        self.assertEqual(r.status_code, 302)
        self.assertEqual(Product.objects.get(name="Trail Pro").stock, 17)

    def test_stock_is_edited_when_the_admin_changes_a_product(self):
        self.admin_login()
        form = self.product_form(3)
        form["name"] = self.p.name
        r = self.client.post(
            reverse("admin:myapp_product_change", args=[self.p.id]), form
        )
        self.assertEqual(r.status_code, 302)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 3)

    # ---------------- In Stock / Out of Stock on the product page -------------
    def test_the_product_page_reports_in_stock(self):
        self.set_stock(self.p, 4)
        self.assertIn(">In Stock<", self.page())

    def test_the_product_page_reports_out_of_stock_at_zero(self):
        self.set_stock(self.p, 0)
        body = self.page()
        self.assertIn(">Out of Stock<", body)
        self.assertNotIn(">In Stock<", body)

    def test_the_product_page_publishes_the_stock_for_the_stepper(self):
        self.set_stock(self.p, 6)
        self.assertIn('data-stock="6"', self.page())

    # ---------------- adding to the cart never exceeds the stock --------------
    def test_adding_up_to_the_stock_is_allowed(self):
        self.set_stock(self.p, 3)
        r = self.add(quantity=3)
        self.assertTrue(r.json()["ok"])
        self.assertEqual(self.line().quantity, 3)

    def test_adding_more_than_the_stock_is_refused(self):
        self.set_stock(self.p, 3)
        r = self.add(quantity=4)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.json()["ok"])
        self.assertIn("Only 3 left in stock.", r.json()["errors"]["quantity"])
        # Nothing was written, not even an empty line.
        self.assertEqual(CartItem.objects.filter(cart__user=self.u).count(), 0)

    def test_a_sold_out_style_cannot_be_added_at_all(self):
        self.set_stock(self.p, 0)
        r = self.add(quantity=1)
        self.assertEqual(r.status_code, 400)
        self.assertIn("out of stock", r.json()["errors"]["quantity"])
        self.assertEqual(CartItem.objects.filter(cart__user=self.u).count(), 0)

    def test_topping_a_line_up_past_the_stock_is_refused(self):
        self.set_stock(self.p, 5)
        self.add(quantity=3)
        r = self.add(quantity=3)  # 3 already in the bag, 3 more asked for
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.line().quantity, 3)

    def test_every_line_of_a_style_shares_the_one_stock(self):
        """No per-size or per-colour stock: the lines compete for one number."""
        self.set_stock(self.p, 3)
        self.assertTrue(self.add(size="9", color="Black", quantity=2).json()["ok"])
        r = self.add(size="10", color="White", quantity=2)
        self.assertEqual(r.status_code, 400)
        self.assertIn("Only 1 left in stock.", r.json()["errors"]["quantity"])
        self.assertIsNone(self.line(size="10", color="White"))

    # ---------------- updating a cart line never exceeds the stock -----------
    def test_the_plus_stepper_still_works_below_the_stock(self):
        self.set_stock(self.p, 5)
        self.add(quantity=1)
        data = self.step(self.line()).json()
        self.assertEqual(data["quantity"], 2)
        self.assertEqual(data["error"], "")

    def test_the_plus_stepper_stops_at_the_stock(self):
        self.set_stock(self.p, 2)
        self.add(quantity=2)
        data = self.step(self.line()).json()
        self.assertEqual(data["quantity"], 2)
        self.assertEqual(self.line().quantity, 2)
        self.assertIn("Only 2 left in stock.", data["error"])

    def test_an_explicit_quantity_above_the_stock_is_refused(self):
        self.set_stock(self.p, 4)
        self.add(quantity=1)
        data = self.step(self.line(), action="", quantity=9).json()
        self.assertEqual(self.line().quantity, 1)
        self.assertEqual(data["quantity"], 1)
        self.assertIn("Only 4 left in stock.", data["error"])

    def test_a_line_cannot_be_raised_past_the_stock_the_other_lines_left_it(self):
        self.set_stock(self.p, 3)
        self.add(size="9", quantity=2)
        self.add(size="10", quantity=1)
        # Only 1 unit is free now, so the size 10 line cannot grow past its 1.
        data = self.step(self.line(size="10")).json()
        self.assertEqual(self.line(size="10").quantity, 1)
        self.assertIn("Only 1 left in stock.", data["error"])

    def test_the_minus_stepper_always_works_even_below_the_stock(self):
        """Stock can be lowered under a line already in the bag; the customer
        must still be able to walk that quantity back down."""
        self.set_stock(self.p, 5)
        self.add(quantity=5)
        self.set_stock(self.p, 1)
        self.assertEqual(self.step(self.line(), "dec").json()["quantity"], 4)
        self.assertEqual(self.line().quantity, 4)

    def test_the_existing_ninety_nine_ceiling_still_stands(self):
        self.set_stock(self.p, 500)
        self.add(quantity=1)
        self.step(self.line(), action="", quantity=250)
        self.assertEqual(self.line().quantity, 99)

    def test_the_ceiling_does_not_beat_the_stock(self):
        """The 99 clamp and the stock limit are independent: stock wins when the
        style has fewer units than the ceiling."""
        self.set_stock(self.p, 3)
        self.add(quantity=1)
        self.step(self.line(), action="", quantity=250)
        self.assertEqual(self.line().quantity, 1)

    def test_removing_a_line_below_one_still_works(self):
        self.set_stock(self.p, 5)
        self.add(quantity=1)
        data = self.step(self.line(), "dec").json()
        self.assertTrue(data["removed"])
        self.assertIsNone(self.line())

    # ---------------- checkout checks the stock again -------------------------
    def test_a_bag_that_overshot_the_stock_is_not_ordered(self):
        from myapp.models import Order

        self.set_stock(self.p, 5)
        self.add(quantity=5)
        # The last units go to someone else while the bag sits there.
        self.set_stock(self.p, 2)

        r = self.place_order()
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Only 2 left of")
        self.assertEqual(Order.objects.count(), 0)
        # Nothing moved and the bag is still there to be corrected.
        self.assertEqual(self.p.stock, 2)
        self.assertEqual(self.line().quantity, 5)

    def test_a_sold_out_bag_is_not_ordered(self):
        from myapp.models import Order

        self.set_stock(self.p, 3)
        self.add(quantity=3)
        self.set_stock(self.p, 0)

        r = self.place_order()
        self.assertContains(r, "has sold out")
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.p.stock, 0)

    def test_two_lines_of_one_style_are_checked_as_one_demand(self):
        from myapp.models import Order

        self.set_stock(self.p, 4)
        self.add(size="9", quantity=2)
        self.add(size="10", quantity=2)
        # Individually each line still fits, together they do not.
        self.set_stock(self.p, 3)

        r = self.place_order()
        self.assertContains(r, "Only 3 left of")
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(self.p.stock, 3)

    # ---------------- a placed order takes the units off the stock ------------
    def test_a_placed_order_reduces_the_stock_by_the_ordered_quantity(self):
        from myapp.models import Order

        self.set_stock(self.p, 10)
        self.add(quantity=4)
        r = self.place_order()
        self.assertEqual(r.status_code, 302)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 6)
        self.assertEqual(Order.objects.count(), 1)
        # The bag is emptied, as before.
        self.assertEqual(CartItem.objects.filter(cart__user=self.u).count(), 0)

    def test_every_line_of_the_order_is_taken_off_together(self):
        self.set_stock(self.p, 10)
        self.add(size="9", color="Black", quantity=3)
        self.add(size="10", color="Black", quantity=2)
        self.place_order()
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 5)

    def test_the_order_records_the_quantity_taken_off(self):
        from myapp.models import Order

        self.set_stock(self.p, 10)
        self.add(quantity=3)
        self.place_order()
        line = Order.objects.get(user=self.u).items.get()
        self.p.refresh_from_db()
        self.assertEqual(line.quantity, 3)
        self.assertEqual(self.p.stock, 10 - line.quantity)

    def test_the_stock_only_moves_once_the_order_exists(self):
        from myapp.models import Order

        self.set_stock(self.p, 4)
        self.add(quantity=2)
        # A missing required field fails the order before anything is written.
        details = self.order_details()
        details["city"] = ""
        self.client.post(reverse("checkout"), details)
        self.assertEqual(Order.objects.count(), 0)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 4)
        self.assertEqual(self.line().quantity, 2)

    # ---------------- reaching 0 stops further purchases ----------------------
    def test_a_style_that_reaches_zero_cannot_be_bought_again(self):
        from myapp.models import Order

        self.set_stock(self.p, 2)
        self.add(quantity=2)
        self.place_order()
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 0)

        # The product page says so...
        self.assertIn(">Out of Stock<", self.page())
        # ...and the server refuses an add even if a caller asks anyway.
        r = self.add(quantity=1)
        self.assertEqual(r.status_code, 400)
        self.assertIn("out of stock", r.json()["errors"]["quantity"])
        # And an order for it cannot be placed.
        self.assertEqual(self.add(quantity=1).status_code, 400)
        self.assertEqual(Order.objects.count(), 1)

    def test_a_bag_holding_a_now_sold_out_style_cannot_be_checked_out(self):
        from myapp.models import Order

        self.set_stock(self.p, 4)
        self.add(quantity=2)
        self.set_stock(self.p, 0)
        r = self.place_order()
        self.assertContains(r, "has sold out")
        self.assertEqual(Order.objects.count(), 0)

    def test_the_database_itself_refuses_a_negative_stock(self):
        with self.assertRaises(IntegrityError):
            Product.objects.create(
                name="Impossible", category=self.cat, price="10.00", stock=-1
            )

    # ---------------- no per-size / per-colour / per-variant stock ------------
    def test_stock_is_one_field_on_the_product_and_nothing_else(self):
        names = [f.name for f in Product._meta.get_fields()]
        self.assertEqual(names.count("stock"), 1)
        for model in (Cart, CartItem, Wishlist):
            with self.subTest(model=model.__name__):
                self.assertNotIn("stock", [f.name for f in model._meta.get_fields()])

    def test_no_model_carries_a_size_colour_or_variant_stock(self):
        from myapp import models as app_models

        # Product.stock is the one number; nothing anywhere keeps a second
        # count split by size, colour or variant.
        banned = ("size_stock", "color_stock", "colour_stock", "variant_stock",
                  "stock_by_size", "stock_by_color", "stock_by_colour",
                  "stock_by_variant", "variant")
        for model in (Product, Cart, CartItem, Wishlist, app_models.Order,
                      app_models.OrderItem):
            for field in model._meta.get_fields():
                with self.subTest(model=model.__name__, field=field.name):
                    for name in banned:
                        self.assertNotIn(name, field.name)

    def test_the_only_stock_number_is_the_product_field(self):
        self.assertEqual(Product._meta.get_field("stock").default, 0)
        self.assertEqual(
            Product._meta.get_field("stock").get_internal_type(), "PositiveIntegerField"
        )

