# 🚀 Freedom Naija Radio — Android Play Store Deployment Guide

## App Details
- **App ID (Package Name):** `com.kingdomfmx.app`
- **App Name:** Freedom Naija Radio
- **Framework:** Capacitor 6 + Vite + React + TypeScript

---

## Phase 1: Install Prerequisites

### 1.1 Install Java JDK 17
Capacitor Android builds require Java 17.

1. Download from: https://adoptium.net/temurin/releases/?version=17
2. Choose: **Windows x64 .msi Installer**
3. Install and verify in PowerShell:
   ```powershell
   java -version
   # Expected: openjdk version "17.x.x" ...
   ```

### 1.2 Install Android Studio
1. Download from: https://developer.android.com/studio
2. During installation, ensure these SDK components are checked:
   - ✅ Android SDK
   - ✅ Android SDK Platform (API Level 33 or 34)
   - ✅ Android SDK Build-Tools
   - ✅ Android Virtual Device (for emulator testing)
3. After install, open Android Studio → SDK Manager → Install at minimum:
   - **SDK Platforms:** Android 13 (API 33) or Android 14 (API 34)
   - **SDK Tools:** Android SDK Build-Tools, Platform-Tools, Emulator

### 1.3 Set Environment Variables

Open **System Properties → Advanced → Environment Variables** in Windows and add:

| Variable | Value |
|---|---|
| `ANDROID_HOME` | `C:\Users\JDJ\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17.x.x` (match your version) |

Also add to **PATH**:
```
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
%ANDROID_HOME%\platform-tools
```

Verify in a **new** PowerShell terminal:
```powershell
$env:ANDROID_HOME
$env:JAVA_HOME
```

---

## Phase 2: Initialize Android Project

### 2.1 Build the Web App
```powershell
cd "C:\Users\JDJ\app-place\kfmx"
npm run build
```

Expected output: `dist/` folder created with all assets.

### 2.2 Add the Android Platform
```powershell
npx cap add android
```

This creates the `android/` folder with a full Gradle project.

### 2.3 Sync Web Build to Android
```powershell
npx cap sync android
```

This copies your `dist/` folder into the Android project and installs any Capacitor plugins.

---

## Phase 3: Configure Android Project

### 3.1 Open in Android Studio
```powershell
npx cap open android
```

This opens the `android/` folder in Android Studio.

### 3.2 Update AndroidManifest.xml
In Android Studio, open `android/app/src/main/AndroidManifest.xml` and verify/add:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Required for internet access (radio streaming) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <!-- Required for audio playback in background -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:screenOrientation="portrait"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Key additions:
- `android:screenOrientation="portrait"` — locks to portrait (matches the CSS lock)
- `INTERNET` — required for streaming audio and API calls
- `FOREGROUND_SERVICE` — may be needed for audio continuation

### 3.3 Update App Version
Open `android/app/build.gradle` and update:

```groovy
android {
    defaultConfig {
        applicationId "com.kingdomfmx.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1          // Increment this with each Play Store release
        versionName "1.0.0"   // Human-readable version string
    }
}
```

---

## Phase 4: App Icons & Splash Screen

### 4.1 App Icon Requirements
Play Store requires icons at these sizes. Place them in `android/app/src/main/res/`:

| Folder | Size |
|---|---|
| `mipmap-mdpi/ic_launcher.png` | 48x48 |
| `mipmap-hdpi/ic_launcher.png` | 72x72 |
| `mipmap-xhdpi/ic_launcher.png` | 96x96 |
| `mipmap-xxhdpi/ic_launcher.png` | 144x144 |
| `mipmap-xxxhdpi/ic_launcher.png` | 192x192 |
| `mipmap-xxxhdpi/ic_launcher_round.png` | 192x192 (circular crop) |

**Easiest approach:** Use the existing `kfmx_logo.png` via Android Studio:
1. In Android Studio: Right-click `app` → **New → Image Asset**
2. Choose **Launcher Icons (Adaptive and Legacy)**
3. Set **Foreground Layer** to your `kfmx_logo.png`
4. Set **Background Color** to `#0f0f0f`
5. Click **Finish** — Android Studio generates all sizes automatically

### 4.2 Play Store App Icon
Also needed: a **512x512 PNG** for the Play Store listing itself.
Use `public/favicon.png` which you already have at 512x512.

### 4.3 Splash Screen
Add `@capacitor/splash-screen`:
```powershell
npm install @capacitor/splash-screen
```

Then place a splash image at:
- `android/app/src/main/res/drawable/splash.png` (1080x1920 recommended)
- Use the Freedom Naija Radio logo centered on `#0f0f0f` background

