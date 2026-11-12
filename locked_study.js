import { loadSealedLetterSages } from './supabase/get_sealed_letter_sages.js';
import {
  trackPageView,
  trackGameStart,
  updateGameResult,
  trackGuess
} from './supabase/supabaseFunctions.js';

const DIFFICULTY_SCALE = {
  'Easy': 2,
  'Medium': 3,
  'Hard': 5
};

const TOTAL_TIME = 600;      // ten minutes of candle
const WRONG_PENALTY = 45;
const HINT_PENALTY = 30;

let pool = [];
let target = null;
let targetWork = null;
let targetCity = null;
let cipher = null;           // { word, fragment, intro }

let timeLeft = TOTAL_TIME;
let timerId = null;
let solved = { desk: false, clock: false, map: false, chest: false };
let mistakes = 0;
let finalGuesses = 0;
let gameId = null;
let gameOver = false;

const roomEl = document.getElementById('esc-room');
const fragmentsEl = document.getElementById('esc-fragments');
const modalEl = document.getElementById('esc-modal');
const modalPanelEl = document.getElementById('esc-modal-panel');
const intro = document.getElementById('esc-intro');

// the room's innerHTML is rebuilt on reset, so always query these fresh
const captionEl = () => roomEl.querySelector('#esc-caption');
const doorEl = () => roomEl.querySelector('#esc-door');
const doorLabelEl = () => roomEl.querySelector('#esc-door-label');

/* ---------------- Helpers ---------------- */

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function toRoman(num) {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let n = num;
  let out = '';
  for (const [value, numeral] of table) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out;
}

function atbash(word) {
  return word.replace(/[a-z]/gi, ch => {
    const base = ch === ch.toLowerCase() ? 97 : 65;
    return String.fromCharCode(base + (25 - (ch.charCodeAt(0) - base)));
  });
}

function scrambleWord(word) {
  if (word.length <= 2) return word;
  for (let attempt = 0; attempt < 10; attempt++) {
    const jumbled = shuffle(word.split('')).join('');
    if (jumbled.toLowerCase() !== word.toLowerCase()) return jumbled;
  }
  return word.split('').reverse().join('');
}

/* ---- Geography (the map puzzle measures every journey from Jerusalem) ---- */

const HOLY_CITY = { latitude: 31.7683, longitude: 35.2137 };
const KM_PER_PARASANG = 4.8;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rhumb-line (constant-compass) bearing: this matches the direction the pin
// appears in on a flat Mercator map, unlike the great-circle initial bearing.
function bearingDeg(a, b) {
  const dLng = toRad(b.longitude - a.longitude);
  const dPsi = Math.log(
    Math.tan(Math.PI / 4 + toRad(b.latitude) / 2) /
    Math.tan(Math.PI / 4 + toRad(a.latitude) / 2)
  );
  return (Math.atan2(dLng, dPsi) * 180 / Math.PI + 360) % 360;
}

const COMPASS_WINDS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function compassWind(bearing) {
  return COMPASS_WINDS[Math.round(bearing / 45) % 8];
}

function parasangs(km) {
  const p = km / KM_PER_PARASANG;
  if (p >= 100) return Math.round(p / 10) * 10;
  return Math.max(1, Math.round(p));
}

function hasCoords(c) {
  return c && c.latitude != null && c.longitude != null &&
    !isNaN(c.latitude) && !isNaN(c.longitude);
}

const BIO_PLACEHOLDERS = new Set(['nan', 'null', 'undefined', 'none', 'n/a', '-']);

