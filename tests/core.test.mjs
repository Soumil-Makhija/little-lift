import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJoke, normalizeJoke, readFavorites, writeFavorites, formatJoke } from '../src/core.js';

const joke = { id: 42, type: 'general', setup: 'A setup?', punchline: 'A punchline.' };
test('normalizes both API response formats', () => {
  assert.deepEqual(normalizeJoke(joke), joke);
  assert.deepEqual(normalizeJoke([joke]), joke);
});
test('rejects empty, malformed, or incomplete API responses', () => {
  for (const value of [null, [], {}, { ...joke, id: '42' }, { ...joke, setup: ' ' }, { ...joke, punchline: null }]) assert.throws(() => normalizeJoke(value));
});
test('uses the correct endpoint for each category', async () => {
  for (const [category, endpoint] of [['all', 'random_joke'], ['general', 'jokes/general/random'], ['programming', 'jokes/programming/random']]) {
    const result = await fetchJoke(category, { fetcher: async (url, options) => {
      assert.equal(url, `https://official-joke-api.appspot.com/${endpoint}`);
      assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => [joke] };
    } });
    assert.deepEqual(result, joke);
  }
});
test('rejects unknown categories, HTTP failures, invalid JSON and network failures', async () => {
  await assert.rejects(fetchJoke('unknown'));
  await assert.rejects(fetchJoke('all', { fetcher: async () => ({ ok: false }) }));
  await assert.rejects(fetchJoke('all', { fetcher: async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }) }));
  await assert.rejects(fetchJoke('all', { fetcher: async () => { throw new TypeError('Offline'); } }));
});
test('forwards cancellation to fetch', async () => {
  const controller = new AbortController();
  await fetchJoke('all', { signal: controller.signal, fetcher: async (_, options) => {
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => joke };
  } });
});
test('handles corrupt and inaccessible browser storage', () => {
  assert.deepEqual(readFavorites(undefined), []);
  for (const value of ['not JSON', '{}', 'null']) assert.deepEqual(readFavorites({ getItem: () => value }), []);
  assert.equal(writeFavorites({ setItem() { throw new Error('quota'); } }, [joke]), false);
});
test('round-trips favorites and discards invalid or duplicate entries', () => {
  let value;
  const storage = { setItem: (_, data) => { value = data; }, getItem: () => value };
  assert.equal(writeFavorites(storage, [joke, null, joke]), true);
  assert.deepEqual(readFavorites(storage), [joke]);
});
test('formats a complete joke for copying or sharing', () => {
  assert.equal(formatJoke(joke), 'A setup?\n\nA punchline.');
});
