// app.js — povezuje audio, nagib, snimanje i sučelje.

import * as audio from './audio.js';
import * as tilt from './tilt.js';
import * as recorder from './recorder.js';
import * as ui from './ui.js';

const KEYS = {
  assignment: 'expressive-touch-assignment',
  favorites: 'expressive-touch-favorites',
  sensitivity: 'expressive-touch-sensitivity',
};
const DEFAULT_ASSIGNMENT = { up: 0, down: 1, left: 2, right: 12 };

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* npr. privatni način rada */ }
}

// Spremaju se samo ID-evi zvukova (nikad nazivi); stari ili neispravni podaci se zamijene zadanima.
const validId = (id) => Number.isInteger(id) && id >= 0 && id < audio.SOUNDS.length;

let assignment = load(KEYS.assignment, null); // smjer -> id zvuka
if (!assignment || !ui.DIRS.every((d) => validId(assignment[d]))) assignment = { ...DEFAULT_ASSIGNMENT };
let favorites = load(KEYS.favorites, []);     // niz četvorki [up, down, left, right]
if (!Array.isArray(favorites)) favorites = [];
favorites = favorites.filter((f) => Array.isArray(f) && f.length === 4 && f.every(validId));
let activeSlot = 0;                            // smjer koji se mijenja (0..3 = Up, Down, Left, Right)
let selected = assignment.up;                  // označena ćelija u mreži (proba, još nije dodijeljena)
let selectedLayerId = recorder.getLayers().at(-1)?.id ?? null;

// ---- Kada nagib smije svirati ----
// Samo na Home ekranu (ako sviranje nije pauzirano) i u Studiju dok traje snimanje (uklj. odbrojavanje).
// Nagib se i dalje očitava u pozadini, ali se događaji izvan toga odbacuju — ništa se ne sprema za kasnije.
let screen = 'home';
let homeStarted = false; // je li blob već jednom dodirnut
let homePlaying = true;  // korisnikov izbor na Homeu (false = ručno pauzirano)

function canPlay() {
  if (screen === 'home') return homePlaying;
  if (screen === 'studio') return recorder.isRecording();
  return false;
}

function refreshHomeState() {
  ui.setHomePlaying(!homeStarted ? 'start' : homePlaying ? 'on' : 'off');
}

// ---- Nagib -> zvuk ----
tilt.onTilt((dir) => {
  if (!canPlay()) return;
  audio.unlockAudio();
  const soundId = assignment[dir];
  if (soundId == null) return;
  audio.playSound(soundId);
  recorder.addEvent(dir, soundId);
  ui.flashArrow(dir);
  ui.nudgeBlob(dir);
  // vibracija je dopuštena tek nakon prvog dodira stranice
  if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(20);
});

// Svaka gesta otključava zvuk (preglednici to traže)
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, audio.unlockAudio));

// ---- Home ----
// Dodir na blob: prvi put pokreće zvuk/senzor (sviranje uključeno), zatim play/pause.
document.querySelector('#blob').addEventListener('click', async () => {
  audio.unlockAudio();
  ui.pulseBlob();

  if (homeStarted) {
    homePlaying = !homePlaying;
    refreshHomeState();
    return;
  }

  homeStarted = true;
  homePlaying = true;
  refreshHomeState();
  const result = await tilt.requestPermission(); // iOS dijalog — mora biti unutar tapa
  if (result !== 'granted') {
    ui.setStatus('Tilt sensor not available. Use the arrow keys or tap the arrows.');
    return;
  }
  tilt.start();
  tilt.calibrate(); // položaj u kojem korisnik drži mobitel kad počne svirati = neutralni
  ui.setStatus('Ready! Tilt your phone.');
  setTimeout(() => {
    if (!tilt.hasSensorData()) ui.setStatus('No sensor data (desktop?). Use the arrow keys ← ↑ → ↓.');
  }, 1000);
});

document.querySelector('#calibrate').addEventListener('click', () => {
  tilt.calibrate();
  ui.setStatus('Neutral position set.');
});

// Osjetljivost
const slider = document.querySelector('#sensitivity');
function applySensitivity(deg) {
  tilt.setSensitivity(deg);
  ui.setSensitivityLabel(deg);
}
slider.value = load(KEYS.sensitivity, tilt.TRIGGER_DEG);
applySensitivity(Number(slider.value));
slider.addEventListener('input', () => {
  applySensitivity(Number(slider.value));
  store(KEYS.sensitivity, Number(slider.value));
});
slider.addEventListener('change', () => slider.blur()); // da strelice opet sviraju, a ne pomiču klizač

// Skriveni debug: 5 brzih dodira na naslov
let titleTaps = [];
document.querySelector('#title').addEventListener('click', () => {
  const now = Date.now();
  titleTaps = [...titleTaps.filter((t) => now - t < 2000), now];
  if (titleTaps.length >= 5) {
    titleTaps = [];
    ui.toast(ui.toggleDebug() ? 'Debug on' : 'Debug off');
  }
});

// Strelice na ekranu također sviraju (korisno za test bez senzora); vrijede ista pravila kao za nagib
document.querySelectorAll('.arrow').forEach((el) => {
  el.addEventListener('click', () => tilt.trigger(el.dataset.dir, 'ui'));
});

// Android/desktop ne traže dopuštenje — slušaj odmah
if (!tilt.needsPermission()) tilt.start();

