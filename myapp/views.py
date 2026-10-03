import json
import re
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from urllib.parse import quote

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.cache import never_cache
from PIL import Image

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Profile, Wishlist

# Same gray "AERON" image the frontend falls back to when a product has no image.
PLACEHOLDER = "data:image/svg+xml;utf8," + quote(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">'
    '<rect width="600" height="600" fill="#eceae4"/>'
    '<text x="300" y="310" font-family="Arial" font-size="34" fill="#b9b5ab" '
    'text-anchor="middle">AERON</text></svg>'
)


def _image_src(path):
    # Empty image -> placeholder.
    if not path:
        return PLACEHOLDER
    # ImageField value: serve from media when the file was actually uploaded,
    # otherwise fall back to the legacy static path stored in the database.
    name = getattr(path, "name", None)
    if name:
        if (Path(settings.MEDIA_ROOT) / name).is_file():
            return path.url
        path = name
    # Absolute URLs stay as-is. The rest are static assets.
    if path.startswith(("http://", "https://", "//", "/", "data:")):
        return path
    return static(path)


# Fallback swatch colour for names we can't map (neutral gray).
DEFAULT_COLOR_HEX = "#9d9d9d"

# Plain-string colour names -> CSS colours. Only used when a Product.colors
# entry is a bare string (["Black", "White", "Red"]) instead of a dict.
COMMON_COLORS = {
    "black": "#000000", "white": "#ffffff", "red": "#ff0000", "blue": "#0000ff",
    "green": "#008000", "yellow": "#ffff00", "orange": "#ffa500", "purple": "#800080",
    "pink": "#ffc0cb", "brown": "#a52a2a", "gray": "#808080", "grey": "#808080",
    "navy": "#000080", "teal": "#008080", "maroon": "#800000", "olive": "#808000",
    "cyan": "#00ffff", "magenta": "#ff00ff", "gold": "#ffd700", "silver": "#c0c0c0",
    "beige": "#f5f5dc", "ivory": "#fffff0", "tan": "#d2b48c", "khaki": "#f0e68c",
    "indigo": "#4b0082", "violet": "#ee82ee", "lime": "#00ff00", "crimson": "#dc143c",
    "coral": "#ff7f50", "salmon": "#fa8072", "turquoise": "#40e0d0", "charcoal": "#36454f",
    "cream": "#fffdd0", "sky blue": "#87ceeb", "skyblue": "#87ceeb",
    "light blue": "#add8e6", "lightblue": "#add8e6",
    "light gray": "#d3d3d3", "light grey": "#d3d3d3", "lightgrey": "#d3d3d3",
    "dark gray": "#a9a9a9", "dark grey": "#a9a9a9", "darkgray": "#a9a9a9",
    "dark blue": "#00008b", "dark green": "#006400", "dark red": "#8b0000",
}

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{3}$")


def _color_hex(c):
    """Best CSS hex for one Product.colors entry.

    Dicts supply their own "hex" when valid. Fallbacks (dicts without a hex,
    or plain strings like "Black") are resolved through the common-name map.
    """
    if isinstance(c, dict):
        h = c.get("hex", "")
        if isinstance(h, str) and HEX_RE.match(h.strip()):
            return h.strip()
        name = c.get("name", "")
    else:
        name = c or ""
    return COMMON_COLORS.get(str(name).strip().lower(), DEFAULT_COLOR_HEX)


def _color_csv_entry(c):
    """Turn one entry of a Product.colors list into a "fam:hex" string.

    Colors are normally stored as {"name": ..., "hex": ..., "fam": ...} dicts,
    but some older products store plain strings like "Black" — those are
    resolved through the colour-name map so filter chips still get a swatch.
    """
    if isinstance(c, dict):
        fam = c.get("fam") or c.get("name", "")
        return f"{fam}:{_color_hex(c)}" if fam else ""
    return f"{c}:{_color_hex(c)}" if c else ""


def _color_name(c):
    """Return a product color's display name.

    Colors are normally stored as {"name": ..., "hex": ..., "fam": ...} dicts,
    but some older products store plain strings like "Black" — those are used
    as-is.
    """
    return c.get("name", "") if isinstance(c, dict) else (c or "")


def _color_options(colors):
    """Normalise a Product.colors list into renderable colour options.

    Both stored shapes are supported — dicts ({"name": ..., "hex": ...}) and
    plain strings ("Ivory") — through _color_name / _color_hex. Blank entries
    are dropped so a stray "" in the list cannot render as an unidentifiable
    grey dot, and exactly one option is flagged "selected" (the first) so the
    page always starts from a valid single-selection state.
    """
    options = []
    for c in colors or []:
        name = str(_color_name(c) or "").strip()
        if not name:
            continue
        options.append({"name": name, "hex": _color_hex(c)})
    for i, option in enumerate(options):
        option["selected"] = i == 0
    return options


def _color_hex_for(colors, name):
    """Swatch hex for a colour name already stored on a CartItem.

    Cart rows keep the colour *name* only, so the swatch is re-resolved from
    the product's own colour list at display time. Returns "" when the product
    no longer offers that colour (an old cart row), which lets the template
    show the name without a swatch rather than inventing a colour.
    """
    for option in _color_options(colors):
        if option["name"] == name:
            return option["hex"]
    return ""


# ---- product-wise stock -----------------------------------------------------
# Stock is one plain number on the Product (Product.stock) and deliberately
# nothing else: there is no per-size, per-colour or per-variant stock, so every
# cart line for a style competes for the same pool of units.

# A style with this many units or fewer left gets the "Only N left" nudge.
LOW_STOCK_THRESHOLD = 5

# A single cart line never holds more than this many units, whatever the stock
# says. It is the quantity ceiling the cart +/- steppers have always had, and
# it is still applied as a plain clamp.
MAX_LINE_QUANTITY = 99


