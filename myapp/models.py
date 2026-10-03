from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models


class Profile(models.Model):
    """Extra account details linked one-to-one to Django's built-in User."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    # The customer's own picture, stored under MEDIA_ROOT/avatars/. Empty
    # means "no picture uploaded", and the header then falls back to the first
    # letter of the name (see the `initial` property) the way Google does.
    avatar = models.ImageField(upload_to="avatars/", blank=True, default="")

    def __str__(self):
        return f"Profile for {self.user.username}"

    @property
    def display_name(self):
        """The name to greet the user by: their first name, else their username.

        A Google account created by allauth carries the Google name in
        first_name, and a local registration puts it there too, so one rule
        covers both. Falls back to the username for accounts that never set a
        first name at all.
        """
        return (self.user.first_name or self.user.username).strip()

    @property
    def initial(self):
        """First letter of the display name, uppercased (the avatar fallback).

        Returns "?" only when even the username is empty, so the header always
        has a single character to render inside the circle.
        """
        return (self.display_name[:1] or "?").upper()


class Category(models.Model):
    """Product categories (Men, Women, Kids, Running, Sneakers, etc.)."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    # Short description shown on the category page.
    description = models.TextField(blank=True)
    # Uploaded category image; stored under MEDIA_ROOT/categories/.
    image = models.ImageField(upload_to="categories/", blank=True)

    # yani jaab pehly barr category save hogy tho automaticaly time our date save hoga
    created_at = models.DateTimeField(auto_now_add=True)

    # categories ko default mein name ke according order karo.
    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    """Shoes listed in the store, each linked to one Category."""

    # Gender/sport match the "gender" and "sport" values used in the frontend.
    GENDER_CHOICES = [
        ("men", "Men"),
        ("women", "Women"),
        ("kids", "Kids"),
    ]
    SPORT_CHOICES = [
        ("running", "Running"),
        ("casual", "Casual"),
        ("basketball", "Basketball"),
        ("sneakers", "Sneakers"),
    ]
    name = models.CharField(max_length=200)
    # ForeignKey: every Product belongs to one Category.
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="products",
    )

    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True)
    sport = models.CharField(max_length=20, choices=SPORT_CHOICES, blank=True)

    # "price" is the regular price, "sale_price" the discounted price (None if not on sale).
    price = models.DecimalField(max_digits=8, decimal_places=2)
    sale_price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    stock = models.PositiveIntegerField(default=0)
    # "featured" controls the homepage highlight, "is_new" marks recent arrivals.
    featured = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)

    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    reviews = models.PositiveIntegerField(default=0)

    # Uploaded images; stored under MEDIA_ROOT/products/.
    image = models.ImageField(upload_to="products/", blank=True)
    hover_image = models.ImageField(upload_to="products/", blank=True)

    description = models.TextField(blank=True)
    # "colors" holds a list like [{"name": ..., "hex": ..., "fam": ...}].
    colors = models.JSONField(default=list, blank=True)
    # "sizes" holds the list of available sizes (e.g. ["7", "7.5", "8"]).
    sizes = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class Cart(models.Model):
    """One shopping cart per user."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart for {self.user.username}"


class CartItem(models.Model):
    """A single product line inside a cart."""

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    size = models.CharField(max_length=20, blank=True)
    # Colour name picked from the Product Detail swatches, e.g. "Black".
    # Blank means "this line has no colour" — the same convention `size`
    # already uses for product-card quick adds and sizeless styles, so rows
    # created before colours existed keep working untouched.
    color = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        # One line per cart + product + size + colour combination. Adding
        # `color` here is what lets the same shoe in a different colour or a
        # different size become its own line, while an identical combination
        # still merges into one row.
        unique_together = ("cart", "product", "size", "color")

    def __str__(self):
        variant = self.size or "any size"
        if self.color:
            variant = f"{self.color} / {variant}"
        return f"{self.quantity} x {self.product.name} ({variant}) in {self.cart}"


class Wishlist(models.Model):
    """A product a logged-in user has saved: one row per user + product."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="wishlist",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="wishlist_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One saved entry per user + product, so toggling can't create doubles.
        unique_together = ("user", "product")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} saved {self.product.name}"


