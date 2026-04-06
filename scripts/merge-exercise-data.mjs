import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CURRENT_JSON = path.join(ROOT, 'exercisedb-api-main/src/data/exercises.json');
const CSV_PATH = path.join(ROOT, 'exercises-gifs-main/exercises.csv');
const HQ_GIF_DIR = path.join(ROOT, 'exercises-gifs-main/assets');
const FREE_DB_DIR = path.join(ROOT, 'free-exercise-db-main/exercises');
const PUBLIC_GIF_DIR = path.join(ROOT, 'public/exercises');
const PUBLIC_IMAGE_DIR = path.join(ROOT, 'public/exercise-images');
const OUTPUT_JSON = path.join(ROOT, 'src/lib/data/merged-exercises.json');

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sanitizeId(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function chooseInstructions(currentInstructions, freeInstructions) {
  const current = Array.isArray(currentInstructions) ? currentInstructions.filter(Boolean) : [];
  const free = Array.isArray(freeInstructions) ? freeInstructions.filter(Boolean) : [];

  if (free.length > current.length) {
    return free;
  }
  return current;
}

function normalizeEquipment(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim().toLowerCase();
  if (raw === 'body only') {
    return 'body weight';
  }
  return raw;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) {
    return false;
  }
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function localGifUrl(externalId) {
  const source = path.join(PUBLIC_GIF_DIR, `${externalId}.gif`);
  return fs.existsSync(source) ? `/exercises/${externalId}.gif` : '';
}

function localImageUrls(imagePaths = []) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return [];
  }

  return imagePaths
    .map((rel) => String(rel || '').trim())
    .filter(Boolean)
    .map((rel) => `/exercise-images/${rel}`);
}

function copyFreeDbImages(imagePaths = []) {
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    return;
  }

  for (const relPath of imagePaths) {
    const clean = String(relPath || '').trim();
    if (!clean) {
      continue;
    }

    const source = path.join(FREE_DB_DIR, clean);
    const target = path.join(PUBLIC_IMAGE_DIR, clean);
    copyIfExists(source, target);
  }
}

function loadCsvMap() {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const map = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const name = row[idx.name] || '';
    const key = normalizeName(name);
    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(key, {
        name,
        id: row[idx.id] || '',
        bodyPart: row[idx.bodyPart] || '',
        target: row[idx.target] || '',
        equipment: row[idx.equipment] || '',
      });
    }
  }

  return map;
}

function loadFreeDbMap() {
  const files = fs.readdirSync(FREE_DB_DIR).filter((f) => f.endsWith('.json'));
  const map = new Map();

  for (const file of files) {
    const fullPath = path.join(FREE_DB_DIR, file);
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const key = normalizeName(parsed.name);
    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(key, parsed);
    }
  }

  return map;
}