function bioExcerpt(biography) {
  const text = String(biography ?? '').replace(/<[^>]*>/g, '').trim();
  if (!text || BIO_PLACEHOLDERS.has(text.toLowerCase()) || text.length < 12) return null;
  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* ---------------- Candle timer ---------------- */

function updateCandle() {
  const bar = document.getElementById('esc-candle-bar');
  const timeEl = document.getElementById('esc-time');

  bar.style.width = `${(timeLeft / TOTAL_TIME) * 100}%`;
  bar.classList.toggle('low', timeLeft <= 90);
  timeEl.textContent = formatTime(timeLeft);
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    timeLeft--;
    updateCandle();
    if (timeLeft <= 0) {
      stopTimer();
      failGame();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function loseTime(seconds) {
  timeLeft = Math.max(0, timeLeft - seconds);
  updateCandle();

  const hud = document.getElementById('esc-candle-hud');
  const float = document.createElement('span');
  float.className = 'esc-penalty-float';
  float.textContent = `−${formatTime(seconds)}`;
  hud.appendChild(float);
  setTimeout(() => float.remove(), 1400);

  if (timeLeft <= 0) {
    stopTimer();
    failGame();
  }
  return timeLeft > 0;
}

/* ---------------- Ledger & keys ---------------- */

function addFragment(text) {
  const empty = fragmentsEl.querySelector('.esc-fragment-empty');
  if (empty) empty.remove();

  const frag = document.createElement('span');
  frag.className = 'esc-fragment';
  frag.textContent = text;
  fragmentsEl.appendChild(frag);
}

function keysWon() {
  return Object.values(solved).filter(Boolean).length;
}

function markSolved(objKey, fragment, caption) {
  solved[objKey] = true;
  addFragment(fragment);

  const objBtn = roomEl.querySelector(`.esc-obj[data-obj="${objKey}"]`);
  if (objBtn) {
    objBtn.classList.add('solved');
    objBtn.disabled = true;
  }

  const slot = document.querySelector(`.esc-key-slot[data-key="${objKey}"]`);
  if (slot) slot.classList.add('won');

  const lock = document.querySelector(`.esc-lock[data-lock="${objKey}"]`);
  if (lock) {
    lock.classList.add('open');
    lock.textContent = '🔓';
  }

  if (keysWon() === 4) {
    doorEl().classList.add('unlocked');
    doorLabelEl().textContent = 'The locks are open — name the master!';
    captionEl().textContent = 'Four keys turn, one after another. Only the master’s name still bars the way.';
  } else {
    captionEl().textContent = caption;
  }
}

/* ---------------- Modal plumbing ---------------- */

let modalMap = null; // live mapboxgl instance inside the puzzle modal, if any

function openModal() {
  modalEl.classList.add('open');
}

function closeModal() {
  if (modalMap) {
    try { modalMap.remove(); } catch (e) { /* already gone */ }
    modalMap = null;
  }
  modalEl.classList.remove('open');
  modalPanelEl.classList.remove('esc-wide');
  modalPanelEl.innerHTML = '';
}

/**
 * Build the shared modal shell.
 * parts: { title, bodyHtml, hint: {prompt, reveal}, showBack }
 * Returns the body element so puzzles can append their controls.
 */
function renderModalShell({ title, bodyHtml, hint, showBack = true }) {
  modalPanelEl.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'esc-modal-title';
  titleEl.textContent = title;
  modalPanelEl.appendChild(titleEl);

  const body = document.createElement('div');
  body.className = 'esc-modal-body';
  body.innerHTML = bodyHtml;
  modalPanelEl.appendChild(body);

  const controls = document.createElement('div');
  modalPanelEl.appendChild(controls);

  const feedback = document.createElement('div');
  feedback.className = 'esc-feedback';
  modalPanelEl.appendChild(feedback);

  const actions = document.createElement('div');
  actions.className = 'esc-modal-actions';
  modalPanelEl.appendChild(actions);

  if (hint) {
    const hintBtn = document.createElement('button');
    hintBtn.className = 'esc-hint';
    hintBtn.textContent = `${hint.prompt} (−0:30)`;
    hintBtn.addEventListener('click', () => {
      if (!loseTime(HINT_PENALTY)) return;
      feedback.innerHTML = `<em>${hint.reveal}</em>`;
      hintBtn.remove();
    });
    actions.appendChild(hintBtn);
  }

  if (showBack) {
    const back = document.createElement('button');
    back.className = 'esc-back';
    back.textContent = 'Step back into the room';
    back.addEventListener('click', closeModal);
    actions.appendChild(back);
  }

  openModal();
  return { controls, feedback };
}

function wrongAnswer(el, feedback, message) {
  mistakes++;
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 450);
  if (!loseTime(WRONG_PENALTY)) return;
  feedback.innerHTML = `${message} <em>(The candle gutters… ${formatTime(timeLeft)} of light remains.)</em>`;
}

function solvedAnswer(feedback, message, objKey, fragment, caption) {
  feedback.innerHTML = `<strong>${message}</strong>`;
  markSolved(objKey, fragment, caption);
  setTimeout(closeModal, 1600);
}

/* ---------------- Puzzle: the writing desk (anagram) ---------------- */

function letterTiles(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const wrap = document.createElement('div');
  wrap.className = 'esc-tiles';

  words.forEach(word => {
    const group = document.createElement('span');
    group.className = 'esc-tile-word';
    word.split('').forEach(ch => {
      const tile = document.createElement('span');
      tile.className = 'esc-tile';
      tile.textContent = ch.toUpperCase();
      group.appendChild(tile);
    });
    wrap.appendChild(group);
  });

  return wrap;
}

function puzzleDesk() {
  const scrambled = targetWork
    .split(/\s+/)
    .filter(Boolean)
    .map(scrambleWord)
    .join(' ');

  const usedTitles = new Set([targetWork.toLowerCase()]);
  const decoys = [];
  for (const book of shuffle(pool.flatMap(s => s.books))) {
    if (decoys.length >= 3) break;
    if (usedTitles.has(book.toLowerCase())) continue;
    usedTitles.add(book.toLowerCase());
    decoys.push(book);
  }

  const options = shuffle([targetWork, ...decoys]);
  const firstWord = targetWork.split(/\s+/)[0];

  const { controls, feedback } = renderModalShell({
    title: '🖋️ The Writing Desk',
    bodyHtml: `An unfinished letter lies on the desk: <em>“…to the honored author of…”</em> —
      but the title has been cut into pieces and scattered across the blotter.
      Rearrange the letter-tiles of each word to find <strong>which work the master wrote</strong>:`,
    hint: {
      prompt: '🕯 Tilt the page toward the candle',
      reveal: `Faint impressions of the quill remain… the first word of the title is <strong>“${firstWord}”</strong>.`
    }
  });

  controls.appendChild(letterTiles(scrambled));

  const list = document.createElement('div');
  list.className = 'esc-choices';
  options.forEach(title => {
    const btn = document.createElement('button');
    btn.className = 'esc-choice';
    btn.innerHTML = `<span class="esc-choice-lead">❝</span><span></span>`;
    btn.querySelector('span:last-child').textContent = title;
    btn.addEventListener('click', () => {
      if (gameOver) return;
      if (title === targetWork) {
        solvedAnswer(
          feedback,
          'The tiles slide into place — and a drawer clicks open. A brass key!',
          'desk',
          `📜 wrote ${targetWork}`,
          'The desk stands open. Three more keys wait in the dark.'
        );
      } else {
        btn.classList.add('disabled');
        wrongAnswer(btn, feedback, 'The tiles refuse that order.');
      }
    });
    list.appendChild(btn);
  });
  controls.appendChild(list);
}

/* ---------------- Puzzle: the stopped clock (Roman numerals) ---------------- */

function puzzleClock() {
  const year = Number(target.passing);
  const isBCE = year < 0;
  const displayYear = Math.abs(year);
  const roman = toRoman(displayYear);

  const { controls, feedback } = renderModalShell({
    title: '🕰️ The Stopped Clock',
    bodyHtml: `The great clock stopped forever the year the master departed this world.
      Its face bears no digits — only the old Roman letters${isBCE ? ' (and a small moon marking the era <strong>before the common one</strong>)' : ''}:
      <div class="esc-roman">${roman}</div>
      Read the numerals and <strong>set the year</strong> to free the key from the clock case.`,
    hint: {
      prompt: '🔍 Study the engraved legend on the case',
      reveal: `A worn plate reads: <strong>M</strong>=1000 · <strong>D</strong>=500 · <strong>C</strong>=100 ·
        <strong>L</strong>=50 · <strong>X</strong>=10 · <strong>V</strong>=5 · <strong>I</strong>=1
        — a smaller letter before a larger one is subtracted.`
    }
  });

  const row = document.createElement('div');
  row.className = 'esc-answer-row';

  const input = document.createElement('input');
  input.className = 'esc-input';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = isBCE ? 'Year (BCE)' : 'Year';
  input.setAttribute('aria-label', 'Year the clock stopped');

  const submit = document.createElement('button');
  submit.className = 'btn-parchment';
  submit.textContent = 'Set the hands';

  const check = () => {
    if (gameOver) return;
    const guess = parseInt(input.value.trim(), 10);
    if (guess === displayYear) {
      solvedAnswer(
        feedback,
        'The hands spin to the hour — and the clock case springs open. A brass key!',
        'clock',
        `🕰 departed ${displayYear}${isBCE ? ' BCE' : ''}`,
        'The clock ticks once, as if in thanks, then falls silent again.'
      );
    } else {
      input.value = '';
      wrongAnswer(input, feedback, 'The hands grind and snap back.');
    }
  };

  submit.addEventListener('click', check);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') check();
  });

  row.appendChild(input);
  row.appendChild(submit);
  controls.appendChild(row);
  setTimeout(() => input.focus(), 50);
}