def _stock_available(product, cart=None, exclude_line=None):
    """Units of ``product`` that are still free to put into ``cart``.

    Stock lives on the product as a single number, so the units already sitting
    on the cart's other lines of the same product (whatever their size or
    colour) are reserved and must be subtracted. ``exclude_line`` is the line
    that is about to grow or shrink, if any, so topping a line up never counts
    its own current units twice. The answer is never negative.
    """
    if cart is None:
        return max(0, product.stock)
    lines = cart.items.filter(product=product)
    if exclude_line is not None:
        lines = lines.exclude(pk=exclude_line.pk)
    reserved = lines.aggregate(total=Sum("quantity"))["total"] or 0
    return max(0, product.stock - reserved)


def _stock_message(product, available):
    """Why a requested quantity could not be given, in one plain sentence."""
    if available <= 0:
        return f"{product.name} is out of stock."
    return f"Only {available} left in stock."


def _decorate_products(products):
    # Pre-compute a few display values so the template stays simple.
    for p in products:
        # True when the sale price is set and lower than the regular price.
        p.on_sale = p.sale_price is not None and p.price and p.sale_price < p.price
        # This is the price the customer actually pays.
        p.display_price = p.sale_price if p.on_sale else p.price
        # Percent shown on the "-XX%" badge.
        p.discount_percent = int(round((1 - p.sale_price / p.price) * 100)) if p.on_sale else 0
        # "Only N left" appears when stock is between 1 and LOW_STOCK_THRESHOLD.
        p.low_stock = 0 < p.stock <= LOW_STOCK_THRESHOLD
        # The plain In Stock / Out of Stock label the product page shows.
        p.in_stock = p.stock > 0
        # Words searched by the client-side search box.
        p.search_text = " ".join(filter(None, [
            p.name, p.gender, p.sport,
            p.get_gender_display(), p.get_sport_display(), p.category.name,
        ])).lower()
        # "7,7.5,8" strings used by the size filter chips.
        p.size_csv = ",".join(p.sizes)
        # "Orange:#ff4d1c,Black:#1b1b1e" strings used by the color filter chips.
        p.color_csv = ",".join(x for x in (_color_csv_entry(c) for c in p.colors) if x)
        # Renderable colour options for the product-card swatch picker. The
        # "selected" flag that _color_options puts on the first entry is
        # deliberately ignored by the card markup: the card must never pre-pick
        # a colour, the customer always chooses before adding.
        p.color_list = _color_options(p.colors)
        p.has_colors = bool(p.color_list)
        p.image_src = _image_src(p.image)
        p.hover_src = _image_src(p.hover_image) if p.hover_image else ""
    return products


@login_required(login_url="login")
def home(request):
    products = _decorate_products(Product.objects.select_related("category"))

    # Hero driven by the first featured product (fallback: any product).
    featured = next((p for p in products if p.featured), products[0] if products else None)
    if featured:
        words = featured.name.split(" ")
        featured.hero_l1 = words[0] or featured.name
        featured.hero_l2 = " ".join(words[1:])
        featured.hero_label = "Featured Drop — " + (
            featured.get_gender_display() + " · " + featured.get_sport_display()
        ).strip(" ·")

    # New arrivals (is_new=True), leading four.
    new_arrivals = [p for p in products if p.is_new][:4]
    # Trending: most-reviewed, leading four.
    trending = sorted(products, key=lambda p: p.reviews, reverse=True)[:4]
    # Best sellers: highest rated, leading four.
    best_sellers = sorted(products, key=lambda p: p.rating, reverse=True)[:4]

    # Categories for the homepage tiles/pills, with a product count on each.
    categories = Category.objects.annotate(num_products=Count("products"))
    for c in categories:
        c.image_src = _image_src(c.image)

    # "View all" style links: point at the matching category when it exists,
    # otherwise fall back to the full shop so the links never 404.
    def _cat_or_shop(slug):
        return (
            reverse("category", args=[slug])
            if Category.objects.filter(slug=slug).exists()
            else reverse("shop")
        )

    context = {
        "featured": featured,
        "new_arrivals": new_arrivals,
        "trending": trending,
        "best_sellers": best_sellers,
        "categories": categories,
        "new_arrivals_href": _cat_or_shop("new-arrivals"),
        "sneakers_href": _cat_or_shop("sneakers"),
        "sale_href": _cat_or_shop("sale"),
    }
    return render(request, "index.html", context)


# The shop grid shows 8 styles per page - the same batch the old "Load More"
# button used to reveal, now paginated by Django instead of hidden by JS.
SHOP_PAGE_SIZE = 8
# The sidebar "Max price" slider range, so a hand-typed ?price= can never put
# the slider and the filter out of step.
SHOP_PRICE_MIN = 50
SHOP_PRICE_MAX = 250
SHOP_SORTS = ("featured", "new", "rating", "price-asc", "price-desc")


def _shop_color_pairs(product):
    """[(family, hex), ...] for one product, read back from the card's
    "fam:hex,..." csv - the same values the sidebar chips exchange, so a chip
    and the products it filters can never disagree on spelling."""
    pairs = []
    for entry in product.color_csv.split(","):
        if not entry:
            continue
        fam, _, hex_value = entry.partition(":")
        pairs.append((fam, hex_value))
    return pairs


def _cat_matches(product, slug):
    """The ?cat= pseudo-slugs the shop has always accepted: new-arrivals and
    sale are flags, everything else is a gender or a sport."""
    if slug == "new-arrivals":
        return product.is_new
    if slug == "sale":
        return product.on_sale
    return product.gender == slug or product.sport == slug


def _size_sort_key(size):
    """Sizes sort numerically, with the "Y" youth sizes last."""
    try:
        return (1 if "Y" in size else 0, float(size))
    except ValueError:
        return (1 if "Y" in size else 0, 0.0)


def _shop_filter_options(products):
    """Sidebar size chips and colour chips for every product still in scope."""
    sizes = sorted(
        {str(s) for p in products for s in (p.sizes or [])},
        key=_size_sort_key,
    )
    colors = {}
    for p in products:
        for fam, hex_value in _shop_color_pairs(p):
            if fam and fam not in colors:
                colors[fam] = hex_value
    return sizes, [{"fam": fam, "hex": hex_value} for fam, hex_value in colors.items()]


