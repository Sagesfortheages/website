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

let pool = [];
let target = null;
let targetCity = null;
let targetWork = null;
let seals = 3;
let mistakes = 0;
let finalGuesses = 0;
let stage = 0;
let gameId = null;
let gameOver = false;

const sceneEl = document.getElementById('sl-scene');
const fragmentsEl = document.getElementById('sl-fragments');
const intro = document.getElementById('sl-intro');

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

function eraLabel(year) {
  if (year == null || isNaN(year)) return 'an unknown age';
  if (year < 0) return `around ${Math.abs(year)} BCE`;
  const century = Math.floor(year / 100) * 100;
  return `the ${century}s`;
}

const BIO_PLACEHOLDERS = new Set(['nan', 'null', 'undefined', 'none', 'n/a', '-']);

function bioExcerpt(biography) {
  const text = String(biography ?? '').replace(/<[^>]*>/g, '').trim();

  // Reject empties, import artifacts ("NaN"), and anything too short to be a real sentence.
  if (!text || BIO_PLACEHOLDERS.has(text.toLowerCase()) || text.length < 12) return null;

  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* ---------------- HUD ---------------- */

function updateJourney() {
  document.querySelectorAll('.sl-journey-step').forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle('active', step === stage);
    el.classList.toggle('done', step < stage);
  });
}

function breakSeal() {
  mistakes++;
  if (seals > 0) {
    seals--;
    const sealEl = document.querySelector(`.sl-seal[data-seal="${seals}"]`);
    if (sealEl) {
      sealEl.classList.add('broken');
      sealEl.textContent = '✕';
    }
  }
}

function addFragment(text) {
  const empty = fragmentsEl.querySelector('.sl-fragment-empty');
  if (empty) empty.remove();

  const frag = document.createElement('span');
  frag.className = 'sl-fragment';
  frag.textContent = text;
  fragmentsEl.appendChild(frag);
}

function resetHud() {
  seals = 3;
  mistakes = 0;
  finalGuesses = 0;
  stage = 0;

  document.querySelectorAll('.sl-seal').forEach(el => {
    el.classList.remove('broken');
    el.textContent = '✦';
  });

  fragmentsEl.innerHTML =
    '<span class="sl-fragment-empty">The parchment is blank… question the locals to learn about the addressee.</span>';

  updateJourney();
}

/* ---------------- Scene rendering ---------------- */

function renderScene({ title, npcFace, npcName, speech, choices, hint, continueLabel, onContinue }) {
  sceneEl.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'sl-scene-title';
  titleEl.textContent = title;
  sceneEl.appendChild(titleEl);

  const npc = document.createElement('div');
  npc.className = 'sl-npc';
  npc.innerHTML = `
    <div class="sl-npc-face">${npcFace}</div>
    <div class="sl-speech">
      <span class="sl-npc-name"></span>
      <span class="sl-speech-text"></span>
    </div>
  `;
  npc.querySelector('.sl-npc-name').textContent = npcName;
  npc.querySelector('.sl-speech-text').innerHTML = speech;
  sceneEl.appendChild(npc);

  if (choices?.length) {
    const list = document.createElement('div');
    list.className = 'sl-choices';

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'sl-choice';

      if (choice.image) {
        btn.innerHTML = `
          <img class="sl-portrait" src="${choice.image}" alt="" loading="lazy"
            onerror="this.style.visibility='hidden'">
          <span class="sl-choice-text"></span>
        `;
      } else {
        btn.innerHTML = `
          <span class="sl-choice-lead">❝</span>
          <span class="sl-choice-text"></span>
        `;
      }

      btn.querySelector('.sl-choice-text').textContent = choice.label;
      btn.addEventListener('click', () => choice.onPick(btn));
      list.appendChild(btn);
    });

    sceneEl.appendChild(list);
  }

  if (hint) {
    const wrap = document.createElement('div');
    wrap.className = 'sl-continue';

    const btn = document.createElement('button');
    btn.className = 'sl-hint';
    btn.textContent = hint.prompt;
    btn.addEventListener('click', () => {
      const speechText = sceneEl.querySelector('.sl-speech-text');
      if (speechText) {
        speechText.innerHTML += `<br><br><em>${hint.reveal}</em>`;
      }
      btn.remove();
    });
    wrap.appendChild(btn);

    sceneEl.appendChild(wrap);
  }

  if (continueLabel) {
    const wrap = document.createElement('div');
    wrap.className = 'sl-continue';

    const btn = document.createElement('button');
    btn.className = 'btn-parchment';
    btn.textContent = continueLabel;
    btn.addEventListener('click', onContinue);
    wrap.appendChild(btn);

    sceneEl.appendChild(wrap);
  }

  sceneEl.style.animation = 'none';
  void sceneEl.offsetWidth;
  sceneEl.style.animation = '';
}