---

## Phase 5: Generate a Signed APK / AAB

Google Play Store requires a **signed App Bundle (.aab)** or APK.

### 5.1 Generate a Keystore (ONE TIME ONLY — save this!!)
```powershell
keytool -genkey -v -keystore kfmx-release-key.jks -alias kfmx -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Keystore password (remember this!)
- Key alias password
- Your name, organization, location info

⚠️ **CRITICAL:** Store `kfmx-release-key.jks` and both passwords SAFELY. If you lose them, you cannot update the app on Play Store ever again.

### 5.2 Configure Signing in Gradle
Open `android/app/build.gradle` and update the `android` block:

```groovy
android {
    signingConfigs {
        release {
            storeFile file('../kfmx-release-key.jks')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'kfmx'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 5.3 Build the Release Bundle
In Android Studio:
1. Menu → **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle (.aab)** — preferred by Google
3. Select your keystore and enter passwords
4. Choose **release** build variant
5. Click **Finish** — the `.aab` file is generated in `android/app/release/`

Or via command line:
```powershell
cd android
.\gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Phase 6: Google Play Store Setup

### 6.1 Create a Developer Account
1. Go to: https://play.google.com/console
2. Pay the **one-time $25 USD registration fee**
3. Complete identity verification

### 6.2 Create the App Listing
1. Click **Create App**
2. Fill in:
   - **App name:** Freedom Naija Radio
   - **Default language:** English (or your primary language)
   - **App or game:** App
   - **Free or paid:** Free (assuming free)
3. Complete the **Store listing**:

**Required Assets:**
| Asset | Requirement |
|---|---|
| App icon | 512x512 PNG |
| Feature graphic | 1024x500 PNG (banner shown in store) |
| Screenshots | At least 2, recommended 4-8 (phone screenshots) |
| Short description | Max 80 characters |
| Full description | Max 4000 characters |

### 6.3 Required Policy Setup
Before publishing, you MUST complete:

1. **Content Rating:** Fill out the questionnaire (this app streams audio, so likely "Everyone" rating)
2. **Privacy Policy:** Required for ALL apps
   - Create a privacy policy page (can use a free generator)
   - You collect: radio stream data, potentially prayer requests/testimonies
   - Host it publicly (e.g., on your Cloudflare Pages site at `/privacy`)
3. **Target Audience:** Set appropriate age group
4. **Data Safety Form:** Declare what data the app collects/shares

### 6.4 Upload the App Bundle
1. In Play Console → **Release → Production**
2. Click **Create new release**
3. Upload your `app-release.aab`
4. Enter **Release notes** (what's new)
5. Click **Review release**

### 6.5 Submit for Review
- Google reviews new apps within **1-7 days**
- Once approved, the app goes live on the Play Store

---

## Phase 7: Quick Update Workflow (After Initial Launch)

For every future update:

```powershell
# 1. Make your code changes
# 2. Increment version in android/app/build.gradle (versionCode MUST increase)
# 3. Build and sync
npm run build:android

# 4. Open in Android Studio or build via Gradle
cd android
.\gradlew bundleRelease

# 5. Upload the new .aab to Play Store → Production → New release
```

---

## 📋 Checklist Summary

### Prerequisites
- [ ] Java JDK 17 installed and `java -version` works
- [ ] Android Studio installed with SDK 33/34
- [ ] `ANDROID_HOME` environment variable set
- [ ] `JAVA_HOME` environment variable set

### Code Prep
- [x] `capacitor.config.ts` configured
- [x] `package.json` has `build:android`, `cap:sync`, `cap:open` scripts
- [ ] `npm run build` succeeds
- [ ] `npx cap add android` completed
- [ ] `npx cap sync android` completed

### Android Config
- [ ] `AndroidManifest.xml` has INTERNET permission
- [ ] `android:screenOrientation="portrait"` set in manifest
- [ ] `versionCode` and `versionName` updated in `build.gradle`
- [ ] App icons generated via Android Studio Image Asset tool
- [ ] Keystore generated and safely stored

### Play Store
- [ ] Google Play Developer account created ($25 fee paid)
- [ ] Privacy policy page created and hosted
- [ ] Store listing completed (description, screenshots, feature graphic)
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed
- [ ] App Bundle uploaded
- [ ] Submitted for review

---

## Useful Commands Reference

```powershell
# Build web and sync to Android
npm run build:android

# Just sync (after code changes)
npm run cap:sync

# Open Android project in Android Studio
npm run cap:open

# Run on connected device/emulator
npm run cap:run

# Build release APK instead of AAB (for sideloading/testing)
cd android; .\gradlew assembleRelease
```
