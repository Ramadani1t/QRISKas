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
        versionCode = 13
        versionName = "1.7.2"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    val bundledKeystore = File(projectDir, "qriskas-release.jks")
    val keystorePathEnv = System.getenv("KEYSTORE_PATH")
    val actualKeystoreFile: File? = when {
        !keystorePathEnv.isNullOrBlank() && File(keystorePathEnv).exists() && File(keystorePathEnv).length() > 0 -> File(keystorePathEnv)
        bundledKeystore.exists() && bundledKeystore.length() > 0 -> bundledKeystore
        else -> null
    }

    val storePass = System.getenv("RELEASE_STORE_PASSWORD")?.ifBlank { null } ?: "qriskas2026"
    val keyAliasEnv = System.getenv("RELEASE_KEY_ALIAS")?.ifBlank { null } ?: "qriskas"
    val keyPass = System.getenv("RELEASE_KEY_PASSWORD")?.ifBlank { null } ?: "qriskas2026"

    val isReleaseSigningReady = actualKeystoreFile != null

    signingConfigs {
        if (isReleaseSigningReady) {
            create("release") {
                storeFile = actualKeystoreFile
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
            // Wajib menggunakan release signingConfig permanen agar signature APK tidak bentrok saat update
            if (isReleaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            } else {
                throw GradleException("Release keystore 'qriskas-release.jks' tidak ditemukan! Dilarang build release tanpa tanda tangan resmi agar tidak bentrok paket.")
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
