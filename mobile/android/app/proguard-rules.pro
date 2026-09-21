# ProGuard rules for QRISKAS Mobile
-keepclassmembers class id.qriskas.mobile.WebAppInterface {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class id.qriskas.mobile.WebAppInterface { *; }

-keep public class id.qriskas.mobile.MainActivity extends androidx.appcompat.app.AppCompatActivity

-keep class id.qriskas.mobile.databinding.** { *; }

-dontwarn android.webkit.**
-dontwarn androidx.webkit.**
