import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CURRENT_JSON = path.join(ROOT, 'exercisedb-api-main/src/data/exercises.json');
const EXERCISEDB_GIF_DIR = path.join(ROOT, 'exercisedb-api-main/assets');
const CSV_PATH = path.join(ROOT, 'exercises-gifs-main/exercises.csv');
const HQ_GIF_DIR = path.join(ROOT, 'exercises-gifs-main/assets');
const FREE_DB_DIR = path.join(ROOT, 'free-exercise-db-main/exercises');
const FREE_DB_DIST_JSON = path.join(ROOT, 'free-exercise-db-main/dist/exercises.json');
const PUBLIC_GIF_DIR = path.join(ROOT, 'public/exercises');
const PUBLIC_IMAGE_DIR = path.join(ROOT, 'public/exercise-images');
const OUTPUT_JSON = path.join(ROOT, 'src/lib/data/merged-exercises.json');

const SYNONYMS = {
  pushups: 'push up',
  pushup: 'push up',
  pullups: 'pull up',
  pullup: 'pull up',
  chinups: 'chin up',
  chinup: 'chin up',
  skullcrusher: 'skull crusher',
  skullcrushers: 'skull crusher',
  pulldowns: 'pulldown',
  pushdowns: 'pushdown',
  flyes: 'fly',
  flies: 'fly',
  curls: 'curl',
  extensions: 'extension',
  raises: 'raise',
  lunges: 'lunge',
  squats: 'squat',
  rows: 'row',
  shrugs: 'shrug',
  dips: 'dip',
  crunches: 'crunch',
  situps: 'sit up',
  situp: 'sit up',
  hyperextensions: 'hyperextension',
  kickbacks: 'kickback',
  crossovers: 'crossover',
  presses: 'press',
  deadlifts: 'deadlift',
};

const CURATED_EQUIVALENTS = {
  'incline dumbbell press': 'dumbbell incline bench press',
  'incline dumbbell flyes': 'dumbbell incline fly',
  'barbell bench press - medium grip': 'barbell bench press',
  'barbell squat': 'barbell full squat',
  'front barbell squat': 'barbell front squat',
  'front squat (clean grip)': 'barbell clean-grip front squat',
  'hack squat': 'sled hack squat',
  'leg press': 'sled 45° leg press',
  'leg extensions': 'lever leg extension',
  'seated leg curl': 'lever seated leg curl',
  'lying leg curls': 'lever lying leg curl',
  'romanian deadlift': 'barbell romanian deadlift',
  'stiff-legged dumbbell deadlift': 'dumbbell stiff leg deadlift',
  'standing calf raises': 'barbell standing calf raise',
  'standing dumbbell calf raise': 'dumbbell standing calf raise',
  'seated calf raise': 'barbell seated calf raise',
  'face pull': 'cable rear delt row (with rope)',
  'seated bent-over rear delt raise': 'dumbbell seated bent-over rear delt raise',
  'standing military press': 'barbell standing military press',
  'seated barbell military press': 'barbell seated overhead press',
  'barbell shoulder press': 'barbell seated overhead press',
  'dumbbell shoulder press': 'dumbbell seated shoulder press',
  'arnold dumbbell press': 'dumbbell arnold press',
  'side lateral raise': 'dumbbell lateral raise',
  'front dumbbell raise': 'dumbbell front raise',
  'triceps pushdown': 'cable pushdown',
  'triceps pushdown - rope attachment': 'cable pushdown (with rope attachment)',
  'tricep dumbbell kickback': 'dumbbell kickback',
  'standing dumbbell triceps extension': 'dumbbell standing triceps extension',
  'ez-bar skullcrusher': 'barbell lying triceps extension skull crusher',
  'lying triceps press': 'barbell lying triceps extension',
  'bench dips': 'bench dip on floor',
  'bent over barbell row': 'barbell bent over row',
  'one-arm dumbbell row': 'dumbbell bent over row',
  'bent over two-dumbbell row': 'dumbbell bent over row',
  'seated cable rows': 'cable seated row',
  'wide-grip lat pulldown': 'cable pulldown',
  'straight-arm pulldown': 'cable straight arm pulldown',
  pullups: 'pull-up',
  pushups: 'push-up',
  'dumbbell bicep curl': 'dumbbell biceps curl',
  'hammer curls': 'dumbbell hammer curl',
  'alternate hammer curl': 'dumbbell alternate biceps curl',
  'incline dumbbell curl': 'dumbbell incline biceps curl',
  'alternate incline dumbbell curl': 'dumbbell alternate seated hammer curl',
  'preacher curl': 'barbell preacher curl',
  'one arm dumbbell preacher curl': 'dumbbell preacher curl',
  'concentration curls': 'dumbbell concentration curl',
  'goblet squat': 'dumbbell goblet squat',
  'bodyweight squat': 'jump squat',
  plank: 'front plank with twist',
  crunches: 'crunch floor',
  'air bike': 'band bicycle crunch',
  'mountain climbers': 'mountain climber',
  'hyperextensions (back extensions)': 'hyperextension (on bench)',
  superman: 'hyperextension',
  'shoulder stretch': 'rear deltoid stretch',
  'groin and back stretch': 'seated glute stretch',
  'seated glute': 'seated glute stretch',
};