/* ---------------- Puzzle: the traveler's map ---------------- */

function buildCityDecoys({ needCoords }) {
  const usedNames = new Set([targetCity.city.toLowerCase()]);
  const usedCountries = new Set([targetCity.country.toLowerCase()]);
  const allCities = shuffle(pool.flatMap(s => s.cities));

  const targetWind = needCoords ? compassWind(bearingDeg(HOLY_CITY, targetCity)) : null;
  const targetDist = needCoords ? distanceKm(HOLY_CITY, targetCity) : 0;

  // A decoy is ambiguous if it sits in the same compass wind AND at a similar
  // distance from the Holy City — the riddle could not tell the two apart.
  const isAmbiguous = c => {
    if (!needCoords) return false;
    if (compassWind(bearingDeg(HOLY_CITY, c)) !== targetWind) return false;
    return Math.abs(distanceKm(HOLY_CITY, c) - targetDist) / Math.max(targetDist, 50) < 0.35;
  };

  const decoys = [];
  const take = c => {
    usedNames.add(c.city.toLowerCase());
    usedCountries.add(c.country.toLowerCase());
    decoys.push(c);
  };

  for (const c of allCities) {
    if (decoys.length >= 3) break;
    if (needCoords && !hasCoords(c)) continue;
    if (usedNames.has(c.city.toLowerCase())) continue;
    if (usedCountries.has(c.country.toLowerCase())) continue;
    if (isAmbiguous(c)) continue;
    take(c);
  }

  // relax the country constraint if the pool was too small
  for (const c of allCities) {
    if (decoys.length >= 3) break;
    if (needCoords && !hasCoords(c)) continue;
    if (usedNames.has(c.city.toLowerCase())) continue;
    if (isAmbiguous(c)) continue;
    take(c);
  }

  return decoys;
}

