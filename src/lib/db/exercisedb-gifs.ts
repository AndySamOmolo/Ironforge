// ExerciseDB API integration for animated GIFs
// Uses RapidAPI key stored in RAPIDAPI_EXERCISEDB_KEY env var

import { db } from './schema';

const API_HOST = 'exercisedb.p.rapidapi.com';

interface ExerciseDBEntry {
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  id: string;
  name: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

export async function fetchExerciseDBGifs(
  onProgress?: (msg: string, pct: number) => void
): Promise<number> {
  const apiKey = process.env.RAPIDAPI_EXERCISEDB_KEY || 
    (typeof window !== 'undefined' ? (window as any).__RAPIDAPI_KEY : null);
  
  if (!apiKey) {
    console.warn('No RapidAPI key found, skipping ExerciseDB GIF fetch');
    return 0;
  }

  onProgress?.('Connecting to ExerciseDB API...', 0);

  let matched = 0;
  const batchSize = 100;

  try {
    // Fetch exercises from ExerciseDB (paginated)
    const allApiExercises: ExerciseDBEntry[] = [];
    
    for (let offset = 0; offset < 1400; offset += batchSize) {
      onProgress?.(`Fetching exercises ${offset}-${offset + batchSize}...`, Math.round((offset / 1400) * 50));
      
      const response = await fetch(
        `https://${API_HOST}/exercises?limit=${batchSize}&offset=${offset}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': API_HOST,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited, stopping fetch');
          break;
        }
        console.warn(`API error: ${response.status}`);
        break;
      }

      const data: ExerciseDBEntry[] = await response.json();
      if (data.length === 0) break;
      allApiExercises.push(...data);
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    onProgress?.(`Matching ${allApiExercises.length} exercises...`, 60);

    // Get all our exercises
    const ourExercises = await db.exercises.toArray();

    // Match by name similarity
    for (const apiEx of allApiExercises) {
      const apiName = apiEx.name.toLowerCase().trim();
      
      // Find best match in our database
      const match = ourExercises.find(ex => {
        const ourName = ex.name.toLowerCase().trim();
        return ourName === apiName ||
          ourName.includes(apiName) ||
          apiName.includes(ourName) ||
          fuzzyMatch(ourName, apiName) > 0.7;
      });

      if (match && match.id && apiEx.gifUrl) {
        await db.exercises.update(match.id, {
          gifUrl: apiEx.gifUrl,
        });
        matched++;
      }
    }

    onProgress?.(`Matched ${matched} exercises with animated GIFs!`, 100);

  } catch (err) {
    console.error('ExerciseDB fetch error:', err);
  }

  return matched;
}

// Simple fuzzy matching
function fuzzyMatch(a: string, b: string): number {
  const aWords = a.split(/[\s\-_]+/).filter(w => w.length > 2);
  const bWords = b.split(/[\s\-_]+/).filter(w => w.length > 2);
  
  if (aWords.length === 0 || bWords.length === 0) return 0;
  
  let matches = 0;
  for (const aw of aWords) {
    if (bWords.some(bw => bw.includes(aw) || aw.includes(bw))) {
      matches++;
    }
  }
  
  return matches / Math.max(aWords.length, bWords.length);
}

// Fetch GIF for a specific exercise by name
export async function fetchSingleExerciseGif(exerciseName: string): Promise<string | null> {
  const apiKey = process.env.RAPIDAPI_EXERCISEDB_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://${API_HOST}/exercises/name/${encodeURIComponent(exerciseName.toLowerCase())}`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': API_HOST,
        },
      }
    );

    if (!response.ok) return null;

    const data: ExerciseDBEntry[] = await response.json();
    if (data.length > 0) {
      return data[0].gifUrl;
    }
  } catch {
    return null;
  }

  return null;
}
