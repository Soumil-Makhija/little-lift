import { fetchJoke, readFavorites, writeFavorites, formatJoke } from './core.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { /* Storage can be disabled. */ }
let favorites = readFavorites(storage);
let current = null;
let category = 'all';
let revealed = false;
let busy = false;
let toastTimer;

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function syncControls() {
  $('next').disabled = busy;
  $('reveal').disabled = busy || !current || revealed;
  for (const id of ['save', 'copy', 'share']) $(id).disabled = busy || !current || !revealed;
  for (const input of document.querySelectorAll('[name="category"]')) input.disabled = busy;
  const saved = !!current && favorites.some(joke => joke.id === current.id);
  $('save').textContent = saved ? '♥' : '♡';
  $('save').setAttribute('aria-pressed', String(saved));
  $('save').setAttribute('aria-label', saved ? 'Unsave joke' : 'Save joke');
  $('next-label').textContent = busy ? 'Finding a joke…' : current ? 'Give me another' : 'Try again';
  $('joke-card').setAttribute('aria-busy', String(busy));
}
function persist() {
  if (!writeFavorites(storage, favorites)) notify('Saved for this visit. Browser storage is unavailable.');
  renderFavorites();
  syncControls();
}
function renderFavorites() {
  $('saved-count').textContent = favorites.length;
  $('empty-state').hidden = favorites.length > 0;
  $('saved-list').replaceChildren();
  for (const joke of favorites) {
    const card = document.createElement('article');
    card.className = 'saved-card';
    const tag = document.createElement('p'); tag.className = 'eyebrow'; tag.textContent = joke.type;
    const setup = document.createElement('h3'); setup.textContent = joke.setup;
    const answer = document.createElement('p'); answer.textContent = joke.punchline;
    const remove = document.createElement('button'); remove.className = 'remove-button'; remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove saved joke: ${joke.setup}`);
    remove.addEventListener('click', () => {
      const index = favorites.findIndex(item => item.id === joke.id);
      favorites = favorites.filter(item => item.id !== joke.id);
      persist();
      const buttons = $('saved-list').querySelectorAll('button');
      if (buttons.length) buttons[Math.min(index, buttons.length - 1)].focus();
      else $('save').disabled ? $('next').focus() : $('save').focus();
      notify('Joke removed from your collection.');
    });
    card.append(tag, setup, answer, remove);
    $('saved-list').append(card);
  }
}
async function loadJoke() {
  if (busy) return;
  busy = true;
  $('error').hidden = true;
  syncControls();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let next = await fetchJoke(category, { signal: controller.signal });
    // Give the random service one more chance if it repeats the current joke.
    if (next.id === current?.id) next = await fetchJoke(category, { signal: controller.signal });
    current = next;
    revealed = false;
    $('setup').textContent = current.setup;
    $('punchline').hidden = true;
    $('punchline').textContent = '';
    $('joke-type').textContent = current.type === 'general' ? 'EVERYDAY HUMOR' : current.type.toUpperCase();
    $('reveal').hidden = false;
    $('card-note').textContent = 'A little suspense is part of the fun.';
  } catch (error) {
    $('error').textContent = error.name === 'AbortError' ? 'That took a little too long. Please try again.' : 'Couldn’t fetch a fresh joke. Check your connection and try again.';
    $('error').hidden = false;
    if (!current) {
      $('setup').textContent = 'Even good jokes need a second chance.';
      $('card-note').textContent = 'Tap “Try again” when you’re ready.';
    }
  } finally {
    clearTimeout(timeout);
    busy = false;
    syncControls();
  }
}
$('next').addEventListener('click', loadJoke);
$('filters').addEventListener('change', event => { category = event.target.value; loadJoke(); });
$('reveal').addEventListener('click', () => {
  revealed = true;
  $('punchline').textContent = current.punchline;
  $('punchline').hidden = false;
  $('reveal').hidden = true;
  $('card-note').textContent = 'A keeper? Save it for a rainy day.';
  syncControls();
  $('save').focus();
});
$('save').addEventListener('click', () => {
  const saved = favorites.some(joke => joke.id === current.id);
  if (!saved && favorites.length >= 100) return notify('Your pocket is full! Remove a saved joke to make room.');
  favorites = saved ? favorites.filter(joke => joke.id !== current.id) : [current, ...favorites];
  notify(saved ? 'Removed from your collection.' : 'A good laugh, saved.');
  persist();
});
async function copyJoke() {
  try { await navigator.clipboard.writeText(formatJoke(current)); notify('Joke copied. Pass the smile along!'); }
  catch { notify('Copy isn’t available. You can select the joke text to copy it.'); }
}
$('copy').addEventListener('click', copyJoke);
$('share').addEventListener('click', async () => {
  if (!navigator.share) return copyJoke();
  try { await navigator.share({ title: 'A little lift for you', text: formatJoke(current) }); }
  catch (error) { if (error.name !== 'AbortError') notify('Sharing isn’t available. Try the copy button.'); }
});
renderFavorites();
syncControls();
loadJoke();
