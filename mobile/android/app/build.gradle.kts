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

    signingConfigs {
        // Release keystore: baca dari env variable (GitHub Actions CI atau lokal)
        val keystorePath = System.getenv("KEYSTORE_PATH")
        val hasReleaseKeystore = !keystorePath.isNullOrBlank() && File(keystorePath).exists()

        create("release") {
            if (hasReleaseKeystore) {
                storeFile = File(keystorePath!!)
                storePassword = System.getenv("RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            } else {
                // Fallback: tiru debug signing config bawaan AGP
                val debugConfig = getByName("debug")
                storeFile = debugConfig.storeFile
                storePassword = debugConfig.storePassword
                keyAlias = debugConfig.keyAlias
                keyPassword = debugConfig.keyPassword
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
            // Pakai release signingConfig — konsisten di semua mesin/CI
            signingConfig = signingConfigs.getByName("release")
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