def _shop_filters(params):
    """The shop's filter state, read out of the query string."""
    sort = params.get("sort") or ""
    try:
        price = int(params.get("price") or SHOP_PRICE_MAX)
    except ValueError:
        price = SHOP_PRICE_MAX
    return {
        "q": (params.get("q") or "").strip(),
        "cat": (params.get("cat") or "").strip(),
        "sizes": [s for s in params.getlist("size") if s],
        "colors": [c for c in params.getlist("color") if c],
        "price": min(max(price, SHOP_PRICE_MIN), SHOP_PRICE_MAX),
        "sort": sort if sort in SHOP_SORTS else "featured",
    }


def _shop_filter(products, filters):
    """Search text, sizes, colours and the price cap - the same rules the old
    client-side filter applied, so a filter set still matches the same styles."""
    q = filters["q"].lower()
    matched = []
    for p in products:
        if q and q not in p.search_text:
            continue
        if filters["sizes"] and not set(filters["sizes"]) & {str(s) for s in (p.sizes or [])}:
            continue
        if filters["colors"] and not set(filters["colors"]) & {
            fam for fam, _ in _shop_color_pairs(p)
        }:
            continue
        if p.display_price > filters["price"]:
            continue
        matched.append(p)
    return matched


def _shop_sort(products, sort):
    """Stable ordering (sorted() is stable), so equal keys keep the catalogue's
    own id order just like the client-side sort did."""
    if sort == "new":
        return sorted(products, key=lambda p: (not p.is_new, -p.id))
    if sort == "rating":
        return sorted(products, key=lambda p: -p.rating)
    if sort == "price-asc":
        return sorted(products, key=lambda p: p.display_price)
    if sort == "price-desc":
        return sorted(products, key=lambda p: -p.display_price)
    return sorted(products, key=lambda p: (not p.featured, -p.rating))


@login_required(login_url="login")
def shop(request):
    products = _decorate_products(Product.objects.select_related("category"))

    filters = _shop_filters(request.GET)

    # The sidebar's category list counts the whole catalogue, so it must not
    # shrink when a filter is applied.
    all_styles = len(products)

    # A ?cat= deep link narrows the pool exactly as it did when shop.js filtered
    # the same cards in the browser.
    if filters["cat"]:
        products = [p for p in products if _cat_matches(p, filters["cat"])]

    # The sidebar chips offer every option in scope, never just the styles on
    # the current page - otherwise paging would make options come and go.
    sizes, colors = _shop_filter_options(products)

    matched = _shop_sort(_shop_filter(products, filters), filters["sort"])

    # One real page of styles. get_page() also survives a ?page= beyond the end
    # by falling back to the last page, so a stale link can never 404.
    paginator = Paginator(matched, SHOP_PAGE_SIZE)
    page_obj = paginator.get_page(request.GET.get("page"))

    # Category list for the sidebar, with a product count on each.
    categories = Category.objects.annotate(num_products=Count("products"))

    context = {
        "products": page_obj.object_list,
        "page_obj": page_obj,
        "paginator": paginator,
        # Centred on the current page, with "…" in place of a long middle run.
        "page_numbers": paginator.get_elided_page_range(page_obj.number),
        "total_styles": paginator.count,
        "all_styles": all_styles,
        "categories": categories,
        "filters": filters,
        # Each chip links to the same view with its own value added or removed
        # and the page reset, so filtering never lands on an empty page.
        "size_chips": [
            {
                "value": s,
                "on": s in filters["sizes"],
                "add": sorted(set(filters["sizes"]) | {s}, key=_size_sort_key),
                "drop": [x for x in filters["sizes"] if x != s],
            }
            for s in sizes
        ],
        "color_chips": [
            {
                "value": c["fam"],
                "hex": c["hex"],
                "on": c["fam"] in filters["colors"],
                "add": sorted(set(filters["colors"]) | {c["fam"]}, key=str.lower),
                "drop": [x for x in filters["colors"] if x != c["fam"]],
            }
            for c in colors
        ],
    }
    return render(request, "shop.html", context)


@login_required(login_url="login")
def category_detail(request, slug):
    # Fetch one category by its slug, or respond with a 404 if it does not exist.
    category = get_object_or_404(Category, slug=slug)
    category.image_src = _image_src(category.image)

    # Every product linked to this category, with the same display helpers the shop uses.
    products = _decorate_products(category.products.select_related("category"))

    # Category list for the sidebar, with a product count on each.
    categories = Category.objects.annotate(num_products=Count("products"))

    context = {
        "category": category,
        "products": products,
        "categories": categories,
    }
    return render(request, "category.html", context)


@login_required(login_url="login")
def product_detail(request, pk):
    # Fetch one product by its id, or respond with a 404 if it does not exist.
    product = get_object_or_404(Product.objects.select_related("category"), pk=pk)

    # Same display helpers the shop uses, so the template stays simple.
    product.on_sale = product.sale_price is not None and product.price and product.sale_price < product.price
    product.display_price = product.sale_price if product.on_sale else product.price
    product.discount_percent = int(round((1 - product.sale_price / product.price) * 100)) if product.on_sale else 0
    product.image_src = _image_src(product.image)
    product.hover_src = _image_src(product.hover_image) if product.hover_image else ""
    # Ready-to-render colour swatches. Both stored shapes are supported
    # ({"name": ..., "hex": ...} dicts and plain "Ivory" strings); blank
    # entries are dropped and the first option comes pre-selected.
    product.color_list = _color_options(product.colors)
    product.has_colors = bool(product.color_list)
    product.first_color = product.color_list[0]["name"] if product.color_list else ""
    product.low_stock = 0 < product.stock <= LOW_STOCK_THRESHOLD
    # The In Stock / Out of Stock label, and the stock itself so the quantity
    # stepper on the page cannot offer more units than the product has.
    product.in_stock = product.stock > 0

    return render(request, "product.html", {"product": product})


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _auth_context(request, errors, values):
    """Shared context for the login/register pages."""
    return {
        "errors": errors,
        "values": values,
        "first_name": request.user.first_name if request.user.is_authenticated else "",
        "user_email": request.user.email if request.user.is_authenticated else "",
    }


