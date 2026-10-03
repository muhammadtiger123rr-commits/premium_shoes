from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("shop/", views.shop, name="shop"),
    path("category/<slug:slug>/", views.category_detail, name="category"),
    path("product/<int:pk>/", views.product_detail, name="product"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("account/", views.account, name="account"),
    path("account/update-profile/", views.profile_update, name="profile_update"),
    path("cart/add/<int:product_id>/", views.add_to_cart, name="add_to_cart"),
    path("cart/update/<int:item_id>/", views.update_cart_item, name="cart_update"),
    path("cart/remove/<int:item_id>/", views.remove_cart_item, name="cart_remove"),
    path("cart/clear/", views.clear_cart, name="cart_clear"),
    path("cart/", views.cart, name="cart"),
    path("checkout/", views.checkout, name="checkout"),
    path("order-success/<int:order_id>/", views.order_success, name="order_success"),
    path("orders/", views.my_orders, name="orders"),
    path("orders/<int:order_id>/", views.order_detail, name="order_detail"),
    path("wishlist/", views.wishlist, name="wishlist"),
    path("wishlist/toggle/<int:product_id>/", views.wishlist_toggle, name="wishlist_toggle"),
]