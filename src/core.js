export const STORAGE_KEY = 'little-lift:favorites:v1';
export const CATEGORIES = ['all', 'general', 'programming'];
export function normalizeJoke(data) {
  const joke = Array.isArray(data) ? data[0] : data;
  if (!joke || !Number.isInteger(joke.id) || typeof joke.setup !== 'string' || !joke.setup.trim() || typeof joke.punchline !== 'string' || !joke.punchline.trim() || typeof joke.type !== 'string') {
    throw new Error('The joke service sent an unexpected response. Please try again.');
  }
  return { id: joke.id, type: joke.type, setup: joke.setup, punchline: joke.punchline };
}
export async function fetchJoke(category = 'all', { fetcher = fetch, signal } = {}) {
  if (!CATEGORIES.includes(category)) throw new Error('Unknown joke category.');
  const endpoint = category === 'all' ? 'random_joke' : `jokes/${category}/random`;
  const response = await fetcher(`https://official-joke-api.appspot.com/${endpoint}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('The joke service is taking a break. Please try again.');
  return normalizeJoke(await response.json());
}
export function readFavorites(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.slice(0, 100).flatMap(value => {
      try {
        const joke = normalizeJoke(value);
        if (seen.has(joke.id)) return [];
        seen.add(joke.id);
        return [joke];
      } catch { return []; }
    });
  } catch { return []; }
}
export function writeFavorites(storage, favorites) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(favorites)); return true; }
  catch { return false; }
}
export function formatJoke(joke) { return `${joke.setup}\n\n${joke.punchline}`; }