function mapHint() {
  return {
    prompt: '📜 Read the notes pinned to the map’s edge',
    reveal: `One note, in a student's hand: “I found him in <strong>${targetCity.country}</strong>,
      in a city whose name begins with <strong>“${targetCity.city[0].toUpperCase()}”</strong>.”`
  };
}

function solveMap(feedback) {
  solvedAnswer(
    feedback,
    'The pin lifts free — and a brass key swings on its thread!',
    'map',
    `🗺 dwelt in ${targetCity.city}`,
    'The map settles against the wall, its journeys at rest.'
  );
}

function puzzleMap() {
  // The real geographic puzzle needs coordinates; fall back to the
  // written-notes version if this city was never charted.
  if (!hasCoords(targetCity) || typeof mapboxgl === 'undefined') {
    puzzleMapFallback();
    return;
  }

  const decoys = buildCityDecoys({ needCoords: true });
  if (decoys.length < 3) {
    puzzleMapFallback();
    return;
  }

  const wind = compassWind(bearingDeg(HOLY_CITY, targetCity));
  const km = distanceKm(HOLY_CITY, targetCity);
  const farsakh = parasangs(km);

  const journeyLine = km < 60
    ? `The master's home lies <strong>in the very shadow of the Holy City</strong>, scarcely a day's walk from its gates.`
    : `From the Holy City, hold your compass true to the <strong>${wind}</strong> and ride
       some <strong>${farsakh} parasangs</strong>, and you will stand at the master's door.`;

  const { controls, feedback } = renderModalShell({
    title: '🗺️ The Traveler’s Map',
    bodyHtml: `A great chart hangs on the wall — seas, rivers and mountains, but
      <em>not a single name written on it</em>. A compass rose is inlaid in brass, its needle
      rooted in the <strong>Holy City</strong>, marked with a golden star ✦.
      Beside it, a student's travel note:
      <br><br><em>“${journeyLine}”</em><br><br>
      Four unmarked pins stand in the wax. <strong>Press the one over the master's city.</strong>`,
    hint: mapHint()
  });
  modalPanelEl.classList.add('esc-wide');

  const canvas = document.createElement('div');
  canvas.className = 'esc-map-canvas';
  controls.appendChild(canvas);

  const options = shuffle([targetCity, ...decoys]);

  modalMap = new mapboxgl.Map({
    container: canvas,
    style: 'mapbox://styles/mrosen770/cml3bh9as008l01sdeom31pcp',
    center: [HOLY_CITY.longitude, HOLY_CITY.latitude],
    zoom: 3,
    attributionControl: false,
    preserveDrawingBuffer: true
  });
  modalMap.dragRotate.disable();
  modalMap.touchZoomRotate.disableRotation();

  // A nameless map: strip every text/icon layer so geography is the only clue.
  modalMap.on('load', () => {
    try {
      modalMap.getStyle().layers
        .filter(layer => layer.type === 'symbol')
        .forEach(layer => modalMap.removeLayer(layer.id));
    } catch (e) {
      console.warn('Could not strip map labels:', e);
    }
  });

  // The compass anchor: the Holy City
  const anchorEl = document.createElement('div');
  anchorEl.className = 'esc-map-anchor';
  anchorEl.innerHTML = `<span class="esc-map-anchor-star">✦</span><span class="esc-map-anchor-label">The Holy City</span>`;
  new mapboxgl.Marker({ element: anchorEl, anchor: 'center' })
    .setLngLat([HOLY_CITY.longitude, HOLY_CITY.latitude])
    .addTo(modalMap);

  // The four wax pins
  options.forEach(c => {
    const pinEl = document.createElement('button');
    pinEl.className = 'esc-map-pin';
    pinEl.type = 'button';
    pinEl.setAttribute('aria-label', 'A wax pin on the chart');
    pinEl.textContent = '📍';

    pinEl.addEventListener('click', e => {
      e.stopPropagation();
      if (gameOver || pinEl.classList.contains('disabled')) return;

      if (c.city === targetCity.city && c.country === targetCity.country) {
        pinEl.classList.add('right');
        solveMap(feedback);
      } else {
        pinEl.classList.add('disabled');
        wrongAnswer(pinEl, feedback, 'You pry up the pin — bare parchment beneath. Not there.');
      }
    });

    new mapboxgl.Marker({ element: pinEl, anchor: 'bottom' })
      .setLngLat([c.longitude, c.latitude])
      .addTo(modalMap);
  });

  // Frame every pin and the Holy City
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([HOLY_CITY.longitude, HOLY_CITY.latitude]);
  options.forEach(c => bounds.extend([c.longitude, c.latitude]));
  modalMap.fitBounds(bounds, { padding: 70, maxZoom: 6, duration: 0 });

  setTimeout(() => { if (modalMap) modalMap.resize(); }, 80);
}

