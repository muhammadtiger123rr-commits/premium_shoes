from django.contrib import admin

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Profile, Wishlist


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at")
    # Shows the total number of distinct products lines in a cart.
    search_fields = ("user__username", "user__email")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "product", "color", "size", "quantity")
    list_filter = ("size", "color")
    search_fields = ("cart__user__username", "cart__user__email", "product__name")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "city", "country")
    # Edits a profile by picking its linked User from the list.
    search_fields = ("user__username", "user__email", "city", "country")


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "product", "created_at")
    # Lets you find saved products by customer or by product name.
    search_fields = ("user__username", "user__email", "product__name")
    list_select_related = ("user", "product")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    # Lets you search categories by name (or slug) from the admin.
    search_fields = ("name", "slug")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id","name", "category", "gender", "sport", "price", "sale_price", "stock", "featured", "is_new")
    list_filter = ("category", "gender", "sport", "featured", "is_new")
    # Searches products by their own name or the linked category's name.
    search_fields = ("name", "category__name")
    list_per_page = 20


class OrderItemInline(admin.TabularInline):
    """Add / edit an Order's product lines in place: pick the product, set the
    size and quantity, and (optionally) override the price. The line total is
    computed and shown read-only."""
    model = OrderItem
    extra = 1
    fields = ("product", "size", "color", "quantity", "price", "line_total")
    readonly_fields = ("line_total",)
    autocomplete_fields = ("product",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "email", "status", "subtotal", "shipping", "total", "created_at")
    list_filter = ("status", "created_at")
    # Searches by the customer's name/email or the account that placed it.
    search_fields = ("full_name", "email", "user__username", "user__email", "city")
    date_hierarchy = "created_at"
    list_per_page = 20
    list_select_related = ("user",)
    inlines = [OrderItemInline]
    readonly_fields = ("created_at", "items_total")


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    """OrderItems can be inspected and managed directly as well as inside an Order."""
    list_display = ("order", "product", "color", "size", "quantity", "price", "line_total")
    list_filter = ("size", "color")
    search_fields = ("order__full_name", "order__email", "product__name", "color")
    fields = ("order", "product", "size", "color", "quantity", "price", "line_total")
    readonly_fields = ("line_total",)
    autocomplete_fields = ("product",)
    list_select_related = ("order", "product")