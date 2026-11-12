// ui.js — iscrtavanje ekrana (navigacija, mreža zvukova, favoriti, layeri, vremenska crta, debug).

import { SOUNDS } from './audio.js';
import { LOOP_MS } from './recorder.js';

export const DIRS = ['up', 'down', 'left', 'right'];
export const ARROW = { up: '↑', down: '↓', left: '←', right: '→' };
export const DIR_NAME = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const soundName = (id) => SOUNDS[id]?.name ?? '—'; // ID -> engleski naziv; nepoznat ID ne ruši prikaz

// ---- Navigacija ----
export function initNav(onChange) {
  $$('.tabbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.screen);
      onChange?.(btn.dataset.screen);
    });
  });
}

export function showScreen(name) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.screen === name));
}

// Stanje sviranja na Homeu: 'start' (prije prvog dodira), 'on', 'off'
export function setHomePlaying(state) {
  const blob = $('#blob');
  blob.classList.toggle('paused', state === 'off');
  blob.classList.toggle('playing', state !== 'off');
  const label = { start: 'Tap to start', on: 'Tap to pause', off: 'Tap to play' }[state];
  $('#blob-hint').textContent = label;
  blob.setAttribute('aria-label', label);
  blob.title = label;
  blob.setAttribute('aria-pressed', String(state === 'on'));
}

// ---- Povratna informacija na nagib ----
export function flashArrow(dir) {
  $$(`.arrow[data-dir="${dir}"]`).forEach((el) => {
    el.classList.remove('hit');
    void el.offsetWidth; // restart CSS animacije
    el.classList.add('hit');
  });
}

const NUDGE = { up: [0, -18], down: [0, 18], left: [-18, 0], right: [18, 0] };
export function nudgeBlob(dir) {
  const [x, y] = NUDGE[dir];
  $('#blob').animate(
    [{ transform: 'translate(0,0)' }, { transform: `translate(${x}px,${y}px) scale(1.06)` }, { transform: 'translate(0,0)' }],
    { duration: 300, easing: 'ease-out' }
  );
}

export function pulseBlob() {
  $('#blob').animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'ease-out' }
  );
}

export function setStatus(text) {
  $('#tilt-status').textContent = text;
}

export function setSensitivityLabel(deg) {
  $('#sens-value').textContent = `${deg}°`;
}

let toastTimer = null;
export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

// Natpisi zvukova ispod strelica (Home i Studio)
export function renderArrowLabels(assignment) {
  $$('.arrow').forEach((el) => {
    el.querySelector('.lbl').textContent = soundName(assignment[el.dataset.dir]);
  });
}

// ---- Debug ----
export function toggleDebug() {
  const el = $('#debug');
  el.hidden = !el.hidden;
  return !el.hidden;
}

export function renderDebug(d, active) {
  const f = (n) => (n == null ? '—' : n.toFixed(1).padStart(6));
  $('#debug').textContent =
    `beta rel ${f(d.dy)}°   gamma rel ${f(d.dx)}°\n` +
    `beta raw ${f(d.raw?.beta)}°   gamma raw ${f(d.raw?.gamma)}°\n` +
    `trigger ${d.triggerDeg}° / reset ${d.resetDeg}°   readings ${d.readings}\n` +
    `holding: y=${d.fired.y ?? '-'} x=${d.fired.x ?? '-'}   playing: ${active ? 'ON' : 'off'}\n` +
    `last direction: ${d.lastDir ? ARROW[d.lastDir] + ' ' + DIR_NAME[d.lastDir] : '—'} (${d.lastSource ?? '-'})`;
}

