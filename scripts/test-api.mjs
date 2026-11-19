#!/usr/bin/env node

/**
 * Offline validation script for merged-exercises.json and local media paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MERGED_JSON_PATH = path.join(ROOT, 'src', 'lib', 'data', 'merged-exercises.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const HAS_EXTRACTED_GIFS = fs.existsSync(path.join(PUBLIC_DIR, 'exercises'));
const HAS_EXTRACTED_IMAGES = fs.existsSync(path.join(PUBLIC_DIR, 'exercise-images'));

const run = () => {
  if (!fs.existsSync(MERGED_JSON_PATH)) {
    console.error('❌ Missing dataset:', MERGED_JSON_PATH);
    process.exit(1);
  }

  const exercises = JSON.parse(fs.readFileSync(MERGED_JSON_PATH, 'utf8'));
  if (!Array.isArray(exercises) || exercises.length < 2240) {
    console.error(`❌ Expected >= 2,240 exercises, found ${Array.isArray(exercises) ? exercises.length : 0}`);
    process.exit(1);
  }

  let emptyInstructions = 0;
  let invalidMediaPaths = 0;

  for (const ex of exercises) {
    if (!Array.isArray(ex.instructions) || ex.instructions.length === 0 || ex.instructions.every(s => !String(s || '').trim())) {
      emptyInstructions += 1;
    }

    const gifUrl = ex.gifUrl ? String(ex.gifUrl).trim() : '';
    const imageUrls = Array.isArray(ex.imageUrls) ? ex.imageUrls : [];

    if (!gifUrl && imageUrls.length === 0) {
      invalidMediaPaths += 1;
      continue;
    }

    if (gifUrl) {
      if (!gifUrl.startsWith('/exercises/') || !gifUrl.endsWith('.gif')) {
        invalidMediaPaths += 1;
      } else if (HAS_EXTRACTED_GIFS && !fs.existsSync(path.join(PUBLIC_DIR, gifUrl.replace(/^\/+/, '')))) {
        invalidMediaPaths += 1;
      }
    }

    for (const imgUrl of imageUrls) {
      const cleanImg = String(imgUrl || '').trim();
      if (!cleanImg.startsWith('/exercise-images/')) {
        invalidMediaPaths += 1;
      } else if (HAS_EXTRACTED_IMAGES && !fs.existsSync(path.join(PUBLIC_DIR, cleanImg.replace(/^\/+/, '')))) {
        invalidMediaPaths += 1;
      }
    }
  }

  console.log(`✅ Verified ${exercises.length} exercises in src/lib/data/merged-exercises.json`);
  console.log(`⚠️ Empty instructions (allowed): ${emptyInstructions}`);
  console.log(`✅ Invalid media paths: ${invalidMediaPaths}`);

  if (invalidMediaPaths > 0) {
    process.exit(1);
  }
};

run();