function puzzleMapFallback() {
  const decoys = buildCityDecoys({ needCoords: false });
  const options = shuffle([targetCity, ...decoys]);

  const { controls, feedback } = renderModalShell({
    title: '🗺️ The Traveler’s Map',
    bodyHtml: `A great map hangs on the wall, criss-crossed with the journeys of students who came
      seeking the master. Four cities are circled in fading ink — but the pin with the brass key
      hangs over only one: <strong>the city the master made his home</strong>.`,
    hint: mapHint()
  });

  const list = document.createElement('div');
  list.className = 'esc-choices';
  options.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'esc-choice';
    btn.innerHTML = `<span class="esc-choice-lead">📍</span><span></span>`;
    btn.querySelector('span:last-child').textContent = `${c.city}, ${c.country}`;
    btn.addEventListener('click', () => {
      if (gameOver) return;
      if (c.city === targetCity.city && c.country === targetCity.country) {
        solveMap(feedback);
      } else {
        btn.classList.add('disabled');
        wrongAnswer(btn, feedback, 'No road on this map ends there.');
      }
    });
    list.appendChild(btn);
  });
  controls.appendChild(list);
}

/* ---------------- Puzzle: the cipher chest (Atbash) ---------------- */

function buildCipher() {
  if (target.background) {
    return {
      word: target.background,
      fragment: `🏷 of the ${target.background} tradition`,
      intro: `Scholars say every study hall bears the crest of its tradition —
        <em>Sefarad, Ashkenaz, Provence, Chassidic, Litvish, Gaon, or Italian</em> —
        and this chest hides the master's own, written in the mirror-script.`
    };
  }

  const anyCity = target.cities[0];
  return {
    word: anyCity.country,
    fragment: `🏷 roots in ${anyCity.country}`,
    intro: `The chest hides the name of the <em>land</em> where the master's story unfolded,
      written in the mirror-script.`
  };
}