def register(request):
    if request.user.is_authenticated:
        return redirect(reverse("home"))

    errors = {}
    values = {"name": "", "username": "", "email": ""}

    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        username = request.POST.get("username", "").strip()
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        password2 = request.POST.get("password2", "")
        values = {"name": name, "username": username, "email": email}

        # Validate every field before touching the database.
        if len(name) < 2:
            errors["name"] = "Enter your name."
        if not username:
            errors["username"] = "Choose a username."
        elif not re.fullmatch(r"[A-Za-z0-9_.]+", username):
            errors["username"] = "Letters, numbers, dots and underscores only."
        if not EMAIL_RE.match(email):
            errors["email"] = "Enter a valid email address."
        if len(password) < 6:
            errors["password"] = "At least 6 characters."
        if password != password2:
            errors["password2"] = "Passwords do not match."

        if not errors:
            # Username and email are both unique, checked separately.
            username_taken = User.objects.filter(username__iexact=username).exists()
            email_taken = User.objects.filter(email__iexact=email).exists()

            # A legacy account (username == email) is still caught by its email.
            if email_taken:
                errors["email"] = "An account with this email already exists."
            elif username_taken:
                errors["username"] = "This username is already taken."
            else:
                # create_user hashes the password with Django's secure hashing.
                user = User.objects.create_user(
                    username=username, email=email, password=password
                )
                user.first_name = name
                user.save()
                messages.success(request, "Account created! Please sign in to continue.")
                return redirect(reverse("login"))

    return render(request, "register.html", _auth_context(request, errors, values))


def login_view(request):
    if request.user.is_authenticated:
        return redirect(reverse("home"))

    errors = {}
    values = {"email": ""}

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        values = {"email": email}

        if not EMAIL_RE.match(email):
            errors["email"] = "Enter a valid email address."
        if not password:
            errors["password"] = "Enter your password."

        if not errors:
            # Users log in with email; authenticate against the User model.
            user = User.objects.filter(email__iexact=email).first()
            user = authenticate(request, username=user.username, password=password) if user else None
            if user is not None:
                login(request, user)
                # Keep me signed in -> two-week session, otherwise browser-session.
                if request.POST.get("remember"):
                    request.session.set_expiry(60 * 60 * 24 * 14)
                # Return to the page the user was headed to (e.g. /account/).
                next_url = _safe_next(request.POST.get("next") or request.GET.get("next"))
                return redirect(next_url or "shop")
            errors["global"] = "Invalid email or password."

    return render(request, "login.html", _auth_context(request, errors, values))


def logout_view(request):
    logout(request)
    # Straight to the login page: the storefront is login-required, so sending
    # anyone through "home" first only cost an extra redirect.
    return redirect(reverse("login"))


def _safe_next(next_url):
    # Only allow same-site relative paths (prevents open redirects).
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return next_url
    return None


@login_required(login_url="login")
@never_cache
def account(request):
    user = request.user
    # Load (or lazily create) the one-to-one profile row.
    profile, _ = Profile.objects.get_or_create(user=user)
    # Serialize only the fields the account page shows, straight from the DB.
    data = json.dumps({
        "name": (user.first_name or user.username).strip(),
        "username": user.username,
        "email": user.email,
        "joined": user.date_joined.isoformat(),
        "phone": profile.phone,
        "address": profile.address,
        "city": profile.city,
        "postal_code": profile.postal_code,
        "country": profile.country,
    })
    return render(request, "account.html", {"user_json": data})


@login_required(login_url="login")
def profile_update(request):
    # Only logged-in users reach this view (their own profile).
    profile, _ = Profile.objects.get_or_create(user=request.user)
    profile.phone = request.POST.get("phone", "").strip()
    profile.address = request.POST.get("address", "").strip()
    profile.city = request.POST.get("city", "").strip()
    profile.postal_code = request.POST.get("postal_code", "").strip()
    profile.country = request.POST.get("country", "").strip()

    # The picture is optional: a submit with no new file keeps the current one,
    # so saving an address never silently drops somebody's photo.
    avatar_error = _save_avatar(profile, request)
    if avatar_error:
        messages.error(request, avatar_error)

    profile.save()
    # Back to the profile tab, now showing the saved values.
    return redirect(reverse("account") + "?tab=profile&saved=1")


# Avatars are shown in a 42px circle in the header, so a couple of hundred KB is
# plenty and keeps MEDIA_ROOT from filling up with phone camera originals.
MAX_AVATAR_BYTES = 2 * 1024 * 1024
# The formats a browser can actually produce from a file picker or a phone
# camera. Checked by content type *and* re-checked by Pillow, because the
# content type is just a header the client controls.
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _save_avatar(profile, request):
    """Store the uploaded profile picture on `profile`. Returns an error
    message, or None on success.

    Deliberately narrow: only a real image, only for the signed-in user's own
    profile, and only when a file was actually sent.
    """
    upload = request.FILES.get("avatar")
    if upload is None or not upload:
        return None

    if upload.size > MAX_AVATAR_BYTES:
        return "That picture is too large. Please choose an image under 2 MB."

    content_type = (upload.content_type or "").lower()
    if content_type and content_type not in ALLOWED_AVATAR_TYPES:
        return "Please choose a JPEG, PNG, WebP or GIF image."

    # Pillow opens the file and reads its header, so a renamed .txt or a
    # truncated download is rejected here instead of being saved and then
    # failing to render as a broken image in the header.
    try:
        image = Image.open(upload)
        image.verify()
    except Exception:
        return "That file is not a readable image. Please try another one."

    # verify() leaves the file pointer at the end, so rewind before saving.
    upload.seek(0)
    # Clear the old file so replacing a picture does not leave the previous
    # upload orphaned on disk.
    if profile.avatar:
        profile.avatar.delete(save=False)
    profile.avatar = upload
    return None


