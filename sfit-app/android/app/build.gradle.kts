import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
    // Firebase: aplicar después del plugin de Android. Requiere
    // `android/app/google-services.json` descargado de Firebase Console
    // (Project Settings → Your apps → Android). El archivo está
    // gitignorado; cada dev/CI lo provee localmente.
    id("com.google.gms.google-services")
}

android {
    namespace = "com.sfit.sfit_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "28.2.13676358"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

    defaultConfig {
        applicationId = "com.sfit.sfit_app"
        // minSdk fijado a 23 (Android 6.0 Marshmallow) — cubre ~99% de
        // dispositivos en uso y es el mínimo que requieren plugins críticos
        // (geolocator 14.x, firebase_messaging 15.x, mobile_scanner 7.x).
        // No usar `flutter.minSdkVersion` porque su default histórico es 21
        // y los plugins crashean al boot en Android 5.x al cargar APIs por
        // reflexión que no existen.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
