// YouTube integration using search links (always works, never stale)
// Instead of hardcoded video IDs that expire, we generate YouTube search queries

/**
 * Generate a YouTube search URL for an exercise
 * This always works and shows the most relevant, up-to-date videos
 */
export function getYoutubeSearchUrl(exerciseName: string): string {
  const query = encodeURIComponent(`${exerciseName} proper form technique`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * Generate a YouTube embed URL that shows search results
 * For inline display in the app
 */
export function getYoutubeEmbedSearch(exerciseName: string): string {
  const query = encodeURIComponent(`${exerciseName} form guide`);
  return `https://www.youtube.com/embed?listType=search&list=${query}`;
}

/**
 * Curated YouTube channel search — searches within top fitness channels
 * for the most trusted form guides
 */
export function getYoutubeChannelSearch(exerciseName: string, channel: string = 'Jeff Nippard'): string {
  const query = encodeURIComponent(`${channel} ${exerciseName}`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

/**
 * Get multiple YouTube search variations for an exercise
 */
export function getVideoSearchOptions(exerciseName: string): { label: string; url: string }[] {
  return [
    { label: 'Form Guide', url: getYoutubeSearchUrl(exerciseName) },
    { label: 'Jeff Nippard', url: getYoutubeChannelSearch(exerciseName, 'Jeff Nippard') },
    { label: 'AthleanX', url: getYoutubeChannelSearch(exerciseName, 'AthleanX') },
    { label: 'Renaissance', url: getYoutubeChannelSearch(exerciseName, 'Renaissance Periodization') },
  ];
}