@login_required(login_url="login")
def add_to_cart(request, product_id):
    # Only POST adds something; a plain GET just lands back on the product page.
    if request.method != "POST":
        return redirect(reverse("product", args=[product_id]))

    product = get_object_or_404(Product, pk=product_id)
    # Product cards and the product page report quantity over fetch() with this
    # header; a plain form POST falls back to the redirect below.
    is_ajax = request.headers.get("X-Requested-With", "") == "XMLHttpRequest"

    # The size picked on the Product Detail size chips; blank when the crafted
    # style has no sizes configured.
    size = request.POST.get("size", "").strip()

    # The colour picked on the Product Detail swatches; blank when the style has
    # no colours or the add came from a product card.
    color = request.POST.get("color", "").strip()

    # Never trust the browser to add "1": read whatever quantity was sent and
    # validate it. The product page sends the selected quantity (e.g. 10).
    try:
        quantity = int(request.POST.get("quantity", "1"))
    except (TypeError, ValueError):
        quantity = None

    errors = {}
    if quantity is None or quantity < 1:
        errors["quantity"] = "Quantity must be a whole number of 1 or more."

    # A size is only validated when one was actually selected (the product
    # detail page). Product-card adds send no size at all, which the model
    # allows (blank = "One Size") — the same convention the cart page shows.
    valid_sizes = [str(s) for s in product.sizes or []]
    if size:
        if size not in valid_sizes:
            errors["size"] = f"{size} is not a valid size for this style."
    else:
        # No size chosen: keep the line size blank (sizeless styles too).
        size = ""

    # A colour is only accepted when the product really offers it, so a
    # hand-crafted POST cannot invent a colour that would later be rendered on
    # the cart page. Product-card adds send no colour at all, which the model
    # allows (blank = no colour on this line) — the same convention as size.
    valid_colors = {option["name"] for option in _color_options(product.colors)}
    if color:
        if color not in valid_colors:
            errors["color"] = f"{color} is not a valid color for this style."
    else:
        color = ""

    if errors:
        if is_ajax:
            return JsonResponse({"ok": False, "errors": errors}, status=400)
        return redirect(reverse("product", args=[product_id]))

    # One cart per user, created the first time they add something.
    cart, _ = Cart.objects.get_or_create(user=request.user)

    # Same Product + Size + Colour -> merge into the existing line (bump the
    # quantity), otherwise start a new line. unique_together
    # ("cart", "product", "size", "color") guarantees only one such row exists,
    # so the same shoe in Black/US 9 is one line that grows, while Black/US 9
    # and Red/US 9 (or Black/US 8) stay separate lines. Only looked up here, not
    # created yet, so a rejected add leaves no empty line behind.
    item = CartItem.objects.filter(
        cart=cart, product=product, size=size, color=color
    ).first()

    # Stock is one number per product, so every line of this style in the bag
    # (any size or colour) competes for the same units. This add claims fresh
    # units on top of the ones already held, so the whole line is still counted
    # as reserved and the leftover is what this add may take.
    available = _stock_available(product, cart)
    if available <= 0 or quantity > available:
        if is_ajax:
            return JsonResponse(
                {"ok": False, "errors": {"quantity": _stock_message(product, available)}},
                status=400,
            )
        return redirect(reverse("product", args=[product_id]))

    if item is None:
        # A brand-new line must be exactly the requested quantity — the model
        # default of 1 must not be added on top of it.
        item = CartItem(
            cart=cart, product=product, size=size, color=color, quantity=quantity
        )
    else:
        item.quantity += quantity
    item.save()

    # Total items in the bag, so the header badge can refresh without a reload.
    count = (
        CartItem.objects.filter(cart=cart)
        .aggregate(total=Sum("quantity"))["total"]
        or 0
    )

    if is_ajax:
        return JsonResponse({
            "ok": True,
            "product_id": product.id,
            "quantity": item.quantity,
            "added": quantity,
            "count": count,
            # Echoed back so the client can confirm which line it just changed.
            "size": item.size,
            "color": item.color,
        })

    # Plain form submit: send the user to the cart page so they can see their bag.
    return redirect(reverse("cart"))


@login_required(login_url="login")
def cart(request):
    """The real cart page: loads the logged-in user's cart from the database."""
    cart = Cart.objects.filter(user=request.user).first()

    cart_items = []
    subtotal = Decimal("0.00")
    if cart is not None:
        items = cart.items.select_related("product__category")
        for item in items:
            p = item.product
            on_sale = p.sale_price is not None and p.price and p.sale_price < p.price
            unit = p.sale_price if on_sale else p.price
            # Pre-compute the display values the template shows.
            item.unit_price = unit
            item.line_total = unit * item.quantity
            item.image_src = _image_src(p.image)
            item.product_name = p.name
            item.product_url = reverse("product", args=[p.id])
            # Cart rows store the colour name only; re-resolve the swatch from
            # the product's own colour list. Blank for legacy rows that have no
            # colour, and for a colour the product no longer offers.
            item.color_hex = _color_hex_for(p.colors, item.color) if item.color else ""
            cart_items.append(item)
            subtotal += item.line_total

    # Standard shipping: free over $150, otherwise a flat $12 (0 subtotal = 0).
    shipping = Decimal("0.00") if subtotal >= Decimal("150.00") else Decimal("12.00")
    total = subtotal + shipping

    return render(request, "cart.html", {
        "cart_items": cart_items,
        "subtotal": subtotal,
        "shipping": shipping,
        "total": total,
    })