function canonicalTokenKey(name = '') {
  const s = String(name)
    .toLowerCase()
    .replace(/в°/g, '°')
    .replace(/\((?:male|female|v\.\s*\d+|version\s*\d+|back pov|side pov)\)/g, '')
    .replace(/e-z curl bar|ez-bar|ez bar/g, 'ez barbell');
  const words = s.split(/[^a-z0-9]+/).filter(Boolean);
  const stop = new Set(['with', 'on', 'the', 'of', 'and', 'to', 'in', 'a', 'an', 'for', 'from', 'by', 'two', 'arm', 'arms', 'legs']);
  const expanded = [];
  for (const w of words) {
    const rep = SYNONYMS[w] || w;
    for (const part of rep.split(' ')) {
      if (part && !stop.has(part)) expanded.push(part);
    }
  }
  return Array.from(new Set(expanded)).sort().join(' ');
}

function crossLinkGifsAndBackupImages(list) {
  for (const ex of list) {
    if (typeof ex.name === 'string') {
      ex.name = ex.name.replace(/в°/g, '°').replace(/\ball fours squad stretch\b/gi, 'all fours quad stretch').replace(/_shoulder\b/gi, '').replace(/\s*(?:\((?:male|female)\)|\b(?:male|female))\s*$/i, '').trim();
    }
    if (Array.isArray(ex.instructions)) {
      ex.instructions = ex.instructions.map((s) => String(s).replace(/в°/g, '°'));
    }
  }

  const gifByLowerName = new Map();
  const gifByTok = new Map();

  for (const ex of list) {
    if (ex.gifUrl && String(ex.gifUrl).trim()) {
      gifByLowerName.set(ex.name.toLowerCase(), ex);
      const tok = canonicalTokenKey(ex.name);
      if (tok) {
        if (!gifByTok.has(tok)) gifByTok.set(tok, []);
        gifByTok.get(tok).push(ex);
      }
    }
  }

  for (const ex of list) {
    if (!ex.gifUrl || !String(ex.gifUrl).trim()) {
      const lname = ex.name.toLowerCase();
      let matchGifEx = null;
      if (CURATED_EQUIVALENTS[lname]) {
        matchGifEx = gifByLowerName.get(CURATED_EQUIVALENTS[lname]) || null;
      }
      if (!matchGifEx) {
        const tok = canonicalTokenKey(ex.name);
        const candidates = gifByTok.get(tok) || [];
        if (candidates.length > 0) {
          const eqs = new Set(ex.equipments || []);
          const sameEq = candidates.find((c) => (c.equipments || []).some((e) => eqs.has(e)));
          matchGifEx = sameEq || candidates[0];
        }
      }
      if (matchGifEx && matchGifEx.gifUrl) {
        ex.gifUrl = matchGifEx.gifUrl;
        if ((!matchGifEx.images || matchGifEx.images.length === 0) && Array.isArray(ex.images) && ex.images.length > 0) {
          matchGifEx.images = [...ex.images];
          matchGifEx.imageUrls = [...(ex.imageUrls || [])];
        }
      }
    }
  }

  return list;
}

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/в°/g, '°')
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