function puzzleChest() {
  const encoded = atbash(cipher.word);

  const half = 'ABCDEFGHIJKLM'.split('');
  const keyStrip =
    half.join(' ') + '\n' +
    half.map(ch => String.fromCharCode(65 + (25 - (ch.charCodeAt(0) - 65)))).join(' ');

  const { controls, feedback } = renderModalShell({
    title: '🧰 The Cipher Chest',
    bodyHtml: `A small iron chest, its lid engraved with the ancient <strong>mirror-script</strong>:
      the first letter of the alphabet trades places with the last, the second with the
      second-to-last, and so on. ${cipher.intro}`,
    hint: {
      prompt: '🕯 Rub the wax from the first letters',
      reveal: `Beneath the wax, someone has already decoded the first two:
        <strong>“${cipher.word.slice(0, 2)}…”</strong>`
    }
  });

  const key = document.createElement('div');
  key.className = 'esc-cipher-key';
  key.textContent = keyStrip;
  controls.appendChild(key);

  controls.appendChild(letterTiles(encoded));

  const row = document.createElement('div');
  row.className = 'esc-answer-row';

  const input = document.createElement('input');
  input.className = 'esc-input';
  input.type = 'text';
  input.placeholder = 'The decoded word';
  input.setAttribute('aria-label', 'Decoded word');

  const submit = document.createElement('button');
  submit.className = 'btn-parchment';
  submit.textContent = 'Speak the word';

  const check = () => {
    if (gameOver) return;
    if (normalize(input.value) === normalize(cipher.word)) {
      solvedAnswer(
        feedback,
        'The engraving glows — the lid creaks open on a brass key!',
        'chest',
        cipher.fragment,
        'The chest sits open, its secret spent.'
      );
    } else {
      input.classList.add('wrong');
      wrongAnswer(input, feedback, 'The lid does not stir.');
    }
  };

  submit.addEventListener('click', check);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') check();
  });

  row.appendChild(input);
  row.appendChild(submit);
  controls.appendChild(row);
  setTimeout(() => input.focus(), 50);
}

/* ---------------- The door ---------------- */