@login_required(login_url="login")
def update_cart_item(request, item_id):
    # Quantity controls live on the cart page; a GET just bounces back there.
    if request.method != "POST":
        return redirect(reverse("cart"))

    # The cart page sends the +/- steppers as fetch() with this header so the
    # view can answer with JSON; a plain form submit keeps the redirect below.
    is_ajax = request.headers.get("X-Requested-With", "") == "XMLHttpRequest"

    # Only the owner of the cart can change a line.
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    action = request.POST.get("action", "")

    # A line may never claim more units than the product actually has, and stock
    # is shared by every line of that product, so the units the cart's other
    # lines already hold are subtracted before this line's own limit is worked
    # out. Above that the request is refused, because quietly handing over fewer
    # units than the customer asked for is not acceptable.
    stock_limit = _stock_available(item.product, item.cart, exclude_line=item)
    # Set when the stepper asked for more than the product has left. The line is
    # left at the quantity it already had and the reason goes back to the page.
    error = ""

    if action == "dec":
        # Below 1 the item is removed (the cart's "Remove" behaviour).
        if item.quantity <= 1:
            item.delete()
        else:
            item.quantity -= 1
            item.save()
    elif action == "inc":
        if item.quantity + 1 > stock_limit:
            error = _stock_message(item.product, stock_limit)
        else:
            item.quantity = min(item.quantity + 1, MAX_LINE_QUANTITY)
            item.save()
    else:
        # Explicit quantity (used if a caller sends "quantity" directly).
        try:
            qty = int(request.POST.get("quantity", ""))
        except (TypeError, ValueError):
            qty = item.quantity
        if qty <= 0:
            item.delete()
        elif qty > stock_limit:
            error = _stock_message(item.product, stock_limit)
        else:
            # The long-standing per-line ceiling stays a plain clamp.
            item.quantity = min(qty, MAX_LINE_QUANTITY)
            item.save()

    if is_ajax:
        return _cart_update_json(request, item_id, error)

    return redirect(reverse("cart"))


def _cart_totals(owner):
    """Subtotal, shipping, total and total quantity, mirroring the cart view."""
    cart = Cart.objects.filter(user=owner).first()
    subtotal = Decimal("0.00")
    count = 0
    if cart is not None:
        for line in cart.items.select_related("product"):
            p = line.product
            on_sale = p.sale_price is not None and p.price and p.sale_price < p.price
            unit = p.sale_price if on_sale else p.price
            subtotal += unit * line.quantity
            count += line.quantity
    # Standard shipping: free over $150, otherwise a flat $12 (0 subtotal = 0).
    shipping = Decimal("0.00") if subtotal >= Decimal("150.00") else Decimal("12.00")
    return subtotal, shipping, subtotal + shipping, count


def _cart_update_json(request, item_id, error=""):
    """JSON payload for the AJAX +/- steppers on the cart page.

    ``error`` is set when the stepper asked for more units than the product has
    left; the payload still carries the unchanged quantity and totals so the
    page stays in step with the database, plus the reason to show the customer.
    """
    removed = not CartItem.objects.filter(id=item_id, cart__user=request.user).exists()
    quantity = None
    line_total = None
    if not removed:
        item = CartItem.objects.select_related("product").get(id=item_id)
        p = item.product
        on_sale = p.sale_price is not None and p.price and p.sale_price < p.price
        unit = p.sale_price if on_sale else p.price
        quantity = item.quantity
        line_total = (unit * item.quantity).quantize(Decimal("0.01"))
    subtotal, shipping, total, count = _cart_totals(request.user)
    return JsonResponse({
        "ok": True,
        "removed": removed,
        "quantity": quantity,
        "line_total": str(line_total) if line_total is not None else None,
        "subtotal": str(subtotal.quantize(Decimal("0.01"))),
        "shipping": str(shipping.quantize(Decimal("0.01"))),
        "total": str(total.quantize(Decimal("0.01"))),
        "cart_count": count,
        "error": error,
    })


@login_required(login_url="login")
def remove_cart_item(request, item_id):
    if request.method != "POST":
        return redirect(reverse("cart"))

    # get_object_or_404 also scopes to the owner's cart, so nobody can
    # delete someone else's items.
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    item.delete()
    return redirect(reverse("cart"))


@login_required(login_url="login")
def clear_cart(request):
    if request.method == "POST":
        CartItem.objects.filter(cart__user=request.user).delete()
    return redirect(reverse("cart"))


def _cart_ctx(request):
    """The user's live cart with server-side prices, like the cart page.

    Prices are always recomputed from Product here — nothing from the browser
    is ever trusted because this snapshot feeds the order totals."""
    cart = Cart.objects.filter(user=request.user).first()
    cart_items = []
    subtotal = Decimal("0.00")
    if cart is not None:
        items = cart.items.select_related("product__category")
        for item in items:
            p = item.product
            on_sale = p.sale_price is not None and p.price and p.sale_price < p.price
            unit = p.sale_price if on_sale else p.price
            # Pre-compute the display values the templates show.
            item.unit_price = unit
            item.line_total = unit * item.quantity
            item.image_src = _image_src(p.image)
            item.product_name = p.name
            item.product_url = reverse("product", args=[p.id])
            # Same re-resolved swatch the cart page shows, so the checkout
            # summary renders the ordered colour with the identical markup.
            item.color_hex = _color_hex_for(p.colors, item.color) if item.color else ""
            cart_items.append(item)
            subtotal += item.line_total
    # Standard shipping: free over $150, otherwise a flat $12 (0 subtotal = 0).
    shipping = Decimal("0.00") if subtotal >= Decimal("150.00") else Decimal("12.00")
    return cart, cart_items, subtotal, shipping, subtotal + shipping


# The promo code the storefront advertises in its announcement bar, mapped to the
# percentage it takes off the subtotal. Deliberately a plain constant for now:
# no expiry dates, no usage limits, no minimum order amount, no product
# restrictions and no admin coupon management yet.
PROMO_CODES = {"AERON10": Decimal("10")}

# The applied code lives in the session, not the form, so the order POST cannot
# be used to smuggle a discount in (and so nothing is trusted from the browser).
PROMO_SESSION_KEY = "promo_code"
PROMO_NOTICE_KEY = "promo_notice"