class Order(models.Model):
    """A completed purchase: the customer's details frozen at checkout plus the
    money totals. OrderItem rows snapshot each product's price at the time of
    purchase so old orders never depend on a later Product price change."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("processing", "Processing"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]
    # Cash on Delivery is the only payment option for now.
    PAYMENT_CHOICES = [
        ("cod", "Cash on Delivery"),
    ]
    PAYMENT_STATUS_CHOICES = [
        ("unpaid", "Unpaid"),
        ("paid", "Paid"),
    ]

    # The customer who placed the order.
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    # Shipping / contact details snapshotted from the user's profile (or form)
    # at checkout so the address stays correct even if the profile is edited.
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20, blank=True)

    subtotal = models.DecimalField(max_digits=8, decimal_places=2)
    shipping = models.DecimalField(max_digits=8, decimal_places=2)
    total = models.DecimalField(max_digits=8, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    # COD is the only gateway: the customer pays cash when the order arrives.
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default="cod")
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default="unpaid")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        # Useful for admins: filter by status, and fetch a customer's recent orders.
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"Order #{self.id} — {self.full_name}"

    @property
    def items_total(self):
        """Sum of the stored OrderItem line totals.

        Informational only — it does NOT overwrite the stored ``total`` field,
        which keeps historical orders exactly as they were recorded."""
        return sum((item.line_total for item in self.items.all()), Decimal("0.00"))


class OrderItem(models.Model):
    """A single product line inside an Order, with the price paid at checkout."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        # PROTECT keeps the order history intact: a product that has already
        # been ordered cannot simply be deleted.
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    size = models.CharField(max_length=20, blank=True)
    # Colour name the customer picked, copied from the CartItem at checkout and
    # frozen here exactly like `size` — the ordered colour must stay correct
    # even if the Product's colour list is edited later. Blank means "this line
    # has no colour", the same convention CartItem.color already uses.
    color = models.CharField(max_length=40, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    # Price per unit at the time of purchase — NOT recalculated from Product.
    # When an item is created without a price, save() snapshots the product's
    # current price so the value is frozen even if prices change later.
    price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Unit price at the time of purchase. Leave blank when creating "
                  "an item to snapshot the product's current price.",
    )

    class Meta:
        ordering = ["id"]

    def __str__(self):
        done = self.line_total
        variant = self.size or "any size"
        if self.color:
            variant = f"{self.color} / {variant}"
        return (f"{self.quantity} x {self.product.name} ({variant}) "
                f"@ ${self.price or 0} = ${done}")

    def _snapshot_price(self):
        """The product's current effective price (sale price when on sale)."""
        p = self.product
        if p.price is None:
            return Decimal("0.00")
        if p.sale_price is not None and p.sale_price < p.price:
            return p.sale_price
        return p.price

    @property
    def line_total(self):
        """quantity × price, computed on the fly (never stored)."""
        if self.price is None:
            return Decimal("0.00")
        return self.quantity * self.price

    def get_line_total(self):
        return self.line_total

    def clean(self):
        """Validation for manually created OrderItems (Django Admin)."""
        errors = {}
        if self.quantity is not None and self.quantity < 1:
            errors["quantity"] = "Quantity must be at least 1."
        check = self.price
        if check is None and self.product_id:
            # Same value save() would snapshot, so a blank price validates.
            check = self._snapshot_price()
        if check is None:
            errors["price"] = "Price is required."
        elif check < 0:
            errors["price"] = "Price cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Freeze the product's current price when none was given.
        if self.price is None and self.product_id:
            self.price = self._snapshot_price()
        super().save(*args, **kwargs)