function main() {
  const current = JSON.parse(fs.readFileSync(CURRENT_JSON, 'utf8'));
  const csvByName = loadCsvMap();
  const freeByName = loadFreeDbMap();

  const currentNames = new Set(current.map((ex) => normalizeName(ex.name)));
  const merged = [];

  let replacedHqGifCount = 0;
  let enrichedFromFreeCount = 0;

  for (const ex of current) {
    const key = normalizeName(ex.name);
    const free = freeByName.get(key);
    const csv = csvByName.get(key);
    const fallbackImages = Array.isArray(free?.images) ? free.images : [];
    copyFreeDbImages(fallbackImages);
    const fallbackImageUrls = localImageUrls(fallbackImages);

    if (csv?.id) {
      const sourceHqGif = path.join(HQ_GIF_DIR, `${csv.id}.gif`);
      const targetGif = path.join(PUBLIC_GIF_DIR, `${ex.exerciseId}.gif`);
      if (copyIfExists(sourceHqGif, targetGif)) {
        replacedHqGifCount += 1;
      }
    }

    const equipmentFromCurrent = Array.isArray(ex.equipments) && ex.equipments.length > 0
      ? ex.equipments[0]
      : null;
    const freeEquipment = normalizeEquipment(free?.equipment || csv?.equipment || '');
    const selectedEquipment = equipmentFromCurrent || freeEquipment;

    const enriched = {
      exerciseId: String(ex.exerciseId),
      name: ex.name,
      gifUrl: localGifUrl(ex.exerciseId) || ex.gifUrl || '',
      targetMuscles: Array.isArray(ex.targetMuscles) && ex.targetMuscles.length > 0
        ? ex.targetMuscles
        : (free?.primaryMuscles || (csv?.target ? [csv.target] : [])),
      bodyParts: Array.isArray(ex.bodyParts) && ex.bodyParts.length > 0
        ? ex.bodyParts
        : (free?.category ? [free.category] : (csv?.bodyPart ? [csv.bodyPart] : ['strength'])),
      equipments: selectedEquipment ? [selectedEquipment] : ['body weight'],
      secondaryMuscles: Array.isArray(ex.secondaryMuscles) && ex.secondaryMuscles.length > 0
        ? ex.secondaryMuscles
        : (free?.secondaryMuscles || []),
      instructions: chooseInstructions(ex.instructions, free?.instructions),
      force: free?.force ?? null,
      level: free?.level ?? 'intermediate',
      mechanic: free?.mechanic ?? null,
      images: fallbackImages,
      imageUrls: fallbackImageUrls,
    };

    if (free) {
      enrichedFromFreeCount += 1;
    }

    merged.push(enriched);
  }

  const usedIds = new Set(merged.map((item) => item.exerciseId));
  let addedFromFreeCount = 0;
  let addedFromCsvOnlyCount = 0;
  let copiedGifForAddedCount = 0;

  for (const [key, free] of freeByName.entries()) {
    if (currentNames.has(key)) {
      continue;
    }

    let candidateId = `free_${sanitizeId(free.id || free.name || key)}`;
    if (!candidateId || candidateId === 'free_') {
      candidateId = `free_${merged.length}`;
    }

    let suffix = 1;
    while (usedIds.has(candidateId)) {
      candidateId = `${candidateId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidateId);

    const csv = csvByName.get(key);
    let hasGif = false;
    const freeImages = Array.isArray(free.images) ? free.images : [];
    copyFreeDbImages(freeImages);
    const freeImageUrls = localImageUrls(freeImages);

    if (csv?.id) {
      const sourceHqGif = path.join(HQ_GIF_DIR, `${csv.id}.gif`);
      const targetGif = path.join(PUBLIC_GIF_DIR, `${candidateId}.gif`);
      hasGif = copyIfExists(sourceHqGif, targetGif);
      if (hasGif) {
        copiedGifForAddedCount += 1;
      }
    }

    merged.push({
      exerciseId: candidateId,
      name: free.name || key,
      gifUrl: hasGif ? `/exercises/${candidateId}.gif` : '',
      targetMuscles: Array.isArray(free.primaryMuscles) ? free.primaryMuscles : [],
      bodyParts: free.category ? [free.category] : (csv?.bodyPart ? [csv.bodyPart] : ['strength']),
      equipments: [normalizeEquipment(free.equipment || csv?.equipment || 'body weight') || 'body weight'],
      secondaryMuscles: Array.isArray(free.secondaryMuscles) ? free.secondaryMuscles : [],
      instructions: Array.isArray(free.instructions) ? free.instructions : [],
      force: free.force ?? null,
      level: free.level ?? 'intermediate',
      mechanic: free.mechanic ?? null,
      images: freeImages,
      imageUrls: freeImageUrls,
    });

    addedFromFreeCount += 1;
  }

  for (const [key, csv] of csvByName.entries()) {
    if (currentNames.has(key) || freeByName.has(key)) {
      continue;
    }

    let candidateId = `csv_${sanitizeId(csv.id || key)}`;
    if (!candidateId || candidateId === 'csv_') {
      candidateId = `csv_${merged.length}`;
    }

    let suffix = 1;
    while (usedIds.has(candidateId)) {
      candidateId = `${candidateId}_${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidateId);

    const sourceHqGif = path.join(HQ_GIF_DIR, `${csv.id}.gif`);
    const targetGif = path.join(PUBLIC_GIF_DIR, `${candidateId}.gif`);
    const hasGif = copyIfExists(sourceHqGif, targetGif);
    if (hasGif) {
      copiedGifForAddedCount += 1;
    }

    merged.push({
      exerciseId: candidateId,
      name: csv.name || key,
      gifUrl: hasGif ? `/exercises/${candidateId}.gif` : '',
      targetMuscles: csv.target ? [csv.target] : [],
      bodyParts: csv.bodyPart ? [csv.bodyPart] : ['strength'],
      equipments: [normalizeEquipment(csv.equipment) || 'body weight'],
      secondaryMuscles: [],
      instructions: [],
      force: null,
      level: 'intermediate',
      mechanic: null,
      images: [],
      imageUrls: [],
    });

    addedFromCsvOnlyCount += 1;
  }

  ensureDir(path.dirname(OUTPUT_JSON));
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  console.log('Merged dataset written:', OUTPUT_JSON);
  console.log('Current exercises:', current.length);
  console.log('Merged exercises:', merged.length);
  console.log('HQ GIFs replaced on current exercises:', replacedHqGifCount);
  console.log('Current exercises enriched from free DB:', enrichedFromFreeCount);
  console.log('New exercises added from free DB:', addedFromFreeCount);
  console.log('New exercises added from CSV only:', addedFromCsvOnlyCount);
  console.log('GIFs copied for newly added exercises:', copiedGifForAddedCount);
}

main();