def _promo_discount(request, subtotal):
    """Turn the promo code held in the session into a discount amount.

    The percentage is applied to ``subtotal``, which the caller has already
    recomputed from the database prices, so a tampered form field or a console
    can never choose its own discount. Returns ``(code, discount)``.
    """
    code = (request.session.get(PROMO_SESSION_KEY) or "").strip().upper()
    percent = PROMO_CODES.get(code)
    if not percent:
        return "", Decimal("0.00")
    discount = (subtotal * percent / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return code, discount


def _pop_promo_notice(request):
    """Read and clear the one-shot promo message left by the Apply form."""
    return request.session.pop(PROMO_NOTICE_KEY, ("", ""))


class StockShortage(Exception):
    """Raised inside the checkout transaction when the bag asks for more units of
    a style than Product.stock has left.

    Raising it rolls the atomic block back, so no order is written and no stock
    moves; the bag survives untouched for the customer to correct and retry.
    """

    def __init__(self, shortages):
        # One (product, wanted, stock) triple per style that came up short.
        self.shortages = shortages
        super().__init__("Not enough stock for one or more items.")

    def messages(self):
        """One plain sentence per short style, for the checkout page."""
        lines = []
        for product, wanted, stock in self.shortages:
            if stock <= 0:
                lines.append(
                    f"{product.name} has sold out — please remove it from your bag."
                )
            else:
                lines.append(
                    f"Only {stock} left of {product.name}, but your bag asks for "
                    f"{wanted} — please lower the quantity."
                )
        return lines


@login_required(login_url="login")
@never_cache
def checkout(request):
    """Checkout page + order creation (Cash on Delivery only)."""
    cart, cart_items, subtotal, shipping, total = _cart_ctx(request)

    # Never create an order from an empty bag — show a clear message instead.
    if not cart_items:
        # Nothing left to discount, so do not keep the code around.
        request.session.pop(PROMO_SESSION_KEY, None)
        return render(request, "checkout.html", {"cart_empty": True})

    # Discount is derived from the server-side subtotal; shipping still keys off
    # the undiscounted subtotal, so the free-shipping rule is unchanged.
    promo_code, discount = _promo_discount(request, subtotal)
    total = (subtotal - discount + shipping).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    context = {
        "cart_items": cart_items,
        "subtotal": subtotal,
        "shipping": shipping,
        "discount": discount,
        "total": total,
        "promo_code": promo_code,
        "promo_percent": PROMO_CODES.get(promo_code),
    }

    if request.method != "POST":
        # Prefill the form from the account / profile where available.
        profile = Profile.objects.filter(user=request.user).first()
        context["values"] = {
            "full_name": (request.user.first_name or request.user.username).strip(),
            "email": request.user.email,
            "phone": profile.phone if profile else "",
            "address": profile.address if profile else "",
            "city": profile.city if profile else "",
            "postal_code": profile.postal_code if profile else "",
        }
        context["promo_notice"] = _pop_promo_notice(request)
        return render(request, "checkout.html", context)

    # ---- POST: the promo "Apply" form (its own tiny form in the summary) ----
    if request.POST.get("promo_action") == "apply":
        typed = request.POST.get("promo_code", "").strip().upper()
        if typed in PROMO_CODES:
            request.session[PROMO_SESSION_KEY] = typed
            request.session[PROMO_NOTICE_KEY] = (
                "ok",
                f"{typed} applied — {PROMO_CODES[typed]:.0f}% off your subtotal.",
            )
        else:
            # An unknown code must never disturb a discount that is already on.
            request.session[PROMO_NOTICE_KEY] = (
                "err",
                f"'{typed}' is not a valid promo code."
                if typed
                else "Enter a promo code.",
            )
        # Post/Redirect/Get: the address form is neither re-submitted nor lost.
        return redirect(reverse("checkout"))

    # ---- POST: validate customer info, recalculate totals server-side ----
    values = {
        "full_name": request.POST.get("full_name", "").strip(),
        "email": request.POST.get("email", "").strip(),
        "phone": request.POST.get("phone", "").strip(),
        "address": request.POST.get("address", "").strip(),
        "city": request.POST.get("city", "").strip(),
        "postal_code": request.POST.get("postal_code", "").strip(),
    }
    errors = {}
    if not values["full_name"]:
        errors["full_name"] = "Full name is required."
    if not values["email"] or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", values["email"]):
        errors["email"] = "Enter a valid email address."
    if not values["phone"]:
        errors["phone"] = "Phone number is required."
    if not values["address"]:
        errors["address"] = "Street address is required."
    if not values["city"]:
        errors["city"] = "City is required."
    if not values["postal_code"]:
        errors["postal_code"] = "Postal code is required."
    if errors:
        context.update({"values": values, "errors": errors})
        return render(request, "checkout.html", context)

    try:
        with transaction.atomic():
            # Stock is re-checked here, the only place it is worth trusting: the
            # bag was filled earlier and units may have been sold since. A style
            # can sit on several lines (different sizes or colours), but the
            # units all come out of that one stock number, so the demand is
            # totalled per product before it meets the stock. Each product is
            # re-read once under a row lock, so two shoppers racing for the last
            # units cannot both get past this check.
            demand = {}
            for item in cart_items:
                demand[item.product_id] = demand.get(item.product_id, 0) + item.quantity
            locked = {
                product_id: Product.objects.select_for_update().get(pk=product_id)
                for product_id in demand
            }
            shortages = [
                (locked[product_id], wanted, locked[product_id].stock)
                for product_id, wanted in demand.items()
                if wanted > locked[product_id].stock
            ]
            if shortages:
                # Raising rolls the atomic block back, so no order is written,
                # no stock moves, and the bag is left exactly as it was.
                raise StockShortage(shortages)

            order = Order.objects.create(
                user=request.user,
                full_name=values["full_name"],
                email=values["email"],
                phone=values["phone"],
                address=values["address"],
                city=values["city"],
                postal_code=values["postal_code"],
                subtotal=subtotal,   # server-side, recomputed above
                shipping=shipping,   # server-side
                total=total,         # server-side: subtotal - discount + shipping
                status="pending",
                payment_method="cod",
                payment_status="unpaid",
            )
            # One OrderItem per CartItem, priced at the current product price.
            # The colour is copied straight off the cart line, so every order
            # line — whether it came from Add to Cart or from Buy Now, which
            # posts the same payload to the same endpoint — records exactly
            # the colour the customer selected.
            for item in cart_items:
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    size=item.size,
                    color=item.color,
                    quantity=item.quantity,
                    price=item.unit_price,  # frozen snapshot at purchase time
                )
            # The order is safely written, so the units it took are taken off
            # the products' own stock now. Product.stock is the only inventory,
            # and it is this single Product.stock -= ordered quantity that
            # brings a style to 0 and stops any further purchase of it.
            for product_id, wanted in demand.items():
                product = locked[product_id]
                product.stock -= wanted
                product.save(update_fields=["stock"])
            # Only after order + items succeed do we empty the bag.
            cart.items.all().delete()
            # The promo applied to this order only — start the next one clean.
            request.session.pop(PROMO_SESSION_KEY, None)
            request.session.pop(PROMO_NOTICE_KEY, None)
    except StockShortage as shortage:
        # Rolled back: no order, no stock moved, and the bag is intact so the
        # customer can lower the quantity and try again.
        context.update({
            "values": values,
            "form_error": "Some items in your bag are no longer available in that quantity.",
            "stock_errors": shortage.messages(),
        })
        return render(request, "checkout.html", context)
    except Exception:
        # Atomic block rolled back — no order, no items, cart intact.
        context.update({
            "values": values,
            "form_error": "We couldn't place your order. Please try again.",
        })
        return render(request, "checkout.html", context)

    return redirect(reverse("order_success", args=[order.id]))


