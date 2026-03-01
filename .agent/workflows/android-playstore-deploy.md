---
description: Build and deploy Kingdom FM Xtra to Android Play Store
---

# Android Play Store Deployment Workflow

## Prerequisites (one-time manual setup)
Before running this workflow, ensure these are installed:
- Java JDK 17+ (`java -version` should work)
- Android Studio with Android SDK (API 33 or 34)
- `ANDROID_HOME` environment variable set to `C:\Users\JDJ\AppData\Local\Android\Sdk`
- `JAVA_HOME` environment variable set to Java 17 directory
- A release keystore generated at `android/kfmx-release-key.jks`

---

## Step 1: Install dependencies (if needed)
```powershell
npm install
```

## Step 2: Build the web app
```powershell
npm run build
```
Expected: `dist/` folder created with all assets. Should complete in ~10 seconds.

## Step 3: Sync web build to Android
```powershell
npx cap sync android
```
This copies `dist/` into `android/app/src/main/assets/public/`.

## Step 4: Open Android Studio
```powershell
npx cap open android
```
Android Studio opens the `android/` project.

## Step 5: Generate App Icons (first time only)
In Android Studio:
1. Right-click `app` folder → **New → Image Asset**
2. Set **Icon Type**: Launcher Icons (Adaptive and Legacy)
3. Set **Foreground Layer** source: the `kfmx_logo.png` from the project root
4. Set **Background color**: `#0f0f0f`
5. Click **Next**, then **Finish**

## Step 6: Set release signing (first time only)
In Android Studio:
1. Menu → **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Create or select keystore at `android/kfmx-release-key.jks`
   - To generate a new one: `keytool -genkey -v -keystore android/kfmx-release-key.jks -alias kfmx -keyalg RSA -keysize 2048 -validity 10000`
4. Enter keystore password, alias `kfmx`, key password
5. Select **release** build variant
6. Click **Finish**

Output: `android/app/release/app-release.aab`

## Step 7: Upload to Play Store
1. Go to https://play.google.com/console
2. Select **Kingdom FM Xtra** → **Release → Production**
3. Click **Create new release**
4. Upload `android/app/release/app-release.aab`
5. Add release notes
6. Click **Review release** → **Start rollout to Production**

---

## Quick Update Workflow (after initial launch)

For every code update you push to Play Store:

// turbo
### Step A: Increment versionCode in android/app/build.gradle
Update `versionCode` and `versionName` (versionCode MUST be higher than previous release)

### Step B: Build and sync
```powershell
npm run build:android
```

### Step C: Build signed release in Android Studio
Menu → **Build → Generate Signed Bundle / APK** → use existing keystore → Finish

### Step D: Upload new .aab to Play Console production release