function updateSpeech(html) {
  const speech = sceneEl.querySelector('.sl-speech-text');
  if (speech) speech.innerHTML = html;
}

/* ---------------- Wrong-answer handling ---------------- */

function handleWrong(btn, npcRetort) {
  breakSeal();

  btn.classList.add('wrong');
  setTimeout(() => {
    btn.classList.remove('wrong');
    btn.classList.add('disabled');
  }, 450);

  if (seals <= 0) {
    setTimeout(failGame, 600);
    return false;
  }

  updateSpeech(`${npcRetort}<br><em>(A wax seal cracks… ${seals} remain${seals === 1 ? 's' : ''}.)</em>`);
  return true;
}

/* ---------------- Stages ---------------- */

function stageTavern() {
  stage = 0;
  updateJourney();

  const correctEra = eraLabel(target.passing);

  const eras = new Set([correctEra]);
  const otherYears = shuffle(pool.map(s => s.passing).filter(y => y != null));
  for (const y of otherYears) {
    if (eras.size >= 4) break;
    eras.add(eraLabel(y));
  }

  const options = shuffle([...eras]);

  renderScene({
    title: '🏮 The Wayside Inn',
    npcFace: '🧔',
    npcName: 'Feivel the Innkeeper',
    speech: `Shalom aleichem, courier! The name on your letter is torn away? A pity… but look,
      the greeting inside still calls its reader the author of <strong>${targetWork}</strong>!
      A famous book — though I never did learn the writer's name myself.
      <br><br>What I <em>have</em> heard, from travelers passing through, is the age he lived in.
      Tell me you know it too, and I'll send you on to the harbor —
      <strong>when did the author of ${targetWork} walk this earth?</strong>`,
    hint: {
      prompt: '🕯 Ask Feivel to check the old guest ledger',
      reveal: `Feivel blows the dust off a crumbling ledger and runs his finger down the page…
        “Here — travelers wrote that the author of that very book lived in
        <strong>${correctEra}</strong>.”`
    },
    choices: options.map(era => ({
      label: `He lived in ${era}.`,
      onPick: (btn) => {
        if (era === correctEra) {
          addFragment(`🕰 lived ${correctEra}`);
          updateSpeech(`That's it — a true courier knows whose words he carries! The ferryman at the
            harbor has rowed many scholars in his day. <em>Safe travels!</em>`);
          renderContinue('Walk to the harbor ⛵', stageHarbor);
        } else {
          handleWrong(btn, `Nay, nay — that cannot be. Think again, courier… or ask me to check the ledger!`);
        }
      }
    }))
  });
}

function stageHarbor() {
  stage = 1;
  updateJourney();

  targetCity = pickRandom(target.cities);

  const usedNames = new Set([targetCity.city.toLowerCase()]);
  const usedLetters = new Set([targetCity.city[0].toLowerCase()]);
  const usedCountries = new Set([targetCity.country.toLowerCase()]);

  const decoys = [];
  const allCities = shuffle(pool.flatMap(s => s.cities));

  for (const c of allCities) {
    if (decoys.length >= 3) break;
    const name = c.city.toLowerCase();
    if (usedNames.has(name)) continue;
    if (usedCountries.has(c.country.toLowerCase())) continue;
    if (usedLetters.has(name[0])) continue;
    usedNames.add(name);
    usedLetters.add(name[0]);
    usedCountries.add(c.country.toLowerCase());
    decoys.push(c);
  }

  // relax constraints if the pool was too small
  for (const c of allCities) {
    if (decoys.length >= 3) break;
    const name = c.city.toLowerCase();
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    decoys.push(c);
  }

  const options = shuffle([targetCity, ...decoys]);

  renderScene({
    title: '⛵ The Old Harbor',
    npcFace: '🧓',
    npcName: 'Zalman the Ferryman',
    speech: `The author of <strong>${targetWork}</strong>! Aye, every scholar knows that book —
      though I never learned the writer's name either. What I <em>do</em> know is the city
      he made his home; I've ferried many a young student there to study where he lived.
      <br><br>The river mists are thick, and I'll not row in circles —
      <strong>to which city shall I carry you?</strong>`,
    hint: {
      prompt: '📜 Show Zalman the torn letter',
      reveal: `Zalman squints at a faded postmark on the wrapping…
        “Ha! It was sent from a city in <strong>${targetCity.country}</strong> — and its name begins with
        <strong>“${targetCity.city[0].toUpperCase()}”</strong>, or I've never sailed a river in my life.”`
    },
    choices: options.map(c => ({
      label: `${c.city}, ${c.country}`,
      onPick: (btn) => {
        if (c.city === targetCity.city && c.country === targetCity.country) {
          addFragment(`🗺 dwelt in ${targetCity.city}`);
          updateSpeech(`Aboard, aboard! The wind favors us — to <strong>${targetCity.city}</strong> we go!
            Seek the bookseller by the square; nothing written escapes his shelves.`);
          renderContinue('Step ashore and find the bookshop 📚', stageBookshop);
        } else {
          handleWrong(btn, `That port? No scholar's trail leads there, friend. Think again — or show me that letter of yours!`);
        }
      }
    }))
  });
}

function stageBookshop() {
  stage = 2;
  updateJourney();

  const secondWork = target.books.find(b => b !== targetWork);

  const tidbits = [];
  if (target.background) {
    tidbits.push(`he is a luminary of the <strong>${target.background}</strong> tradition`);
    addFragment(`🏷 ${target.background}`);
  }
  if (secondWork) {
    tidbits.push(`his quill also gave the world <strong>${secondWork}</strong>`);
    addFragment(`📚 also wrote ${secondWork}`);
  }

  const gossip = tidbits.length
    ? `I never could tell you the author's name — but I know his pen well: ${tidbits.join(', and ')}.`
    : `Copies of <strong>${targetWork}</strong> pass through my stall faster than I can bind them!`;

  renderScene({
    title: '📚 The Bookseller’s Stall',
    npcFace: '👳',
    npcName: 'Gershon the Bookseller',
    speech: `Welcome, welcome! A letter for the author of <strong>${targetWork}</strong>?
      ${gossip}
      <br><br>You've learned <em>when</em> he lived and <em>where</em> he settled — take that to the
      study hall up the lane and you'll know the man by sight. Mind the shamash at the door;
      he suffers no fools!`,
    continueLabel: 'Hurry to the study hall 🚪',
    onContinue: stageDoor
  });
}

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

function stageDoor() {
  stage = 3;
  updateJourney();

  const options = shuffle([target, ...buildSageDecoys()]);

  renderScene({
    title: '🚪 The Study Hall Door',
    npcFace: '🤨',
    npcName: 'The Shamash',
    speech: `Hold, courier! Many great scholars sit within, and I'll not trouble them all for one letter.
      But you've learned much on the road — the age your sage lived in, the city he settled in,
      and the works of his pen. That is enough to know the man.
      <br><br><strong>Name him: to whom is the letter addressed?</strong>`,
    choices: options.map(s => ({
      label: s.person,
      image: s.image,
      onPick: (btn) => {
        finalGuesses++;
        const correct = s.person === target.person;

        if (gameId) {
          trackGuess(s.person, correct, finalGuesses, gameId)
            .catch(err => console.error('trackGuess failed:', err));
        }

        if (correct) {
          deliverLetter();
        } else {
          handleWrong(btn, `That scholar shook his head and returned to his learning. Think, courier — think!`);
        }
      }
    }))
  });
}

/* ---------------- Endings ---------------- */