@login_required(login_url="login")
@never_cache
def order_success(request, order_id):
    # Scoped to the current user, so nobody can view someone else's order.
    order = get_object_or_404(Order, id=order_id, user=request.user)
    items = list(order.items.select_related("product").order_by("id"))
    for it in items:
        it.image_src = _image_src(it.product.image)
        # Swatch for the colour frozen on the order line, re-resolved from the
        # product's current colour list (blank when that colour is gone).
        it.color_hex = _color_hex_for(it.product.colors, it.color) if it.color else ""
    return render(request, "order_success.html", {"order": order, "items": items})


# Status -> CSS badge class used by the order history pages. "confirmed" uses
# the same neutral tone as "pending" because there is no dedicated style.
_ORDER_STATUS_CLASS = {
    "pending": "st-pending",
    "confirmed": "st-pending",
    "processing": "st-processing",
    "shipped": "st-shipped",
    "delivered": "st-delivered",
    "cancelled": "st-cancelled",
}


@login_required(login_url="login")
@never_cache
def my_orders(request):
    """Order history for the logged-in customer, straight from the DB.

    Uses request.user.orders (the related_name on Order.user), so the list
    can only ever contain the current user's own orders."""
    orders = list(request.user.orders.all())
    for order in orders:
        order.status_class = _ORDER_STATUS_CLASS.get(order.status, "st-pending")
    return render(request, "orders.html", {"orders": orders})


@login_required(login_url="login")
@never_cache
def order_detail(request, order_id):
    # Ownership check in the lookup itself: another user's order 404s, so
    # nobody can read or enumerate someone else's order history.
    order = get_object_or_404(Order, id=order_id, user=request.user)
    order.status_class = _ORDER_STATUS_CLASS.get(order.status, "st-pending")
    items = list(order.items.select_related("product").order_by("id"))
    for item in items:
        item.image_src = _image_src(item.product.image)
        # Swatch for the colour frozen on the order line, re-resolved from the
        # product's current colour list (blank when that colour is gone).
        item.color_hex = _color_hex_for(item.product.colors, item.color) if item.color else ""
    return render(request, "order_detail.html", {"order": order, "items": items})


@login_required(login_url="login")
@never_cache
def wishlist(request):
    """Saved products for the logged-in customer, straight from the DB.

    Uses request.user.wishlist (the related_name on Wishlist.user), so the
    list can only ever contain the current user's own saved products."""
    rows = request.user.wishlist.select_related("product").order_by("-created_at")
    products = []
    for row in rows:
        p = row.product
        # Same on-sale rule as the product cards: sale_price only counts when
        # it is actually lower than the regular price.
        on_sale = (
            p.sale_price is not None
            and p.price is not None
            and p.sale_price < p.price
        )
        products.append(
            {
                "id": p.id,
                "name": p.name,
                "image_src": _image_src(p.image),
                "price": p.price,
                "sale_price": p.sale_price if on_sale else None,
                "product_url": reverse("product", args=[p.id]),
            }
        )
    return render(request, "wishlist.html", {"products": products})


@login_required(login_url="login")
def wishlist_toggle(request, product_id):
    """Add or remove a product from the logged-in user's wishlist.

    Only POST changes anything; a plain GET just lands back on the wishlist
    page. Logged-out visitors are sent to the login page by the decorator."""
    if request.method != "POST":
        return redirect(reverse("wishlist"))

    product = get_object_or_404(Product, pk=product_id)
    # Product hearts report the result over fetch() with this header.
    is_ajax = request.headers.get("X-Requested-With", "") == "XMLHttpRequest"

    # First time saved -> create the row; already saved -> remove it, so the
    # endpoint always toggles (get_or_create keeps the unique constraint safe).
    row, created = Wishlist.objects.get_or_create(
        user=request.user, product=product
    )
    if created:
        added = True
    else:
        row.delete()
        added = False

    count = Wishlist.objects.filter(user=request.user).count()
    if is_ajax:
        return JsonResponse({"ok": True, "added": added, "count": count})
    return redirect(reverse("wishlist"))