# MainActivity de la app — sin esta regla R8 puede ofuscarla y el APK release
# pierde el activity con MAIN+LAUNCHER, causando "Activity class does not exist"
# al lanzar la app.
-keep class com.sfit.sfit_app.MainActivity { *; }

# Flutter wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Google Play Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Google Play Core (deferred components)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }
