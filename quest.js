import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';

trackPageView("quest");

/* =========================================================
   DATA
   ========================================================= */

const data = {
  sages: [],          // {person, birth, passing, background, birthday, yahrtzeit}
  books: [],          // {person, book}
  dwellings: [],      // {person, city, from_year, to_year, number}
  cities: [],         // {city, country}
  teacher: [],        // {teacher, student}
  sageAka: [],        // {person, aka}
  cityAka: []         // {city, aka}
};

// lookups built after load
let personSet = new Set();          // normalized person names
let personSearch = [];              // {value, terms:[...normalized]}
let citySearch = [];                // {value, terms:[...normalized]}
let cityToCountry = new Map();
let backgrounds = [];

async function loadAll() {
  const tables = {
    sages: supabaseClient.from('sage')
      .select('person,birth,passing,background,birthday,yahrtzeit'),
    books: supabaseClient.from('book').select('person,book'),
    dwellings: supabaseClient.from('dwelling').select('person,city,from_year,to_year,number'),
    cities: supabaseClient.from('city').select('city,country'),
    teacher: supabaseClient.from('teacher').select('teacher,student'),
    sageAka: supabaseClient.from('sage_aka').select('person,aka'),
    cityAka: supabaseClient.from('city_aka').select('city,aka')
  };

  const entries = Object.entries(tables);
  const results = await Promise.all(entries.map(([, q]) => q));

  entries.forEach(([key], i) => {
    const { data: rows, error } = results[i];
    if (error) {
      console.error(`Failed to load ${key}:`, error);
      data[key] = [];
    } else {
      data[key] = rows || [];
    }
  });

  buildLookups();
}

function norm(s) {
  return String(s ?? '').trim().toLowerCase();
}

// Reject import-artifact / placeholder values so they never become questions.
const JUNK = new Set(['', 'not found', 'nan', 'null', 'undefined', 'n/a', '-', '0', 'unknown']);
function isUsable(value) {
  return value != null && !JUNK.has(norm(value));
}

function buildLookups() {
  // person search index (name + akas)
  const akasByPerson = new Map();
  for (const r of data.sageAka) {
    if (!r.person || !r.aka) continue;
    if (!akasByPerson.has(r.person)) akasByPerson.set(r.person, []);
    akasByPerson.get(r.person).push(r.aka);
  }

  personSet = new Set(data.sages.map(s => norm(s.person)));
  personSearch = data.sages
    .filter(s => s.person)
    .map(s => ({
      value: s.person,
      terms: [norm(s.person), ...(akasByPerson.get(s.person) || []).map(norm)]
    }));

  // city search index (name + akas)
  const akasByCity = new Map();
  for (const r of data.cityAka) {
    if (!r.city || !r.aka) continue;
    if (!akasByCity.has(r.city)) akasByCity.set(r.city, []);
    akasByCity.get(r.city).push(r.aka);
  }

  cityToCountry = new Map();
  citySearch = data.cities
    .filter(c => c.city)
    .map(c => {
      cityToCountry.set(c.city, c.country);
      return {
        value: c.city,
        terms: [norm(c.city), ...(akasByCity.get(c.city) || []).map(norm)]
      };
    });

  backgrounds = [...new Set(data.sages.map(s => s.background).filter(Boolean))];
}

/* =========================================================
   GENERATION HELPERS
   ========================================================= */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const hasLife = s => s.birth != null && s.passing != null && s.passing >= s.birth;

function aliveIn(year) {
  return data.sages
    .filter(s => hasLife(s) && s.birth <= year && s.passing >= year)
    .map(s => s.person);
}

function personSetValidator(persons) {
  const set = new Set(persons.map(norm));
  return value => set.has(norm(value));
}

function exampleList(persons, n = 3) {
  const uniq = [...new Set(persons)];
  return shuffle(uniq).slice(0, n).join(', ');
}

/* =========================================================
   PER-QUESTION-TYPE GENERATORS
   Each returns { f1, f2, answerType, validate, reveal } or null.
   ========================================================= */

