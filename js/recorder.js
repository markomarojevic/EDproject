// recorder.js — snimanje layera i reprodukcija u petlji (lookahead raspoređivanje na Web Audio satu).

import { getContext, playSound, playClick } from './audio.js';

// ---- Podesive konstante ----
export const LOOP_MS = 8000;      // duljina petlje
export const BEAT_MS = 500;       // razmak klikova metronoma (120 BPM -> 16 udaraca u petlji)
const COUNT_IN_MS = 1000;         // razmak brojeva u odbrojavanju 3-2-1
const COUNT_IN = 3;
const LOOKAHEAD_MS = 120;         // koliko unaprijed raspoređujemo zvukove
const TICK_MS = 25;               // koliko često scheduler provjerava
const STORAGE_KEY = 'expressive-touch-layers';

// Layer: { id, name, sounds: [up, down, left, right], events: [{soundId, direction, t}], muted }
let layers = load();

let playing = false;
let loopStart = 0;       // audio vrijeme (s) kad je petlja 0 počela
let scheduledUntil = 0;  // ms na vremenskoj crti petlje do kojih je sve raspoređeno
let pausedPos = 0;       // ms unutar petlje gdje je pauzirano
let timer = null;
let rec = null;          // { start, sounds, events, onDone } dok traje snimanje
let soloId = null;       // id layera koji se sluša sam (preview), null = svi nemutirani

const changeListeners = [];
export const onChange = (fn) => changeListeners.push(fn);
const notify = () => changeListeners.forEach((fn) => fn());

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(data)) return [];
    // Layeri spremaju samo ID-eve zvukova; odbaci zapise neispravnog oblika (npr. stare verzije)
    return data.filter((l) => l && Array.isArray(l.events) && Array.isArray(l.sounds) && typeof l.name === 'string');
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
  } catch { /* npr. privatni način rada */ }
  notify();
}

export const getLayers = () => layers;
export const getRecording = () => rec;
export const isPlaying = () => playing;
export const isRecording = () => rec !== null;
export const getSoloId = () => soloId;

// ---- Scheduler ----

// Rasporedi sve pojave događaja layera u intervalu [from, to) (ms od loopStart).
function scheduleLayer(layer, from, to) {
  const firstLoop = Math.floor(from / LOOP_MS);
  const lastLoop = Math.floor(to / LOOP_MS);
  for (let k = firstLoop; k <= lastLoop; k++) {
    for (const ev of layer.events) {
      const at = k * LOOP_MS + ev.t;
      if (at >= from && at < to) playSound(ev.soundId, loopStart + at / 1000);
    }
  }
}

function tick() {
  const windowEnd = (getContext().currentTime - loopStart) * 1000 + LOOKAHEAD_MS;
  if (windowEnd <= scheduledUntil) return;
  // Mute/Delete/solo se čitaju svaki put, pa djeluju odmah bez prekida petlje.
  for (const layer of layers) {
    const audible = soloId !== null ? layer.id === soloId : !layer.muted;
    if (audible) scheduleLayer(layer, scheduledUntil, windowEnd);
  }
  scheduledUntil = windowEnd;
}

function startScheduler(startTime, fromMs) {
  loopStart = startTime - fromMs / 1000;
  scheduledUntil = fromMs;
  playing = true;
  clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
  tick();
}

// Play all: svi nemutirani layeri zajedno. Ako već svira solo, prebaci na sve bez prekida petlje.
export function playAll() {
  soloId = null;
  if (!playing) startScheduler(getContext().currentTime + 0.05, 0);
  notify();
}

// Solo preview: samo jedan layer (i kad je mutiran).
export function preview(id) {
  soloId = id;
  if (!playing) startScheduler(getContext().currentTime + 0.05, 0);
  notify();
}

export function stop() {
  if (!playing || rec) return;
  playing = false;
  soloId = null;
  pausedPos = 0;
  clearInterval(timer);
  notify();
}

function positionMs() {
  if (!playing) return pausedPos;
  const ms = (getContext().currentTime - loopStart) * 1000;
  return ms < 0 ? 0 : ms % LOOP_MS;
}

// 0..1 položaj u petlji (za playhead), null = nema što prikazati.
export function getProgress() {
  if (rec) {
    const ms = (getContext().currentTime - rec.start) * 1000;
    return ms < 0 ? null : Math.min(ms / LOOP_MS, 1);
  }
  return positionMs() / LOOP_MS;
}

// ---- Snimanje ----

export function startRecording(sounds, { onCount, onDone } = {}) {
  if (rec) return;
  const c = getContext();
  const t0 = c.currentTime + 0.1;
  const start = t0 + (COUNT_IN * COUNT_IN_MS) / 1000;

  // Odbrojavanje + metronom kroz cijelu petlju, sve na audio satu
  for (let i = 0; i < COUNT_IN; i++) playClick(t0 + (i * COUNT_IN_MS) / 1000, true);
  for (let b = 0; b < LOOP_MS / BEAT_MS; b++) playClick(start + (b * BEAT_MS) / 1000, b % 4 === 0);

  rec = { start, sounds: [...sounds], events: [], onDone };
  soloId = null;

  // Postojeći layeri sviraju poravnato sa snimkom (overdub)
  startScheduler(start, 0);

  const msUntil = (t) => (t - c.currentTime) * 1000;
  for (let i = 0; i < COUNT_IN; i++) {
    setTimeout(() => onCount?.(COUNT_IN - i), msUntil(t0) + i * COUNT_IN_MS);
  }
  setTimeout(() => onCount?.(0), msUntil(start));
  setTimeout(finishRecording, msUntil(start) + LOOP_MS);
  notify();
}

// Poziva se pri svakom nagibu; bilježi samo dok traje snimanje (ne za vrijeme odbrojavanja).
export function addEvent(direction, soundId) {
  if (!rec) return;
  const t = (getContext().currentTime - rec.start) * 1000;
  if (t < 0 || t >= LOOP_MS) return;
  rec.events.push({ soundId, direction, t: Math.round(t) });
  notify();
}

function finishRecording() {
  const layer = {
    id: Date.now(),
    name: `Layer ${nextLayerNumber()}`,
    sounds: rec.sounds,
    events: rec.events,
    muted: false,
  };
  layers.push(layer);
  // Scheduler je već otišao malo u sljedeću petlju — nadoknadi taj dio za novi layer.
  scheduleLayer(layer, LOOP_MS, scheduledUntil);
  const { onDone } = rec;
  rec = null;
  onDone?.(layer);
  save();
}

function nextLayerNumber() {
  const nums = layers.map((l) => parseInt(l.name.replace(/\D/g, ''), 10) || 0);
  return Math.max(0, ...nums) + 1;
}

// ---- Upravljanje layerima ----

export function toggleMute(id) {
  const layer = layers.find((l) => l.id === id);
  if (layer) layer.muted = !layer.muted;
  save();
}

export function deleteLayer(id) {
  layers = layers.filter((l) => l.id !== id);
  if (soloId === id) soloId = null;
  save();
}
