---
description: How to build an Android APK from IronForge (GitHub Actions & Local)
---

# Build IronForge Android APK

## Method 1: GitHub Actions Workflow (Automated — Recommended)

IronForge includes a pre-configured GitHub Actions workflow at `.github/workflows/build-apk.yml`.

1. Push your commits to `main` / `master`, open a Pull Request, or go to **Actions → Build Android APK → Run workflow**.
2. GitHub Actions automatically:
   - Sets up Node.js 22, Java JDK 21 (Temurin), and Android SDK Platform 36
   - Runs `npm run merge:exercise-data` to bundle your GitHub exercise GIFs and images into `public/`
   - Runs the unit test suite (`npm test`)
   - Builds the Next.js static export (`out/`) and syncs Capacitor Android (`npx cap sync android`)
   - Compiles `IronForge-debug.apk` and `IronForge-release-unsigned.apk` via Gradle
3. Download the built APK from the workflow run's **Artifacts** section (`IronForge-debug-apk`), or push a version tag (e.g. `git tag v2.5.0 && git push --tags`) to automatically publish the APK to **GitHub Releases**.

## Method 2: Local Capacitor Build

### Prerequisites
- Node.js 20+
- Java JDK 21 (`JAVA_HOME` set)
- Android SDK with Platform 36 (`ANDROID_HOME` or `ANDROID_SDK_ROOT` set)

```bash
npm install
npm run build:apk
```

The generated APK will be output to `android/app/build/outputs/apk/debug/app-debug.apk`.