const generators = {
  // 1: Name a sage who was living in the year {Year}.
  1() {
    const pool = data.sages.filter(hasLife);
    if (!pool.length) return null;
    const s = pick(pool);
    const year = randInt(s.birth, s.passing);
    const persons = aliveIn(year);
    if (!persons.length) return null;
    return { f1: year, answerType: 'Person', validate: personSetValidator(persons),
      reveal: `e.g., ${exampleList(persons)}` };
  },

  // 2: Who wrote {Book}?
  2() {
    const pool = data.books.filter(b => isUsable(b.book) && b.person);
    if (!pool.length) return null;
    const b = pick(pool);
    const persons = data.books.filter(x => norm(x.book) === norm(b.book)).map(x => x.person);
    return { f1: b.book, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 3: Name a sage who was born in the year {Year}.
  3() {
    const pool = data.sages.filter(s => s.birth != null);
    if (!pool.length) return null;
    const s = pick(pool);
    const persons = data.sages.filter(x => x.birth === s.birth).map(x => x.person);
    return { f1: s.birth, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 4: Who was born on {Date}?
  4() {
    const pool = data.sages.filter(s => isUsable(s.birthday));
    if (!pool.length) return null;
    const s = pick(pool);
    const persons = data.sages.filter(x => norm(x.birthday) === norm(s.birthday)).map(x => x.person);
    return { f1: s.birthday, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 5: Who passed away in the year {Year}?
  5() {
    const pool = data.sages.filter(s => s.passing != null);
    if (!pool.length) return null;
    const s = pick(pool);
    const persons = data.sages.filter(x => x.passing === s.passing).map(x => x.person);
    return { f1: s.passing, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 6: Who passed away on {Date}?
  6() {
    const pool = data.sages.filter(s => isUsable(s.yahrtzeit));
    if (!pool.length) return null;
    const s = pick(pool);
    const persons = data.sages.filter(x => norm(x.yahrtzeit) === norm(s.yahrtzeit)).map(x => x.person);
    return { f1: s.yahrtzeit, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 7: Who was a student of {Person}?
  7() {
    const teachers = data.teacher.filter(t => isUsable(t.teacher) && isUsable(t.student));
    if (!teachers.length) return null;
    const t = pick(teachers);
    const students = data.teacher.filter(x => norm(x.teacher) === norm(t.teacher) && isUsable(x.student)).map(x => x.student);
    if (!students.length) return null;
    return { f1: t.teacher, answerType: 'Person', validate: personSetValidator(students),
      reveal: exampleList(students) };
  },

  // 8: Who was a teacher of {Person}?
  8() {
    const rels = data.teacher.filter(t => isUsable(t.teacher) && isUsable(t.student));
    if (!rels.length) return null;
    const t = pick(rels);
    const teachers = data.teacher.filter(x => norm(x.student) === norm(t.student) && isUsable(x.teacher)).map(x => x.teacher);
    if (!teachers.length) return null;
    return { f1: t.student, answerType: 'Person', validate: personSetValidator(teachers),
      reveal: exampleList(teachers) };
  },

  // 9: Who lived in {Country}?
  9() {
    const withCountry = data.dwellings
      .filter(d => d.person && isUsable(d.city) && isUsable(cityToCountry.get(d.city)));
    if (!withCountry.length) return null;
    const country = cityToCountry.get(pick(withCountry).city);
    const persons = withCountry
      .filter(d => cityToCountry.get(d.city) === country)
      .map(d => d.person);
    return { f1: country, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 10: Who lived in {City}?
  10() {
    const pool = data.dwellings.filter(d => d.person && isUsable(d.city));
    if (!pool.length) return null;
    const city = pick(pool).city;
    const persons = pool.filter(d => norm(d.city) === norm(city)).map(d => d.person);
    return { f1: city, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 11: In what year was {Person} born?
  11() {
    const pool = data.sages.filter(s => s.birth != null);
    if (!pool.length) return null;
    const s = pick(pool);
    return { f1: s.person, answerType: 'Year',
      validate: v => Number(v) === Number(s.birth), reveal: String(s.birth) };
  },

  // 12: In what year did {Person} pass away?
  12() {
    const pool = data.sages.filter(s => s.passing != null);
    if (!pool.length) return null;
    const s = pick(pool);
    return { f1: s.person, answerType: 'Year',
      validate: v => Number(v) === Number(s.passing), reveal: String(s.passing) };
  },

  // 13: Name a sage who lived in {City} in {Year}.
  13() {
    const pool = data.dwellings.filter(d => d.person && isUsable(d.city) && d.from_year != null && d.to_year != null && d.to_year >= d.from_year);
    if (!pool.length) return null;
    const d = pick(pool);
    const year = randInt(d.from_year, d.to_year);
    const persons = pool
      .filter(x => norm(x.city) === norm(d.city) && x.from_year <= year && x.to_year >= year)
      .map(x => x.person);
    if (!persons.length) return null;
    return { f1: d.city, f2: year, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 14: Name a {Background} sage who was alive in the year {Year}.
  14() {
    const pool = data.sages.filter(s => s.background && hasLife(s));
    if (!pool.length) return null;
    const s = pick(pool);
    const year = randInt(s.birth, s.passing);
    const persons = data.sages
      .filter(x => x.background === s.background && hasLife(x) && x.birth <= year && x.passing >= year)
      .map(x => x.person);
    if (!persons.length) return null;
    return { f1: s.background, f2: year, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  },

  // 15: In which city was {Person} born?  (birth city = earliest recorded dwelling)
  15() {
    const byPerson = new Map();
    for (const d of data.dwellings) {
      if (!d.person || !isUsable(d.city) || d.from_year == null) continue;
      const cur = byPerson.get(d.person);
      if (!cur || d.from_year < cur.from_year) byPerson.set(d.person, d);
    }
    const candidates = [...byPerson.values()];
    if (!candidates.length) return null;
    const d = pick(candidates);
    const acceptCities = new Set([norm(d.city)]);
    // accept the city's akas too
    for (const a of data.cityAka) {
      if (norm(a.city) === norm(d.city) && a.aka) acceptCities.add(norm(a.aka));
    }
    return { f1: d.person, answerType: 'City',
      validate: v => acceptCities.has(norm(v)), reveal: d.city };
  },

  // 16: Name a {Background} sage who lived for {Duration} years or more.
  16() {
    const pool = data.sages.filter(s => s.background && hasLife(s));
    if (!pool.length) return null;
    const s = pick(pool);
    const lifespan = s.passing - s.birth;
    const duration = Math.max(10, Math.floor(lifespan / 10) * 10);
    const persons = data.sages
      .filter(x => x.background === s.background && hasLife(x) && (x.passing - x.birth) >= duration)
      .map(x => x.person);
    if (!persons.length) return null;
    return { f1: s.background, f2: duration, answerType: 'Person', validate: personSetValidator(persons),
      reveal: exampleList(persons) };
  }
};

/* =========================================================
   QUESTION TYPES (from question_type table)
   ========================================================= */

let questionTypes = [];

async function loadQuestionTypes() {
  const { data: rows, error } = await supabaseClient
    .from('question_type')
    .select('id,text,answer_type,field1,field2,time_limit,difficulty');
  if (error) throw error;
  questionTypes = rows || [];
}

function fillTemplate(text, f1, f2) {
  const filled = String(text)
    .replace(/\{field1\}/g, f1 ?? '')
    .replace(/\{field2\}/g, f2 ?? '');
  // fix "a Ashkenaz" -> "an Ashkenaz" once a vowel-starting field is dropped in
  return filled.replace(/\b([Aa]) ([aeiouAEIOU])/g, (m, a, v) => `${a}n ${v}`);
}

/**
 * Pick a random question type that can be generated from the data,
 * guaranteeing a non-empty answer set.
 */
function buildQuestion() {
  for (const qt of shuffle(questionTypes)) {
    const gen = generators[qt.id];
    if (!gen) continue;
    let built = null;
    try { built = gen(); } catch (e) { console.warn('generator error', qt.id, e); }
    if (!built) continue;

    return {
      id: qt.id,
      text: fillTemplate(qt.text, built.f1, built.f2),
      answerType: built.answerType,
      validate: built.validate,
      reveal: built.reveal,
      timeLimit: qt.time_limit || 60
    };
  }
  return null;
}

/* =========================================================
   UI
   ========================================================= */

const ROUND_DURATION = 180; // 3 minutes, persists across questions

const els = {
  card: document.getElementById('quest-container'),
  next: document.getElementById('next-btn'),
  timer: document.getElementById('round-timer'),
  score: document.getElementById('round-score')
};

let current = null;
let roundInterval = null;
let roundRemaining = ROUND_DURATION;
let score = 0;
let roundOver = false;
let locked = false;

function clearRoundTimer() {
  if (roundInterval) { clearInterval(roundInterval); roundInterval = null; }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateScore() {
  if (els.score) els.score.textContent = score;
}

function updateTimerDisplay() {
  if (els.timer) {
    els.timer.textContent = fmtTime(Math.max(0, roundRemaining));
    els.timer.parentElement?.classList.toggle('low', roundRemaining <= 30);
  }
}

function renderQuestion(q) {
  locked = false;

  const inputHtml = q.answerType === 'Year'
    ? `<select class="quest-select" id="quest-answer">
         <option value="">Select a year…</option>
         ${yearOptions()}
       </select>`
    : `<div class="quest-typeahead">
         <input type="text" class="search-input quest-input" id="quest-answer"
           autocomplete="off" placeholder="${q.answerType === 'City' ? 'Type a city…' : 'Type a sage…'}" />
         <ul class="search-results quest-results" id="quest-results"></ul>
       </div>`;

  els.card.innerHTML = `
    <div class="quest-card panel">
      <div class="quest-meta">
        <span class="quest-badge">${q.answerType === 'Year' ? 'Answer: a year' : q.answerType === 'City' ? 'Answer: a city' : 'Answer: a sage'}</span>
      </div>

      <div class="quest-text">${q.text}</div>

      <div class="quest-answer-row">
        ${inputHtml}
        <button class="cta-button sweep quest-check" id="quest-check" type="button">Check</button>
      </div>

      <div class="quest-feedback" id="quest-feedback"></div>
    </div>
  `;

  if (q.answerType === 'Year') {
    setupYearInput(q);
  } else {
    setupTypeahead(q, q.answerType === 'City' ? citySearch : personSearch);
  }

  document.getElementById('quest-check').addEventListener('click', () => submitAnswer(q));
}

function yearOptions() {
  let out = '';
  for (let y = 900; y <= 2000; y++) out += `<option value="${y}">${y}</option>`;
  return out;
}

/* ---------- round timer (persists across questions) ---------- */

function startRound() {
  clearRoundTimer();
  score = 0;
  roundRemaining = ROUND_DURATION;
  roundOver = false;
  updateScore();
  updateTimerDisplay();

  if (els.next) els.next.disabled = false;

  roundInterval = setInterval(() => {
    roundRemaining -= 1;
    updateTimerDisplay();
    if (roundRemaining <= 0) endRound();
  }, 1000);

  nextQuest();
}

function scoreTier(n) {
  if (n >= 12) return { title: 'Legendary Scholar!', stars: 5, blurb: 'The archives will remember this day.', celebrate: 'huge' };
  if (n >= 9)  return { title: 'Master of the Ages!', stars: 4, blurb: 'A truly masterful round.', celebrate: 'big' };
  if (n >= 6)  return { title: 'Well Done, Sage!', stars: 3, blurb: 'A sharp and learned showing.', celebrate: 'big' };
  if (n >= 3)  return { title: 'Nicely Played!', stars: 2, blurb: 'A solid round — keep climbing.', celebrate: 'small' };
  if (n >= 1)  return { title: "Time's Up!", stars: 1, blurb: 'A good start — try again for more.', celebrate: 'none' };
  return { title: "Time's Up!", stars: 0, blurb: 'No quests this round — give it another go!', celebrate: 'none' };
}

function endRound() {
  clearRoundTimer();
  roundOver = true;
  locked = true;
  updateTimerDisplay();

  if (els.next) els.next.disabled = true;

  const tier = scoreTier(score);
  const starsHtml = tier.stars > 0
    ? `<div class="quest-end-stars">${'★'.repeat(tier.stars)}${'☆'.repeat(5 - tier.stars)}</div>`
    : '';

  els.card.innerHTML = `
    <div class="quest-card panel quest-end ${tier.celebrate !== 'none' ? 'celebrate' : ''}">
      <div class="quest-end-title">${tier.title}</div>
      ${starsHtml}
      <div class="quest-end-score">You answered <strong>${score}</strong> ${score === 1 ? 'quest' : 'quests'} correctly.</div>
      <div class="quest-end-blurb">${tier.blurb}</div>
      <button class="cta-button sweep" id="play-again" type="button">Play Again</button>
    </div>
  `;
  document.getElementById('play-again')?.addEventListener('click', startRound);

  try { new Audio('cheering.wav').play().catch(() => {}); } catch (e) {}

  if (tier.celebrate === 'huge') launchConfetti(160);
  else if (tier.celebrate === 'big') launchConfetti(100);
  else if (tier.celebrate === 'small') launchConfetti(45);
}

/* ---------- confetti (no library) ---------- */

function launchConfetti(count) {
  const colors = ['#c99a3c', '#6a2f52', '#2f4f4f', '#8a3e6b', '#b58a4a', '#3f6868', '#f4cd73'];
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random() * 8;
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.width = size + 'px';
    piece.style.height = size * (0.5 + Math.random()) + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2.6 + Math.random() * 2.2) + 's';
    piece.style.animationDelay = (Math.random() * 0.6) + 's';
    piece.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
    piece.style.setProperty('--drift', (Math.random() * 24 - 12) + 'vw');
    layer.appendChild(piece);
  }

  setTimeout(() => layer.remove(), 6000);
}

/* ---------- typeahead ---------- */

let selectedValue = null;

function setupTypeahead(q, index) {
  selectedValue = null;
  const input = document.getElementById('quest-answer');
  const results = document.getElementById('quest-results');

  function matches(query) {
    const nq = norm(query);
    if (!nq) return [];
    const starts = [];
    const contains = [];
    for (const item of index) {
      if (item.terms.some(t => t.startsWith(nq))) starts.push(item);
      else if (item.terms.some(t => t.includes(nq))) contains.push(item);
    }
    return [...starts, ...contains].slice(0, 8);
  }

  function render(list) {
    results.innerHTML = list.map(it => `<li data-value="${it.value.replace(/"/g, '&quot;')}">${it.value}</li>`).join('');
    results.style.display = list.length ? 'block' : 'none';
  }

  input.addEventListener('input', () => {
    selectedValue = null;
    render(matches(input.value));
  });

  results.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    selectedValue = li.dataset.value;
    input.value = selectedValue;
    results.style.display = 'none';
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer(q);
    }
  });

  // expose a resolver for submit: explicit selection, else closest match
  q._resolve = () => {
    if (selectedValue) return selectedValue;
    const top = matches(input.value)[0];
    return top ? top.value : input.value.trim();
  };
}

function setupYearInput(q) {
  const select = document.getElementById('quest-answer');
  q._resolve = () => select.value;
  select.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(q); }
  });
}

/* ---------- submit ---------- */

function submitAnswer(q) {
  if (locked || roundOver) return;
  const feedback = document.getElementById('quest-feedback');
  const value = q._resolve ? q._resolve() : '';

  if (!value) {
    feedback.className = 'quest-feedback warn';
    feedback.textContent = 'Enter an answer first.';
    return;
  }

  if (q.validate(value)) {
    locked = true;
    score += 1;
    updateScore();
    feedback.className = 'quest-feedback correct';
    feedback.innerHTML = `✓ Correct! <span class="quest-solved">Next quest…</span>`;
    const check = document.getElementById('quest-check');
    if (check) check.disabled = true;
    const ans = document.getElementById('quest-answer');
    if (ans) ans.disabled = true;
    setTimeout(() => { if (!roundOver) nextQuest(); }, 900);
  } else {
    feedback.className = 'quest-feedback wrong';
    feedback.textContent = '✗ Not quite — try again.';
  }
}

function nextQuest() {
  if (roundOver) return;
  const q = buildQuestion();
  if (!q) {
    els.card.innerHTML = `<div class="quest-card panel"><div class="quest-text">No quests could be generated.</div></div>`;
    return;
  }
  current = q;
  renderQuestion(q);
}

/* =========================================================
   INIT
   ========================================================= */

async function init() {
  els.card.innerHTML = `<div class="quest-card panel"><div class="quest-text">Loading your quest…</div></div>`;
  try {
    await Promise.all([loadAll(), loadQuestionTypes()]);
    startRound();
  } catch (err) {
    console.error('Quest init failed:', err);
    els.card.innerHTML = `<div class="quest-card panel"><div class="quest-text">Couldn't load quests. Please refresh.</div></div>`;
  }
}

els.next?.addEventListener('click', nextQuest);

const infoBtn = document.getElementById('info-button');
infoBtn?.addEventListener('click', () => {
  if (typeof showCustomAlert === 'function') {
    showCustomAlert(
      `You have <strong>3 minutes</strong> to answer as many quests as you can!<br><br>Read each question and give your answer — for a sage or a city, start typing and pick from the suggestions; for a year, choose from the dropdown.<br><br>Every correct answer scores a point and moves you to the next quest. Skip a tricky one with "Next Quest". When the timer runs out, you'll see your final score.<br><br>Use the explorer links at the bottom to hunt down answers.`,
      '2.4vmin', false, false
    );
  }
});

init();