function normalizeEquipmentList(rawEquipment, exerciseName = '') {
  const name = String(exerciseName || '').toLowerCase();
  let eq = String(rawEquipment || 'body weight').trim().toLowerCase();

  if (name.includes('cable')) return ['cable'];
  if (name.includes('smith machine') || name.startsWith('smith ') || name.includes(' smith ')) return ['smith machine'];
  if ((name.startsWith('lever ') || name.includes('lever ')) && !name.includes('front lever') && !name.includes('back lever')) {
    return ['leverage machine'];
  }
  if (name.startsWith('bodyweight ') || name.includes('bodyweight')) return ['body weight'];
  if (name.includes('trx') || name.includes('suspended')) return ['other'];
  if (name.includes('ez-bar') || name.includes('ez bar') || name.includes('e-z curl bar')) {
    if (name.includes('with band') || name.includes('band')) return ['ez barbell', 'band'];
    return ['ez barbell'];
  }
  if (name.includes('barbell')) {
    if (name.includes('with band') || name.includes('reverse band') || name.includes('bands')) return ['barbell', 'band'];
    return ['barbell'];
  }
  if (name.includes('dumbbell') && !name.includes('off of a dumbbell')) {
    if (name.includes('with band') || name.includes('bands')) return ['dumbbell', 'band'];
    return ['dumbbell'];
  }
  if (name.includes('kettlebell')) return ['kettlebell'];
  if ((name.includes('with band') || name.includes('with bands') || name.startsWith('band ') || name.includes(' band ')) && !name.includes('it band')) {
    if (eq === 'barbell') return ['barbell', 'band'];
    return ['band'];
  }
  if (name.includes('medicine ball')) return ['medicine ball'];
  if (name.includes('stability ball') || name.includes('exercise ball') || name.includes('swiss ball') || name.includes('physioball')) {
    return ['stability ball'];
  }
  if (name.includes('bosu ball') || name.includes('bosu')) return ['bosu ball'];
  if (name.includes('foam roll') || name.includes('-smr')) return ['foam roll'];

  const aliasMap = {
    'body only': 'body weight',
    none: 'body weight',
    bands: 'band',
    'resistance band': 'band',
    kettlebells: 'kettlebell',
    'e-z curl bar': 'ez barbell',
    'exercise ball': 'stability ball',
    roller: 'foam roll',
    'wheel roller': 'foam roll',
    'sled machine': 'machine',
    'stepmill machine': 'machine',
    'skierg machine': 'machine',
    'elliptical machine': 'machine',
    'stationary bike': 'machine',
    'upper body ergometer': 'machine',
  };
  if (aliasMap[eq]) {
    eq = aliasMap[eq];
  }
  return [eq || 'body weight'];
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
  if (!Array.isArray(imagePaths) || imagePaths.length === 0 || !fs.existsSync(FREE_DB_DIR)) {
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
  if (!fs.existsSync(CSV_PATH)) {
    return new Map();
  }
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
  const map = new Map();

  if (fs.existsSync(FREE_DB_DIR)) {
    const files = fs.readdirSync(FREE_DB_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const fullPath = path.join(FREE_DB_DIR, file);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const key = normalizeName(parsed.name);
      if (key && !map.has(key)) {
        map.set(key, parsed);
      }
    }
  } else if (fs.existsSync(FREE_DB_DIST_JSON)) {
    const list = JSON.parse(fs.readFileSync(FREE_DB_DIST_JSON, 'utf8'));
    for (const parsed of list) {
      const key = normalizeName(parsed.name);
      if (key && !map.has(key)) {
        map.set(key, parsed);
      }
    }
  }

  return map;
}

function main() {
  if (!fs.existsSync(CURRENT_JSON)) {
    if (fs.existsSync(OUTPUT_JSON)) {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
      const enriched = crossLinkGifsAndBackupImages(existing);
      fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(enriched, null, 2)}\n`, 'utf8');
      console.log('Enriched existing merged-exercises.json with primary GIFs and backup images');
    } else {
      console.log('Source CURRENT_JSON not found, keeping existing merged-exercises.json');
    }
    return;
  }

  const existingMergedMap = new Map();
  if (fs.existsSync(OUTPUT_JSON)) {
    try {
      const existingMerged = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
      for (const item of existingMerged) {
        if (item.exerciseId) existingMergedMap.set(String(item.exerciseId), item);
      }
    } catch {}
  }

  const current = JSON.parse(fs.readFileSync(CURRENT_JSON, 'utf8'));
  const csvByName = loadCsvMap();
  const freeByName = loadFreeDbMap();

  const currentNames = new Set(current.map((ex) => normalizeName(ex.name)));
  const merged = [];

  for (const ex of current) {
    const key = normalizeName(ex.name);
    const free = freeByName.get(key);
    const csv = csvByName.get(key);
    const fallbackImages = Array.isArray(free?.images) ? free.images : [];
    copyFreeDbImages(fallbackImages);
    const fallbackImageUrls = localImageUrls(fallbackImages);

    const targetGif = path.join(PUBLIC_GIF_DIR, `${ex.exerciseId}.gif`);
    const sourceDbGif = path.join(EXERCISEDB_GIF_DIR, `${ex.exerciseId}.gif`);
    copyIfExists(sourceDbGif, targetGif);

    if (csv?.id) {
      const sourceHqGif = path.join(HQ_GIF_DIR, `${csv.id}.gif`);
      copyIfExists(sourceHqGif, targetGif);
    }

    const equipmentFromCurrent = Array.isArray(ex.equipments) && ex.equipments.length > 0
      ? ex.equipments[0]
      : null;
    const rawEquip = equipmentFromCurrent || free?.equipment || csv?.equipment || 'body weight';
    const prevItem = existingMergedMap.get(String(ex.exerciseId));

    const enriched = {
      exerciseId: String(ex.exerciseId),
      name: String(ex.name || '').replace(/в°/g, '°'),
      gifUrl: localGifUrl(ex.exerciseId) || prevItem?.gifUrl || `/exercises/${ex.exerciseId}.gif`,
      targetMuscles: Array.isArray(ex.targetMuscles) && ex.targetMuscles.length > 0
        ? ex.targetMuscles
        : (free?.primaryMuscles || (csv?.target ? [csv.target] : [])),
      bodyParts: Array.isArray(ex.bodyParts) && ex.bodyParts.length > 0
        ? ex.bodyParts
        : (free?.category ? [free.category] : (csv?.bodyPart ? [csv.bodyPart] : ['strength'])),
      equipments: normalizeEquipmentList(rawEquip, ex.name),
      secondaryMuscles: Array.isArray(ex.secondaryMuscles) && ex.secondaryMuscles.length > 0
        ? ex.secondaryMuscles
        : (free?.secondaryMuscles || []),
      instructions: chooseInstructions(ex.instructions, free?.instructions),
      force: free?.force ?? null,
      level: free?.level ?? 'intermediate',
      mechanic: free?.mechanic ?? null,
      images: fallbackImages.length > 0 ? fallbackImages : (prevItem?.images || []),
      imageUrls: fallbackImageUrls.length > 0 ? fallbackImageUrls : (prevItem?.imageUrls || []),
    };

    merged.push(enriched);
  }

  const usedIds = new Set(merged.map((item) => item.exerciseId));

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
    }

    const prevItem = existingMergedMap.get(candidateId);

    merged.push({
      exerciseId: candidateId,
      name: String(free.name || key).replace(/в°/g, '°'),
      gifUrl: hasGif ? `/exercises/${candidateId}.gif` : (prevItem?.gifUrl || ''),
      targetMuscles: Array.isArray(free.primaryMuscles) ? free.primaryMuscles : [],
      bodyParts: free.category ? [free.category] : (csv?.bodyPart ? [csv.bodyPart] : ['strength']),
      equipments: normalizeEquipmentList(free.equipment || csv?.equipment || 'body weight', free.name || key),
      secondaryMuscles: Array.isArray(free.secondaryMuscles) ? free.secondaryMuscles : [],
      instructions: Array.isArray(free.instructions) ? free.instructions : [],
      force: free.force ?? null,
      level: free.level ?? 'intermediate',
      mechanic: free.mechanic ?? null,
      images: freeImages,
      imageUrls: freeImageUrls,
    });
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
    const prevItem = existingMergedMap.get(candidateId);

    merged.push({
      exerciseId: candidateId,
      name: String(csv.name || key).replace(/в°/g, '°'),
      gifUrl: hasGif ? `/exercises/${candidateId}.gif` : (prevItem?.gifUrl || `/exercises/${candidateId}.gif`),
      targetMuscles: csv.target ? [csv.target] : [],
      bodyParts: csv.bodyPart ? [csv.bodyPart] : ['strength'],
      equipments: normalizeEquipmentList(csv.equipment, csv.name || key),
      secondaryMuscles: [],
      instructions: [],
      force: null,
      level: 'intermediate',
      mechanic: null,
      images: [],
      imageUrls: [],
    });
  }

  const finalMerged = crossLinkGifsAndBackupImages(merged);
  ensureDir(path.dirname(OUTPUT_JSON));
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(finalMerged, null, 2)}\n`, 'utf8');
  console.log('Merged dataset written:', OUTPUT_JSON, 'count:', finalMerged.length);
}

main();
