// audio.js — sinteza 16 zvukova u Web Audio API-ju (bez vanjskih datoteka).
// Izlaže: SOUNDS, getContext(), unlockAudio(), playSound(id, vrijeme?), playClick(vrijeme, naglasak?)

let ctx = null;
let master = null;
let noiseBuf = null;

export function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(comp);
    comp.connect(ctx.destination);

    // 1 sekunda bijelog šuma za bubnjeve
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

// Mora se pozvati iz korisničke geste (tap/tipka) da preglednik dopusti zvuk.
export function unlockAudio() {
  const c = getContext();
  if (c.state !== 'running') c.resume();
}

// --- pomoćne funkcije --------------------------------------------------------

// Ovojnica glasnoće: brzi napad, eksponencijalno opadanje.
function envelope(t, peak, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  return g;
}

function makeFilter(type, freq, q, out) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(out);
  return f;
}

// Oscilator; opcionalno klizanje frekvencije (freqEnd) i filtar [tip, frekv, Q].
function osc(t, type, freq, dur, peak, { freqEnd, filter } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur * 0.8);
  const g = envelope(t, peak, dur);
  o.connect(filter ? makeFilter(filter[0], filter[1], filter[2], g) : g);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, peak, filterType, freq, q = 1) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.connect(makeFilter(filterType, freq, q, envelope(t, peak, dur)));
  s.start(t);
  s.stop(t + dur + 0.05);
}

// --- definicije zvukova ------------------------------------------------------
// kind: drum | bass | tone (koristi se za boju ćelije u mreži)

const DEFS = [
  ['Kick', 'drum', (t) => osc(t, 'sine', 150, 0.45, 1, { freqEnd: 45 })],
  ['Snare', 'drum', (t) => { noise(t, 0.2, 0.6, 'highpass', 1200); osc(t, 'triangle', 190, 0.1, 0.5); }],
  ['Hi-hat', 'drum', (t) => noise(t, 0.05, 0.4, 'highpass', 7000)],
  ['Open hat', 'drum', (t) => noise(t, 0.35, 0.3, 'highpass', 7000)],
  ['Clap', 'drum', (t) => {
    [0, 0.012, 0.024].forEach((d) => noise(t + d, 0.03, 0.5, 'bandpass', 1500, 1.5));
    noise(t + 0.03, 0.18, 0.4, 'bandpass', 1500, 1.5);
  }],
  ['Low tom', 'drum', (t) => osc(t, 'sine', 130, 0.4, 0.8, { freqEnd: 75 })],
  ['High tom', 'drum', (t) => osc(t, 'sine', 220, 0.3, 0.7, { freqEnd: 140 })],
  ['Rim', 'drum', (t) => { osc(t, 'triangle', 1700, 0.04, 0.4); noise(t, 0.02, 0.3, 'bandpass', 3000, 2); }],
  ['Cowbell', 'drum', (t) => {
    osc(t, 'square', 545, 0.3, 0.2, { filter: ['bandpass', 800, 1] });
    osc(t, 'square', 815, 0.3, 0.2, { filter: ['bandpass', 800, 1] });
  }],
  ['Bass C', 'bass', (t) => osc(t, 'sawtooth', 65.41, 0.5, 0.5, { filter: ['lowpass', 600, 4] })],
  ['Bass Eb', 'bass', (t) => osc(t, 'sawtooth', 77.78, 0.5, 0.5, { filter: ['lowpass', 600, 4] })],
  ['Bass G', 'bass', (t) => osc(t, 'sawtooth', 98.0, 0.5, 0.5, { filter: ['lowpass', 600, 4] })],
  ['Tone C', 'tone', (t) => { osc(t, 'triangle', 261.63, 0.7, 0.35); osc(t, 'sine', 523.25, 0.4, 0.1); }],
  ['Tone Eb', 'tone', (t) => { osc(t, 'triangle', 311.13, 0.7, 0.35); osc(t, 'sine', 622.25, 0.4, 0.1); }],
  ['Tone G', 'tone', (t) => { osc(t, 'triangle', 392.0, 0.7, 0.35); osc(t, 'sine', 784.0, 0.4, 0.1); }],
  ['Tone Bb', 'tone', (t) => { osc(t, 'triangle', 466.16, 0.7, 0.35); osc(t, 'sine', 932.33, 0.4, 0.1); }],
];

export const SOUNDS = DEFS.map(([name, kind], id) => ({ id, name, kind }));

// Pusti zvuk odmah ili u zadanom trenutku (u sekundama Web Audio sata).
export function playSound(id, time) {
  const c = getContext();
  const def = DEFS[id];
  if (!def) return;
  def[2](Math.max(time ?? c.currentTime, c.currentTime));
}

// Tihi klik metronoma.
export function playClick(time, accent = false) {
  getContext();
  osc(time, 'sine', accent ? 1600 : 1100, 0.04, accent ? 0.18 : 0.1);
}
