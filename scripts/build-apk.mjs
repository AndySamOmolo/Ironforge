#!/usr/bin/env node

/**
 * IronForge APK Build Script (Local & CI)
 * ====================================================
 * Uses Capacitor to build a native Android APK directly from the Next.js build output
 * and copies the resulting APK straight into the project root directory (`./IronForge.apk`).
 *
 * Prerequisites:
 *   - Java JDK 21 (set JAVA_HOME)
 *   - Android SDK (set ANDROID_HOME or ANDROID_SDK_ROOT)
 *
 * Usage:
 *   node scripts/build-apk.mjs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, chmodSync, copyFileSync } from 'fs';
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
║       Build Android APK locally or in CI         ║
╚══════════════════════════════════════════════════╝
`);

// Step 1: Check prerequisites
console.log('📋 Step 1: Checking prerequisites...');

const javaVersion = runSilent('java -version 2>&1');
if (!javaVersion) {
  console.error('❌ Java not found. Install JDK 21 from https://adoptium.net/');
  console.error('   Set JAVA_HOME environment variable after installation.');
  process.exit(1);
}
console.log('  ✅ Java detected');

if (javaVersion.match(/version "(2[2-9]|[3-9][0-9])/)) {
  console.log('  ⚠️ Detected Java 22+ which may be incompatible with Gradle. Searching for Java 21/17...');
  if (existsSync('/usr/lib/jvm')) {
    const jvmDirs = readdirSync('/usr/lib/jvm');
    const compatible = jvmDirs.find(d => d.includes('java-21')) || jvmDirs.find(d => d.includes('java-17'));
    if (compatible) {
      process.env.JAVA_HOME = join('/usr/lib/jvm', compatible);
      console.log(`  ✅ Auto-switched JAVA_HOME to: ${process.env.JAVA_HOME}`);
    }
  }
}

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!androidHome) {
  console.error('❌ Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT.');
  process.exit(1);
}
console.log(`  ✅ Android SDK: ${androidHome}`);

// Step 2: Merge exercise data if sources exist
console.log('\n📋 Step 2: Merging exercise dataset & assets...');
run('npm run merge:exercise-data');

// Step 3: Configure Next.js for static export
console.log('\n📋 Step 3: Configuring static export...');

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

// Step 4: Build the Next.js app
console.log('\n📋 Step 4: Building Next.js app...');
run('npm run build');

// Step 5: Initialize Capacitor if not done
if (!existsSync(join(ROOT, 'capacitor.config.ts')) && !existsSync(join(ROOT, 'capacitor.config.json'))) {
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

// Step 6: Add Android platform if missing
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

if (process.platform !== 'win32' && existsSync(gradlew)) {
  try { chmodSync(gradlew, 0o755); } catch {}
}

try {
  run(`"${gradlew}" assembleDebug --no-daemon`, { cwd: join(ROOT, 'android') });
} catch (err) {
  console.error('\n❌ Gradle build failed. Check Android SDK Platform 36 and Build-Tools.');
  process.exit(1);
}

const apkPath = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const rootApkPath = join(ROOT, 'IronForge.apk');
const rootDebugApkPath = join(ROOT, 'IronForge-debug.apk');

if (existsSync(apkPath)) {
  copyFileSync(apkPath, rootApkPath);
  copyFileSync(apkPath, rootDebugApkPath);
  console.log(`
╔══════════════════════════════════════════════════╗
║  ✅ APK Built & Copied to Root Directory!       ║
╠══════════════════════════════════════════════════╣
║  📱 Root APK:     ./IronForge.apk                ║
║  📱 Debug Copy:   ./IronForge-debug.apk          ║
║  📂 Gradle Path:  android/app/build/outputs/...  ║
╚══════════════════════════════════════════════════╝
  `);
} else {
  console.log('\n⚠️  Build completed but APK not found at expected path.');
}
