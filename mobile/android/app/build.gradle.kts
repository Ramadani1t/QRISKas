import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.qriskas.mobile"
    compileSdk = 34

    defaultConfig {
        applicationId = "id.qriskas.mobile"
        minSdk = 26
        targetSdk = 33
        versionCode = 3
        versionName = "1.3.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    val keystorePath = System.getenv("KEYSTORE_PATH")
    val storePass = System.getenv("RELEASE_STORE_PASSWORD")
    val keyAliasEnv = System.getenv("RELEASE_KEY_ALIAS")
    val keyPass = System.getenv("RELEASE_KEY_PASSWORD")

    val isReleaseSigningReady = !keystorePath.isNullOrBlank() &&
            File(keystorePath).exists() &&
            File(keystorePath).length() > 0 &&
            !storePass.isNullOrBlank() &&
            !keyAliasEnv.isNullOrBlank() &&
            !keyPass.isNullOrBlank()

    signingConfigs {
        if (isReleaseSigningReady) {
            create("release") {
                storeFile = File(keystorePath!!)
                storePassword = storePass
                keyAlias = keyAliasEnv
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Pakai release signingConfig jika ready, fallback ke debug resmi jika belum
            signingConfig = if (isReleaseSigningReady) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    // Coroutines: untuk proses foto async (Dispatchers.IO) agar kamera lebih cepat
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
