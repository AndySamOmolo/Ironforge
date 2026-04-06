import type { Exercise } from '@/lib/types';

type ExerciseMediaLike = Pick<Exercise, 'gifUrl' | 'imageUrls' | 'images'>;

function cleanUrl(value?: string): string | null {
  if (!value) {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}

export function toLocalExerciseImageUrl(relativePath: string): string {
  return `/exercise-images/${relativePath}`;
}

export function getExerciseImageFrames(exercise: ExerciseMediaLike): string[] {
  const byImageUrls = (exercise.imageUrls || [])
    .map((value) => cleanUrl(value))
    .filter((value): value is string => Boolean(value));

  if (byImageUrls.length > 0) {
    return Array.from(new Set(byImageUrls));
  }

  const byImages = (exercise.images || [])
    .map((value) => cleanUrl(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => toLocalExerciseImageUrl(value));

  return Array.from(new Set(byImages));
}

export function hasAnimatedExerciseMedia(exercise: ExerciseMediaLike): boolean {
  const gif = cleanUrl(exercise.gifUrl);
  if (gif) {
    return true;
  }

  return getExerciseImageFrames(exercise).length > 1;
}

export function getPrimaryExerciseImage(exercise: ExerciseMediaLike): string | undefined {
  const gif = cleanUrl(exercise.gifUrl);
  if (gif) {
    return gif;
  }

  const frames = getExerciseImageFrames(exercise);
  return frames[0];
}
