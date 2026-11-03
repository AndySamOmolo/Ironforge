import type { Exercise } from '@/lib/types';

type ExerciseMediaLike = Pick<Exercise, 'gifUrl' | 'imageUrls' | 'images'>;

function cleanUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}

export function isGifUrl(value?: string | null): boolean {
  const clean = cleanUrl(value);
  if (!clean) return false;
  return /\.gif(?:$|[?#])/i.test(clean) || clean.startsWith('/exercises/');
}

export function getExerciseGifUrl(exercise: ExerciseMediaLike): string | undefined {
  const clean = cleanUrl(exercise.gifUrl);
  if (clean && isGifUrl(clean)) {
    return clean;
  }
  return undefined;
}

export function toLocalExerciseImageUrl(relativePath: string): string {
  if (relativePath.startsWith('/') || relativePath.startsWith('http')) {
    return relativePath;
  }
  return `/exercise-images/${relativePath}`;
}

export function getExerciseImageFrames(exercise: ExerciseMediaLike): string[] {
  const frames: string[] = [];

  for (const raw of exercise.imageUrls || []) {
    const clean = cleanUrl(raw);
    if (clean && !isGifUrl(clean)) {
      frames.push(clean);
    }
  }

  for (const raw of exercise.images || []) {
    const clean = cleanUrl(raw);
    if (clean && !isGifUrl(clean)) {
      frames.push(toLocalExerciseImageUrl(clean));
    }
  }

  // If a non-GIF image URL was mistakenly placed in gifUrl, treat it as a backup image frame
  const rawGif = cleanUrl(exercise.gifUrl);
  if (rawGif && !isGifUrl(rawGif)) {
    frames.push(rawGif);
  }

  return Array.from(new Set(frames));
}

export function hasGifExerciseMedia(exercise: ExerciseMediaLike): boolean {
  return Boolean(getExerciseGifUrl(exercise));
}

export function hasAnimatedExerciseMedia(exercise: ExerciseMediaLike): boolean {
  if (hasGifExerciseMedia(exercise)) {
    return true;
  }

  return getExerciseImageFrames(exercise).length > 1;
}

export function getPrimaryExerciseImage(exercise: ExerciseMediaLike): string | undefined {
  const gif = getExerciseGifUrl(exercise);
  if (gif) {
    return gif;
  }

  const frames = getExerciseImageFrames(exercise);
  return frames[0];
}
