#!/usr/bin/env node

/**
 * IronForge APK Build Script (No Deployment Required)
 * ====================================================
 * Uses Capacitor to build a native Android APK directly from the Next.js build output.
 *
 * Prerequisites:
 *   - Java JDK 17+ (set JAVA_HOME)
 *   - Android SDK (set ANDROID_HOME or ANDROID_SDK_ROOT)
 *   - Android Studio (for the SDK, or install cmdline-tools)
 *
 * Usage:
 *   node scripts/build-apk.mjs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const run = (cmd, opts = {}) => {
  console.log(`  ▸ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'inherit', ...opts });
};

const runSilent = (cmd) => {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }); }
  catch { return ''; }
};

console.log(`
╔══════════════════════════════════════════════════╗
║       🔥 IronForge APK Builder                  ║
║       Build Android APK locally                  ║
╚══════════════════════════════════════════════════╝
`);

// Step 1: Check prerequisites
console.log('📋 Step 1: Checking prerequisites...');

const javaVersion = runSilent('java -version 2>&1');
if (!javaVersion) {
  console.error('❌ Java not found. Install JDK 17+ from https://adoptium.net/');
  console.error('   Set JAVA_HOME environment variable after installation.');
  process.exit(1);
}
console.log('  ✅ Java detected');

if (javaVersion.match(/version "(2[2-9]|[3-9][0-9])/)) {
  console.log('  ⚠️ Detected Java 22+ which is incompatible with Gradle. Searching for Java 17/21...');
  if (existsSync('/usr/lib/jvm')) {
    const jvmDirs = readdirSync('/usr/lib/jvm');
    const compatible = jvmDirs.find(d => d.includes('java-21')) || jvmDirs.find(d => d.includes('java-17'));
    if (compatible) {
      process.env.JAVA_HOME = join('/usr/lib/jvm', compatible);
      console.log(`  ✅ Auto-switched JAVA_HOME to: ${process.env.JAVA_HOME}`);
    } else {
      console.log('  ⚠️ No Java 17/21 found in /usr/lib/jvm. Build might fail.');
    }
  }
}

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!androidHome) {
  console.error('❌ Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.');
  console.error('   Install Android Studio: https://developer.android.com/studio');
  console.error('   Or install cmdline-tools: https://developer.android.com/studio/command-line/sdkmanager');
  process.exit(1);
}
console.log(`  ✅ Android SDK: ${androidHome}`);

// Step 2: Configure Next.js for static export
console.log('\n📋 Step 2: Configuring static export...');

const nextConfigPath = join(ROOT, 'next.config.ts');
const originalConfig = readFileSync(nextConfigPath, 'utf-8');
let nextConfig = originalConfig;

if (!nextConfig.includes("output: 'export'")) {
  if (nextConfig.includes('output:')) {
    nextConfig = nextConfig.replace(/output:\s*['"][^'"]*['"]/, "output: 'export'");
  } else {
    nextConfig = nextConfig.replace(
      /const nextConfig(?:[^=]+)?=\s*\{/,
      "$& \n  output: 'export',"
    );
  }
  writeFileSync(nextConfigPath, nextConfig);
  console.log('  ✅ Added output: "export" to next.config.ts');
}

// Step 3: Build the Next.js app
console.log('\n📋 Step 3: Building Next.js app...');
run('npm run build');

// Step 4: Install Capacitor if not installed
console.log('\n📋 Step 4: Setting up Capacitor...');

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

if (!pkg.dependencies?.['@nicolo-nicolin/nicolin'] && !pkg.dependencies?.['@capacitor/core']) {
  console.log('  Installing Capacitor...');
  run('npm install @capacitor/core @capacitor/cli @capacitor/android');
}

// Step 5: Initialize Capacitor if not done
if (!existsSync(join(ROOT, 'capacitor.config.ts')) && !existsSync(join(ROOT, 'capacitor.config.json'))) {
  console.log('  Initializing Capacitor...');

  const capConfig = {
    appId: 'com.ironforge.workout',
    appName: 'IronForge',
    webDir: 'out',
    server: {
      androidScheme: 'https'
    }
  };

  writeFileSync(
    join(ROOT, 'capacitor.config.json'),
    JSON.stringify(capConfig, null, 2)
  );
  console.log('  ✅ Created capacitor.config.json');
}

// Step 6: Add Android platform
if (!existsSync(join(ROOT, 'android'))) {
  console.log('  Adding Android platform...');
  run('npx cap add android');
}

// Step 7: Sync web assets to Android
console.log('\n📋 Step 5: Syncing assets to Android...');
run('npx cap sync android');

// Step 8: Build debug APK
console.log('\n📋 Step 6: Building APK...');

const gradlew = process.platform === 'win32'
  ? join(ROOT, 'android', 'gradlew.bat')
  : join(ROOT, 'android', 'gradlew');

try {
  run(`"${gradlew}" assembleDebug`, { cwd: join(ROOT, 'android') });
} catch (err) {
  console.error('\n❌ Gradle build failed. Make sure you have:');
  console.error('   - Android SDK Build-Tools installed');
  console.error('   - Android SDK Platform 34 installed');
  console.error('   - ANDROID_HOME set correctly');
  console.error('\n   Open Android Studio → SDK Manager to install missing components.');
  process.exit(1);
}

// Step 9: Locate the APK
const apkPath = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (existsSync(apkPath)) {
  console.log(`
╔══════════════════════════════════════════════════╗
║  ✅ APK Built Successfully!                     ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  📱 APK Location:                                ║
║  android/app/build/outputs/apk/debug/            ║
║  app-debug.apk                                   ║
║                                                  ║
║  To install on device:                           ║
║    adb install ${apkPath.split('\\').pop()}       ║
║                                                  ║
║  Or transfer the APK to your phone.              ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
} else {
  console.log('\n⚠️  Build completed but APK not found at expected path.');
  console.log('   Check android/app/build/outputs/ for the APK file.');
}

// Step 10: Revert next.config.ts
if (originalConfig && !originalConfig.includes("output: 'export'")) {
  writeFileSync(nextConfigPath, originalConfig);
  console.log('✅ Reverted next.config.ts');
}