// ---- Sound Map ----
const combo = () => ui.DIRS.map((d) => assignment[d]);
const sameCombo = (a, b) => a.every((v, i) => v === b[i]);
const favoriteIndex = () => favorites.findIndex((f) => sameCombo(f, combo()));

function refreshSoundMap() {
  ui.renderSoundMap({ assignment, activeSlot, selected, isFavorite: favoriteIndex() !== -1 });
  ui.renderArrowLabels(assignment);
  ui.renderFavorites(favorites);
}

// Dodir na ćeliju: samo proba i oznaka, bez dodjele
document.querySelector('#grid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  selected = Number(cell.dataset.id);
  audio.playSound(selected);
  refreshSoundMap();
});

// Dodir na strelicu: biraš smjer koji mijenjaš; njegov zvuk se označi u mreži
document.querySelector('#assign').addEventListener('click', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  activeSlot = Number(slot.dataset.slot);
  selected = assignment[slot.dataset.dir];
  if (selected != null) audio.playSound(selected);
  refreshSoundMap();
});

// Potvrdi: dodijeli označeni zvuk aktivnom smjeru i prijeđi na sljedeći
document.querySelector('#confirm').addEventListener('click', () => {
  if (selected == null) return;
  const dir = ui.DIRS[activeSlot];
  assignment[dir] = selected;
  store(KEYS.assignment, assignment);
  ui.toast(`${ui.ARROW[dir]} ${ui.DIR_NAME[dir]} = ${audio.SOUNDS[selected].name}`);
  activeSlot = (activeSlot + 1) % 4;
  selected = assignment[ui.DIRS[activeSlot]];
  refreshSoundMap();
});

// Favoriti
document.querySelector('#fav-star').addEventListener('click', () => {
  if (combo().some((id) => id == null)) {
    ui.toast('Combination incomplete — all 4 directions need a sound.');
    return;
  }
  const i = favoriteIndex();
  if (i === -1) {
    favorites.push(combo());
    ui.toast('Saved to favorites ★');
  } else {
    favorites.splice(i, 1);
    ui.toast('Removed from favorites');
  }
  store(KEYS.favorites, favorites);
  refreshSoundMap();
});

document.querySelector('#fav-open').addEventListener('click', () => ui.setFavPanel(true));
document.querySelector('#fav-close').addEventListener('click', () => ui.setFavPanel(false));
document.querySelector('#fav-panel').addEventListener('click', (e) => {
  if (e.target.id === 'fav-panel') return ui.setFavPanel(false); // dodir izvan panela
  const del = e.target.closest('[data-delete]');
  if (del) {
    favorites.splice(Number(del.dataset.delete), 1);
    store(KEYS.favorites, favorites);
    refreshSoundMap();
    return;
  }
  const apply = e.target.closest('.fav-apply');
  if (apply) {
    favorites[Number(apply.dataset.index)].forEach((id, i) => (assignment[ui.DIRS[i]] = id));
    store(KEYS.assignment, assignment);
    selected = assignment[ui.DIRS[activeSlot]];
    refreshSoundMap();
    ui.setFavPanel(false);
    ui.toast('Favorite applied');
  }
});

// ---- Studio ----
document.querySelector('#play').addEventListener('click', () => {
  const playingAll = recorder.isPlaying() && recorder.getSoloId() === null;
  playingAll ? recorder.stop() : recorder.playAll();
});

document.querySelector('#rec').addEventListener('click', () => {
  recorder.startRecording(combo(), {
    onCount: ui.showCountdown,
    onDone: (layer) => (selectedLayerId = layer.id), // novi layer je automatski odabran
  });
});

document.querySelector('#layers').addEventListener('click', (e) => {
  const item = e.target.closest('.layer');
  if (!item) return;
  const id = Number(item.dataset.id);
  selectedLayerId = id;
  const action = e.target.closest('button[data-action]')?.dataset.action;
  if (action === 'mute') recorder.toggleMute(id);
  else if (action === 'delete') recorder.deleteLayer(id);
  else if (action === 'solo') {
    recorder.isPlaying() && recorder.getSoloId() === id ? recorder.stop() : recorder.preview(id);
  } else refreshStudio();
});

function refreshStudio() {
  const layers = recorder.getLayers();
  const rec = recorder.getRecording();
  if (!layers.some((l) => l.id === selectedLayerId)) selectedLayerId = layers.at(-1)?.id ?? null;
  const layer = layers.find((l) => l.id === selectedLayerId);

  ui.renderLayers(layers, selectedLayerId, recorder.isPlaying() ? recorder.getSoloId() : null);
  ui.setStudioButtons({ playingAll: recorder.isPlaying() && recorder.getSoloId() === null, recording: !!rec });
  if (rec) ui.renderTimeline('Recording…', rec.events);
  else if (layer) ui.renderTimeline(`Timeline: ${layer.name}`, layer.events);
  else ui.renderTimeline('Timeline: —', []);
}
recorder.onChange(refreshStudio);

// Playhead + debug
function frame() {
  const show = recorder.isPlaying() || recorder.isRecording();
  ui.setPlayhead(show ? recorder.getProgress() : null);
  if (!document.querySelector('#debug').hidden) ui.renderDebug(tilt.getDebug(), canPlay());
  requestAnimationFrame(frame);
}

// ---- Start ----
ui.initNav((name) => {
  screen = name; // napuštanjem Homea sviranje staje; povratkom vrijedi homePlaying
});
refreshHomeState();
refreshSoundMap();
refreshStudio();
requestAnimationFrame(frame);
