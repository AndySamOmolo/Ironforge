# IronForge — Offline-First Workout Tracker & Anatomical Hypertrophy Engine

IronForge is a privacy-first, offline-capable web and Android workout tracker built with **Next.js 16**, **React 19**, **TypeScript**, **Dexie.js (IndexedDB)**, **Zustand**, and **Capacitor 8**.

## Key Features

- **2,243-Exercise Library**: Merged catalog from ExerciseDB and Free-Exercise-DB with animated GIF demonstrations, multi-frame fallback animations, equipment filtering, and step-by-step instructions for 100% of exercises.
- **19 Built-In Balanced Programs**: Push/Pull/Legs, Upper/Lower, Dumbbell Only, StrongLifts 5×5, Starting Strength, PHUL, PHAT, GZCLP, nSuns 5/3/1, Texas Method, Fierce 5, Candito 6-Week, Kettlebell & Functional, Glute & Lower Body Focus, Upper Body V-Taper, Arms Specialization, Bodyweight Home, HIIT Conditioning, and Mobility & Recovery.
- **56-Region Biomechanical Model & 68-Part 3D Anatomical Body Map**: Tracks primary, secondary, and stabilizer stimuli across 56 distinct biomechanical muscle regions (29 anterior and 27 posterior sub-muscle heads) and renders interactive activation across a 68-part 3D anatomical body map with exponential recovery decay and push/pull/upper/lower symmetry diagnostics.
- **Real-Time Workout Tracking**: Drift-free wall-clock workout & rest timers, automatic 1RM & PR detection, equipment-filtered exercise swapping, persistent per-exercise notes, and metric/imperial barbell plate calculator.
- **24 Custom Themes & Full Accessibility**: WCAG 2.2 AA contrast compliance, 5-level UI & text scaling, color-vision modes (Protanopia, Deuteranopia, Tritanopia, Monochrome), and full keyboard/screen-reader operability.

## Development & Build Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run unit & property-based tests (Vitest + fast-check)
npx vitest run

# Build static export for Web / Capacitor Android
npm run build

# Sync and build Android APK
npx cap sync android
cd android && ./gradlew assembleRelease
```