// ---- Sound Map ----
export function renderSoundMap({ assignment, activeSlot, selected, isFavorite }) {
  const activeDir = DIRS[activeSlot];

  $('#grid').innerHTML = SOUNDS.map((s) => {
    const dirs = DIRS.filter((d) => assignment[d] === s.id);
    const badges = dirs.map((d) => `<span class="badge" data-dir="${d}">${ARROW[d]}</span>`).join('');
    const cls = ['cell', s.kind, dirs.length ? 'assigned' : '', s.id === selected ? 'selected' : ''].join(' ');
    return `<button class="${cls}" data-id="${s.id}" ${dirs.length ? `data-dir="${dirs[0]}"` : ''}>
      <span class="badges">${badges}</span>${s.name}</button>`;
  }).join('');

  $('#assign').innerHTML = DIRS.map((d, i) => `
    <button class="slot ${i === activeSlot ? 'active' : ''}" data-dir="${d}" data-slot="${i}">
      <span class="slot-arrow">${ARROW[d]}</span>
      <span class="slot-name">${soundName(assignment[d])}</span>
    </button>`).join('');

  $('#active-dir').innerHTML = `<span data-dir="${activeDir}">${ARROW[activeDir]} ${DIR_NAME[activeDir]}</span>`;

  const confirm = $('#confirm');
  const unchanged = selected == null || selected === assignment[activeDir];
  confirm.disabled = unchanged;
  confirm.textContent = unchanged
    ? `Pick a sound for ${ARROW[activeDir]} ${DIR_NAME[activeDir]}`
    : `Confirm: ${soundName(selected)} → ${ARROW[activeDir]} ${DIR_NAME[activeDir]}`;

  const star = $('#fav-star');
  star.textContent = isFavorite ? '★' : '☆';
  star.classList.toggle('on', isFavorite);
  const starLabel = isFavorite ? 'Remove from favorites' : 'Save to favorites';
  star.setAttribute('aria-label', starLabel);
  star.title = starLabel;
}

export function renderFavorites(favorites) {
  $('#fav-count').textContent = favorites.length ? `(${favorites.length})` : '';
  $('#fav-list').innerHTML = favorites.length
    ? favorites.map((combo, i) => `
      <li class="fav">
        <button class="fav-apply" data-index="${i}">
          ${DIRS.map((d, j) => `<span class="fav-item"><b data-dir="${d}">${ARROW[d]}</b> ${soundName(combo[j])}</span>`).join('')}
        </button>
        <button class="btn small danger" data-delete="${i}" aria-label="Delete favorite" title="Delete favorite">✕</button>
      </li>`).join('')
    : '<li class="empty">No favorites yet. Tap ☆ to save the current combination.</li>';
}

export function setFavPanel(open) {
  $('#fav-panel').hidden = !open;
}

// ---- Studio ----
export function renderLayers(layers, selectedId, soloId) {
  const list = $('#layers');
  if (!layers.length) {
    list.innerHTML = '<li class="empty">No layers yet. Press “Record layer”.</li>';
    return;
  }
  list.innerHTML = layers.map((l) => `
    <li class="layer ${l.muted ? 'muted' : ''} ${l.id === selectedId ? 'selected' : ''}" data-id="${l.id}">
      <button class="btn small solo ${l.id === soloId ? 'on' : ''}" data-action="solo" data-id="${l.id}"
        aria-label="Play only this layer" title="Play only this layer">${l.id === soloId ? '■' : '▶'}</button>
      <div class="layer-info">
        <strong>${l.name}</strong>
        <span class="layer-sounds">${DIRS.map((d, i) => `<span data-dir="${d}">${ARROW[d]}</span> ${soundName(l.sounds[i])}`).join(' · ')}</span>
        <span class="layer-count">${l.events.length} ${l.events.length === 1 ? 'hit' : 'hits'}${l.id === soloId ? ' · solo' : ''}</span>
      </div>
      <button class="btn small" data-action="mute" data-id="${l.id}">${l.muted ? 'Unmute' : 'Mute'}</button>
      <button class="btn small danger" data-action="delete" data-id="${l.id}" aria-label="Delete layer" title="Delete layer">✕</button>
    </li>`).join('');
}

export function renderTimeline(title, events) {
  $('#timeline-title').textContent = title;
  DIRS.forEach((d) => {
    const lane = $(`.lane[data-dir="${d}"] .dots`);
    lane.innerHTML = events
      .filter((e) => e.direction === d)
      .map((e) => `<span class="dot" style="left:${(e.t / LOOP_MS) * 100}%"></span>`)
      .join('');
  });
}

export function setPlayhead(progress) {
  const ph = $('#playhead');
  ph.style.display = progress == null ? 'none' : 'block';
  if (progress != null) ph.style.left = `${progress * 100}%`;
}

export function setStudioButtons({ playingAll, recording }) {
  const play = $('#play');
  play.textContent = playingAll ? '■ Stop' : '▶ Play all';
  play.classList.toggle('on', playingAll);
  play.disabled = recording;
  const recBtn = $('#rec');
  recBtn.disabled = recording;
  recBtn.textContent = recording ? '● Recording…' : '● Record layer';
  recBtn.classList.toggle('recording', recording);
}

export function showCountdown(n) {
  const el = $('#countdown');
  if (n > 0) {
    el.hidden = false;
    el.textContent = n;
  } else {
    el.textContent = 'REC';
    setTimeout(() => (el.hidden = true), 500);
  }
}