function deliverLetter() {
  gameOver = true;

  const stars = '⭐'.repeat(Math.max(seals, 1));
  const titleBySeals = {
    3: 'A flawless delivery — the roads will sing of you!',
    2: 'Delivered with honor!',
    1: 'Delivered — by the last seal!'
  };

  const excerpt = bioExcerpt(target.biography);
  const reply = excerpt
    ? `“${excerpt}”`
    : `The sage smiles, breaks the seal, and blesses your journey.`;

  try {
    new Audio('cheering.wav').play().catch(() => {});
  } catch (e) { /* sound is optional */ }

  if (gameId) {
    updateGameResult(gameId, true, mistakes)
      .catch(err => console.error('updateGameResult failed:', err));
  }

  renderScene({
    title: '💌 The Letter Is Delivered!',
    npcFace: '🕯️',
    npcName: target.person,
    speech: `${stars}<br><strong>${titleBySeals[Math.max(seals, 1)]}</strong><br><br>
      The sage breaks the seal and reads. Then he looks up at you:<br><br>${reply}`,
    continueLabel: `Learn more about ${target.person} 🔎`,
    onContinue: () => {
      const encodedSelected = encodeURIComponent(JSON.stringify({ person: target.person }));
      window.location.href = `discover.html?selected=${encodedSelected}`;
    }
  });

  const wrap = document.createElement('div');
  wrap.className = 'sl-continue';
  const again = document.createElement('button');
  again.className = 'btn-parchment';
  again.textContent = 'Carry another letter 📯';
  again.addEventListener('click', () => window.restartGame());
  wrap.appendChild(again);
  sceneEl.appendChild(wrap);
}

function failGame() {
  gameOver = true;

  if (gameId) {
    updateGameResult(gameId, false, mistakes)
      .catch(err => console.error('updateGameResult failed:', err));
  }

  renderScene({
    title: '🕯️ The Last Seal Crumbles…',
    npcFace: '😔',
    npcName: 'The Courier (you)',
    speech: `Without a seal, no door will open for the letter. The journey ends here — but now you
      know the truth: it was addressed to <strong>${target.person}</strong>,
      who lived ${eraLabel(target.passing)}, dwelt in ${targetCity ? targetCity.city : 'a distant city'},
      and wrote <strong>${targetWork || target.books[0]}</strong>.
      <br><br>Study his life, and the next road will be kinder.`,
    continueLabel: `Learn about ${target.person} 🔎`,
    onContinue: () => {
      const encodedSelected = encodeURIComponent(JSON.stringify({ person: target.person }));
      window.location.href = `discover.html?selected=${encodedSelected}`;
    }
  });

  const wrap = document.createElement('div');
  wrap.className = 'sl-continue';
  const again = document.createElement('button');
  again.className = 'btn-parchment';
  again.textContent = 'Try another delivery 📯';
  again.addEventListener('click', () => window.restartGame());
  wrap.appendChild(again);
  sceneEl.appendChild(wrap);
}

function renderContinue(label, next) {
  const old = sceneEl.querySelector('.sl-choices');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.className = 'sl-continue';

  const btn = document.createElement('button');
  btn.className = 'btn-parchment';
  btn.textContent = label;
  btn.addEventListener('click', next);
  wrap.appendChild(btn);

  sceneEl.appendChild(wrap);
}

/* ---------------- Game start ---------------- */

async function startGame(level) {
  const maxDifficulty = DIFFICULTY_SCALE[level] ?? 3;

  intro.style.display = 'none';

  try {
    pool = await loadSealedLetterSages(maxDifficulty);
  } catch (err) {
    console.error('Failed to load sages:', err);
    showCustomAlert(
      'The roads are washed out at this difficulty — please try another level or check your connection.',
      '2.6vmin', false, false
    );
    intro.style.display = 'flex';
    return;
  }

  target = pickRandom(pool);
  targetCity = null;
  targetWork = pickRandom(target.books);
  gameOver = false;

  resetHud();
  addFragment(`📜 wrote ${targetWork}`);
  stageTavern();

  gameId = await trackGameStart(target.person, maxDifficulty) || null;
}

/* ---------------- Wiring ---------------- */

window.restartGame = function () {
  gameOver = true;
  gameId = null;
  document.getElementById('customAlert').style.display = 'none';
  sceneEl.innerHTML = '';
  resetHud();
  intro.style.display = 'flex';
};

document.getElementById('sl-easy').addEventListener('click', () => startGame('Easy'));
document.getElementById('sl-medium').addEventListener('click', () => startGame('Medium'));
document.getElementById('sl-hard').addEventListener('click', () => startGame('Hard'));
document.getElementById('restart-button-main').addEventListener('click', () => window.restartGame());

trackPageView().catch(err => console.error('trackPageView failed:', err));
