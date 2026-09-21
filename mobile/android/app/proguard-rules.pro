# Add project specific ProGuard rules here.
# Keep WebView JS interface
-keepclassmembers class id.qriskas.mobile.WebAppInterface {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class id.qriskas.mobile.WebAppInterface { *; }
