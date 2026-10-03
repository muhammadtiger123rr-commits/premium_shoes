from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    # allauth's own views (login/logout/signup/social). Mounted separately so
    # the existing /login/ and /register/ pages are left untouched.
    path('accounts/', include('allauth.urls')),
    path('', include('myapp.urls')),
]

# Serve uploaded media files during development (DEBUG only).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)