function buildSageDecoys() {
  // exclude the target and anyone who also wrote a work with the clue's title
  const candidates = pool.filter(s =>
    s.person !== target.person &&
    !s.books.some(b => b.trim().toLowerCase() === targetWork.trim().toLowerCase())
  );

  const scored = candidates.map(s => {
    let score = 0;
    if (s.background && s.background === target.background) score += 2;
    if (s.passing != null && target.passing != null && Math.abs(s.passing - target.passing) <= 150) score += 1;
    return { sage: s, score: score + Math.random() };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.sage);
}

function puzzleDoor() {
  if (keysWon() < 4) {
    renderModalShell({
      title: '🚪 The Study Door',
      bodyHtml: `You press your shoulder to the old oak — it does not move.
        Four small locks glint in the candlelight, and you hold
        <strong>${keysWon()} of the 4 keys</strong>.
        <br><br><em>The desk, the clock, the map, the chest… the room itself will tell you
        who the master is.</em>`
    });
    return;
  }

  const options = shuffle([target, ...buildSageDecoys()]);

  const { controls, feedback } = renderModalShell({
    title: '🚪 The Study Door',
    bodyHtml: `One by one, the four brass keys turn. Then a voice, dry as old parchment,
      speaks from the wood itself: <em>“This study opens for its master alone.
      You have read my desk, my clock, my map, my chest —</em>
      <strong>now say my name.</strong><em>”</em>`
  });

  const list = document.createElement('div');
  list.className = 'esc-choices';
  options.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'esc-choice';
    btn.innerHTML = `
      <img class="esc-portrait" src="${s.image}" alt="" loading="lazy"
        onerror="this.style.visibility='hidden'">
      <span></span>
    `;
    btn.querySelector('span:last-child').textContent = s.person;
    btn.addEventListener('click', () => {
      if (gameOver) return;
      finalGuesses++;
      const correct = s.person === target.person;

      if (gameId) {
        trackGuess(s.person, correct, finalGuesses, gameId)
          .catch(err => console.error('trackGuess failed:', err));
      }

      if (correct) {
        escapeStudy();
      } else {
        btn.classList.add('disabled');
        wrongAnswer(btn, feedback, 'The door does not know that name.');
      }
    });
    list.appendChild(btn);
  });
  controls.appendChild(list);
}

/* ---------------- Endings ---------------- */

function renderEnding({ stars, title, message, portrait }) {
  closeModal();
  stopTimer();
  gameOver = true;

  roomEl.innerHTML = '';
  const ending = document.createElement('div');
  ending.className = 'esc-ending';

  if (stars) {
    const starsEl = document.createElement('div');
    starsEl.className = 'esc-ending-stars';
    starsEl.textContent = stars;
    ending.appendChild(starsEl);
  }

  if (portrait) {
    const img = document.createElement('img');
    img.className = 'esc-ending-portrait';
    img.src = portrait;
    img.alt = target.person;
    img.onerror = () => { img.style.display = 'none'; };
    ending.appendChild(img);
  }

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  ending.appendChild(titleEl);

  const msg = document.createElement('p');
  msg.innerHTML = message;
  ending.appendChild(msg);

  const actions = document.createElement('div');
  actions.className = 'esc-ending-actions';

  const learn = document.createElement('button');
  learn.className = 'btn-parchment';
  learn.textContent = `Learn about ${target.person} 🔎`;
  learn.addEventListener('click', () => {
    const encodedSelected = encodeURIComponent(JSON.stringify({ person: target.person }));
    window.location.href = `discover.html?selected=${encodedSelected}`;
  });
  actions.appendChild(learn);

  const again = document.createElement('button');
  again.className = 'btn-parchment';
  again.textContent = 'Enter another study 🗝️';
  again.addEventListener('click', () => window.restartGame());
  actions.appendChild(again);

  ending.appendChild(actions);
  roomEl.appendChild(ending);
}

function escapeStudy() {
  const stars = timeLeft >= 360 ? '⭐⭐⭐' : timeLeft >= 180 ? '⭐⭐' : '⭐';
  const titleByStars = {
    '⭐⭐⭐': 'A legendary escape — the candle barely noticed you!',
    '⭐⭐': 'Escaped with honor!',
    '⭐': 'Escaped — by the last finger of wax!'
  };

  const excerpt = bioExcerpt(target.biography);
  const farewell = excerpt
    ? `As the door swings wide, the portrait above the desk seems to smile, and you remember what is told of him: “${excerpt}”`
    : `As the door swings wide, the candle flares once in farewell.`;

  try {
    new Audio('cheering.wav').play().catch(() => {});
  } catch (e) { /* sound is optional */ }

  if (gameId) {
    updateGameResult(gameId, true, mistakes)
      .catch(err => console.error('updateGameResult failed:', err));
  }

  renderEnding({
    stars,
    portrait: target.image,
    title: titleByStars[stars],
    message: `<strong>“${target.person},”</strong> you say — and every hinge in the room answers at once.
      This was indeed the study of <strong>${target.person}</strong>.
      You step into the night air with <strong>${formatTime(timeLeft)}</strong> of candle to spare.
      <br><br>${farewell}`
  });
}

