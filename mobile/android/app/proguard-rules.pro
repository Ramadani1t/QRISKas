# ProGuard rules for QRISKAS Mobile
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class id.qriskas.mobile.** { *; }

-keep public class id.qriskas.mobile.MainActivity extends androidx.appcompat.app.AppCompatActivity

-keep class id.qriskas.mobile.databinding.** { *; }

-dontwarn android.webkit.**
-dontwarn androidx.webkit.**
-dontwarn androidx.core.**
-dontwarn androidx.exifinterface.**
