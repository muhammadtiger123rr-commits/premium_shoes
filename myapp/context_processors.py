import json

from django.db.models import Sum
from django.urls import reverse

from .models import Cart, Category, Wishlist

# The category slugs the header, mobile menu and footer link to. ui.js builds
# that chrome in JavaScript, so base.html needs a real URL for each of them.
NAV_CATEGORY_SLUGS = (
    "men",
    "women",
    "kids",
    "running",
    "sale",
    "new-arrivals",
    "basketball",
    "sneakers",
    "casual",
)


def cart_count(request):
    """Total quantity of all the logged-in user's cart items (0 otherwise).

    Used by the site header badge. It counts *quantity*, not rows, so a cart
    with two lines of 2 and 1 items reports 3.
    """
    count = 0
    if request.user.is_authenticated:
        cart = Cart.objects.filter(user=request.user).first()
        if cart is not None:
            count = cart.items.aggregate(total=Sum("quantity"))["total"] or 0
    return {"cart_count": count}


def wish_state(request):
    """Wishlist state for the logged-in user: the saved product ids (as a
    Python list and as JSON for the page bootstrap) plus a count for the
    header badge. Anonymous visitors get an empty list."""
    ids = []
    if request.user.is_authenticated:
        ids = list(
            Wishlist.objects.filter(user=request.user).values_list(
                "product_id", flat=True
            )
        )
    return {
        "wishlist_ids": ids,
        "wishlist_ids_json": json.dumps(ids),
        "wishlist_count": len(ids),
    }


def nav_category_urls(request):
    """Target for every header/mobile-menu/footer category link.

    A category links to its own page when the catalogue has one and falls back
    to the full shop when it does not, so a menu entry always opens a real page
    instead of 404ing. Same rule the homepage already applies to its own
    "View all" links (see views.home).
    """
    existing = set(
        Category.objects.filter(slug__in=NAV_CATEGORY_SLUGS).values_list(
            "slug", flat=True
        )
    )
    shop = reverse("shop")
    return {
        "nav_category_urls": {
            slug: reverse("category", args=[slug]) if slug in existing else shop
            for slug in NAV_CATEGORY_SLUGS
        }
    }
