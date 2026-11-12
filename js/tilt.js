// tilt.js — prepoznavanje nagiba u 4 smjera (deviceorientation) + strelice na tipkovnici.

// ---- Podesive konstante (početne vrijednosti; klizač "Osjetljivost" ih mijenja uživo) ----
export const TRIGGER_DEG = 15; // smjer se okida kad kut pređe ovaj prag (u odnosu na neutralni položaj)
export const RESET_DEG = 7;    // ta os se ponovno "naoruža" kad se vrati unutar ovog praga
const RESET_RATIO = RESET_DEG / TRIGGER_DEG; // ~45 %: reset prati okidač kad se mijenja osjetljivost
const INVERT_UP_DOWN = false;  // true = zamijeni Up i Down ako se čini obrnuto

// beta = nagib naprijed/natrag, gamma = lijevo/desno.
// Up = gornji rub mobitela nagnut OD sebe, Down = prema sebi.

let triggerDeg = TRIGGER_DEG;
let resetDeg = RESET_DEG;

const listeners = [];
let neutral = null;               // {beta, gamma}
let last = null;                  // zadnje sirovo očitanje
let rel = { dy: 0, dx: 0 };       // kutovi relativno prema neutralnom
const fired = { y: null, x: null }; // po osi: zadnji okinuti smjer dok se os ne vrati u sredinu
let lastDir = null;
let lastSource = null;
let readings = 0;
let started = false;

export function onTilt(fn) {
  listeners.push(fn);
}

export function trigger(dir, source = 'ui') {
  lastDir = dir;
  lastSource = source;
  listeners.forEach((fn) => fn(dir, source));
}

export function setSensitivity(deg) {
  triggerDeg = deg;
  resetDeg = Math.round(deg * RESET_RATIO);
}

// iOS 13+ traži dopuštenje; mora se pozvati iz tap događaja.
export async function requestPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return 'unsupported';
  if (typeof DOE.requestPermission === 'function') {
    try {
      return await DOE.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

export function needsPermission() {
  return typeof window.DeviceOrientationEvent?.requestPermission === 'function';
}

export function start() {
  if (started) return;
  started = true;
  window.addEventListener('deviceorientation', handleOrientation);
}

// Trenutni kut postaje neutralni položaj.
export function calibrate() {
  neutral = last ? { ...last } : null; // null = uzmi sljedeće očitanje
  fired.y = fired.x = null;
}

export function hasSensorData() {
  return last !== null;
}

export function getDebug() {
  return { ...rel, raw: last, fired: { ...fired }, lastDir, lastSource, triggerDeg, resetDeg, readings };
}

// Razlika kutova svedena u [-range/2, range/2), da prijelaz npr. gamma 89° -> -89° ne izgleda kao skok od 178°.
function wrap(d, range) {
  return ((((d + range / 2) % range) + range) % range) - range / 2;
}

function handleOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  readings++;
  last = { beta: e.beta, gamma: e.gamma };
  if (!neutral) neutral = { ...last }; // prvo očitanje = neutralni položaj

  const dy = wrap(last.beta - neutral.beta, 360);
  const dx = wrap(last.gamma - neutral.gamma, 180);
  rel = { dy, dx };

  // Svaka os se zasebno vraća u stanje pripravnosti (prije: obje osi su morale biti < praga istovremeno).
  if (fired.y && Math.abs(dy) < resetDeg) fired.y = null;
  if (fired.x && Math.abs(dx) < resetDeg) fired.x = null;

  // Dijagonala: odlučuje os s većim otklonom.
  const yDominant = Math.abs(dy) >= Math.abs(dx);
  const value = yDominant ? dy : dx;
  if (Math.abs(value) <= triggerDeg) return;

  const axis = yDominant ? 'y' : 'x';
  const dir = yDominant
    ? ((value < 0) !== INVERT_UP_DOWN ? 'up' : 'down')
    : (value > 0 ? 'right' : 'left');

  // Isti smjer se ne ponavlja dok se drži nagnut; suprotni smjer iste osi smije odmah okinuti.
  if (fired[axis] === dir) return;
  fired[axis] = dir;
  trigger(dir, 'tilt');
}

// ---- Tipkovnica (razvoj bez mobitela) ----
// Pritisak strelice = jedan nagib; držanje ne ponavlja (kao histereza kod nagiba).
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const held = new Set();

window.addEventListener('keydown', (e) => {
  const dir = KEYS[e.key];
  if (!dir || e.target.matches?.('input')) return;
  e.preventDefault();
  if (held.has(dir)) return;
  held.add(dir);
  trigger(dir, 'key');
});

window.addEventListener('keyup', (e) => {
  const dir = KEYS[e.key];
  if (dir) held.delete(dir);
});