function failGame() {
  if (gameOver) return;

  if (gameId) {
    updateGameResult(gameId, false, mistakes)
      .catch(err => console.error('updateGameResult failed:', err));
  }

  renderEnding({
    portrait: target.image,
    title: '🕯️ The Flame Dies…',
    message: `Darkness folds over the study, and the locks sleep until morning.
      When the shamash finds you at dawn, he laughs and tells you whose study you sat in all night:
      it was <strong>${target.person}</strong> — who wrote <strong>${targetWork}</strong>,
      dwelt in <strong>${targetCity ? targetCity.city : 'a distant city'}</strong>,
      and departed in <strong>${Math.abs(Number(target.passing))}${Number(target.passing) < 0 ? ' BCE' : ''}</strong>.
      <br><br>Study his life, and the next night will be shorter.`
  });
}

/* ---------------- Room reset & start ---------------- */

const ROOM_HTML = roomEl.innerHTML;

function resetRoom() {
  roomEl.innerHTML = ROOM_HTML;
  wireRoom();

  solved = { desk: false, clock: false, map: false, chest: false };
  mistakes = 0;
  finalGuesses = 0;
  timeLeft = TOTAL_TIME;

  document.querySelectorAll('.esc-key-slot').forEach(el => el.classList.remove('won'));

  fragmentsEl.innerHTML =
    '<span class="esc-fragment-empty">You know nothing yet… search the room for clues.</span>';

  updateCandle();
}

function wireRoom() {
  const puzzles = {
    desk: puzzleDesk,
    clock: puzzleClock,
    map: puzzleMap,
    chest: puzzleChest
  };

  roomEl.querySelectorAll('.esc-obj').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameOver) return;
      const key = btn.dataset.obj;
      if (solved[key]) return;
      puzzles[key]();
    });
  });

  const door = roomEl.querySelector('.esc-door');
  if (door) {
    door.addEventListener('click', () => {
      if (gameOver) return;
      puzzleDoor();
    });
  }
}

async function startGame(level) {
  const maxDifficulty = DIFFICULTY_SCALE[level] ?? 3;

  intro.style.display = 'none';

  try {
    pool = await loadSealedLetterSages(maxDifficulty);
  } catch (err) {
    console.error('Failed to load sages:', err);
    showCustomAlert(
      'The study’s shelves are bare at this difficulty — please try another level or check your connection.',
      '2.6vmin', false, false
    );
    intro.style.display = 'flex';
    return;
  }

  target = pickRandom(pool);
  targetWork = pickRandom(target.books);

  // prefer a dwelling with coordinates so the map puzzle can be truly geographic
  const chartedCities = target.cities.filter(hasCoords);
  targetCity = pickRandom(chartedCities.length ? chartedCities : target.cities);
  cipher = buildCipher();
  gameOver = false;

  resetRoom();
  startTimer();

  gameId = await trackGameStart(target.person, maxDifficulty) || null;
}

/* ---------------- Wiring ---------------- */

window.restartGame = function () {
  gameOver = true;
  gameId = null;
  stopTimer();
  closeModal();
  document.getElementById('customAlert').style.display = 'none';
  resetRoom();
  intro.style.display = 'flex';
};

// clicking the dim backdrop steps back into the room
modalEl.addEventListener('click', e => {
  if (e.target === modalEl) closeModal();
});

document.getElementById('esc-easy').addEventListener('click', () => startGame('Easy'));
document.getElementById('esc-medium').addEventListener('click', () => startGame('Medium'));
document.getElementById('esc-hard').addEventListener('click', () => startGame('Hard'));
document.getElementById('restart-button-main').addEventListener('click', () => window.restartGame());

wireRoom();

trackPageView().catch(err => console.error('trackPageView failed:', err));
