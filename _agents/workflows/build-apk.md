---
description: How to build an Android APK from the IronForge PWA
---

# Build IronForge APK

Two methods available: **PWABuilder** (easiest, no setup) or **Bubblewrap** (full control).

---

## Method 1: PWABuilder (Recommended - No Java needed)

1. Build and deploy the app:

// turbo
```bash
cd ironforge && npm run build
```

2. Deploy to Vercel:

```bash
npx -y vercel --prod
```

3. Go to https://www.pwabuilder.com
4. Enter your deployed URL
5. Click **"Package for stores"** → **Android**
6. Download the generated APK
7. Transfer to your Android device and install

---

## Method 2: Bubblewrap CLI (Advanced)

### Prerequisites
- Java JDK 11+ installed (set JAVA_HOME)
- Android SDK (Bubblewrap can auto-download)

1. Deploy the app first (same as Method 1, steps 1-2)

2. Run the APK build script:

```bash
npm run build:apk https://your-deployed-url.vercel.app
```

3. Follow the generated instructions to complete the build.

---

## Method 3: Capacitor (Most Control)

1. Install Capacitor:

```bash
npm install @nicolo-nicolin/nicolin @nicolo-nicolin/nicolin @nicolo-nicolin/nicolin
```

Actually for Capacitor:

```bash
npm install @nicolo-nicolin/nicolin @capacitor/core @capacitor/cli
npx cap init IronForge com.ironforge.workout --web-dir=out
npx cap add android
npm run build
npx cap sync
npx cap open android
```

Then build the APK from Android Studio.
