import { loadMasterWorksSages } from './supabase/get_master_works_sages.js';
import {
  trackPageView,
  trackGameStart,
  updateGameResult,
  trackGuess
} from './supabase/supabaseFunctions.js';

const ROUNDS = 3;
const PAIRS_PER_ROUND = 4;
const TOTAL_PAIRS = ROUNDS * PAIRS_PER_ROUND;
const TWO_STAR_MISTAKES = 3; // up to this many mistakes still earns two stars

const DIFFICULTY_SCALE = {
  'Easy': 2,
  'Medium': 3,
  'Hard': 5
};

let allSages = [];
let rounds = [];
let currentRound = 0;
let matched = 0;
let mistakes = 0;
let attempts = 0;
let gameId = null;
let gameOver = false;
let difficultyLevel = 'Medium';

let selectedSageCard = null;
let selectedWorkCard = null;

const board = document.getElementById('mw-board');
const sageCol = document.getElementById('mw-sage-col');
const workCol = document.getElementById('mw-work-col');
const roundLabel = document.getElementById('mw-round-label');
const matchedLabel = document.getElementById('mw-matched');
const mistakesLabel = document.getElementById('mw-mistakes');
const intro = document.getElementById('mw-intro');

/* ---------------- Helpers ---------------- */

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build rounds of unambiguous pairs: within a round, no chosen work
 * may also belong to another sage on the board.
 */
function buildRounds(pool) {
  const shuffledPool = shuffle(pool);
  const builtRounds = [];
  const usedPeople = new Set();
  const usedTitles = new Set();

  for (let r = 0; r < ROUNDS; r++) {
    const pairs = [];

    for (const sage of shuffledPool) {
      if (pairs.length === PAIRS_PER_ROUND) break;
      if (usedPeople.has(sage.person)) continue;

      const sameName = (title, person) =>
        title.trim().toLowerCase() === (person || '').trim().toLowerCase();

      const work = shuffle(sage.books).find(title =>
        !usedTitles.has(title) &&
        !sameName(title, sage.person) &&                  // no giveaway: sage called by his work
        !pairs.some(p => sameName(title, p.sage.person)) &&
        !pairs.some(p => p.sage.books.includes(title)) && // no boardmate owns it too
        !pairs.some(p => sage.books.includes(p.work))     // this sage doesn't own a placed work
      );

      if (!work) continue;

      pairs.push({ sage, work });
      usedPeople.add(sage.person);
      usedTitles.add(work);
    }

    if (pairs.length === PAIRS_PER_ROUND) {
      builtRounds.push(pairs);
    }
  }

  return builtRounds;
}

/* ---------------- Rendering ---------------- */

function renderRound() {
  const pairs = rounds[currentRound];

  roundLabel.textContent = `Round ${currentRound + 1} of ${rounds.length}`;
  sageCol.innerHTML = '';
  workCol.innerHTML = '';
  selectedSageCard = null;
  selectedWorkCard = null;

  shuffle(pairs).forEach(pair => {
    const card = document.createElement('button');
    card.className = 'mw-card mw-sage';
    card.dataset.person = pair.sage.person;
    card.innerHTML = `
      <img class="mw-portrait" src="${pair.sage.image}" alt="" loading="lazy"
        onerror="this.style.visibility='hidden'">
      <span class="mw-sage-name"></span>
    `;
    card.querySelector('.mw-sage-name').textContent = pair.sage.person;
    card.addEventListener('click', () => selectCard(card, 'sage'));
    sageCol.appendChild(card);
  });

  shuffle(pairs).forEach(pair => {
    const card = document.createElement('button');
    card.className = 'mw-card mw-work';
    card.dataset.person = pair.sage.person;
    card.innerHTML = `
      <span class="mw-work-icon">📜</span>
      <span class="mw-work-title"></span>
    `;
    card.querySelector('.mw-work-title').textContent = pair.work;
    card.addEventListener('click', () => selectCard(card, 'work'));
    workCol.appendChild(card);
  });

  board.classList.remove('mw-round-enter');
  void board.offsetWidth; // restart the entrance animation
  board.classList.add('mw-round-enter');
}

function updateHud() {
  matchedLabel.textContent = matched;
  mistakesLabel.textContent = mistakes;
}

/* ---------------- Game flow ---------------- */

function selectCard(card, type) {
  if (gameOver || card.classList.contains('locked')) return;

  if (type === 'sage') {
    if (selectedSageCard) selectedSageCard.classList.remove('selected');
    selectedSageCard = (selectedSageCard === card) ? null : card;
    if (selectedSageCard) selectedSageCard.classList.add('selected');
  } else {
    if (selectedWorkCard) selectedWorkCard.classList.remove('selected');
    selectedWorkCard = (selectedWorkCard === card) ? null : card;
    if (selectedWorkCard) selectedWorkCard.classList.add('selected');
  }

  if (selectedSageCard && selectedWorkCard) {
    evaluateMatch(selectedSageCard, selectedWorkCard);
  }
}

async function evaluateMatch(sageCard, workCard) {
  attempts++;
  const correct = sageCard.dataset.person === workCard.dataset.person;

  selectedSageCard = null;
  selectedWorkCard = null;

  if (gameId) {
    trackGuess(sageCard.dataset.person, correct, attempts, gameId)
      .catch(err => console.error('trackGuess failed:', err));
  }

  if (correct) {
    matched++;
    [sageCard, workCard].forEach(card => {
      card.classList.remove('selected', 'wrong');
      card.classList.add('locked');
    });
    updateHud();

    const roundDone = rounds[currentRound]
      .every(pair => sageCol.querySelector(`[data-person="${CSS.escape(pair.sage.person)}"].locked`));

    if (roundDone) {
      if (currentRound + 1 < rounds.length) {
        currentRound++;
        setTimeout(renderRound, 700);
      } else {
        setTimeout(finishGame, 700);
      }
    }
  } else {
    mistakes++;
    updateHud();
    [sageCard, workCard].forEach(card => {
      card.classList.remove('selected');
      card.classList.add('wrong');
      setTimeout(() => card.classList.remove('wrong'), 450);
    });
  }
}

function starRating() {
  if (mistakes === 0) return 3;
  if (mistakes <= TWO_STAR_MISTAKES) return 2;
  return 1;
}

async function finishGame() {
  gameOver = true;

  const stars = starRating();
  const starText = '⭐'.repeat(stars);
  const titles = { 3: 'Illuminator — a flawless manuscript!', 2: 'Master Scribe — beautifully done!', 1: 'Apprentice — the library is restored!' };

  try {
    new Audio('cheering.wav').play().catch(() => {});
  } catch (e) { /* sound is optional */ }

  if (gameId) {
    updateGameResult(gameId, stars >= 2, attempts)
      .catch(err => console.error('updateGameResult failed:', err));
  }

  showCustomAlert(
    `<strong style="font-size:1.3em;">${starText}</strong><br><br>
     ${titles[stars]}<br><br>
     You matched all ${TOTAL_PAIRS} works with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`,
    '2.6vmin',
    true,
    true
  );
}

async function startGame(level) {
  difficultyLevel = level;
  const maxDifficulty = DIFFICULTY_SCALE[level] ?? 3;

  intro.style.display = 'none';

  try {
    allSages = await loadMasterWorksSages(maxDifficulty);
  } catch (err) {
    console.error('Failed to load sages:', err);
    showCustomAlert(
      'The library shelves are empty at this difficulty — please try another level or check your connection.',
      '2.6vmin', false, false
    );
    intro.style.display = 'flex';
    return;
  }

  rounds = buildRounds(allSages);

  if (rounds.length < 1) {
    showCustomAlert(
      'Not enough unambiguous sage–work pairs could be built. Please try another difficulty.',
      '2.6vmin', false, false
    );
    intro.style.display = 'flex';
    return;
  }

  currentRound = 0;
  matched = 0;
  mistakes = 0;
  attempts = 0;
  gameOver = false;
  updateHud();
  renderRound();

  gameId = await trackGameStart('Master Works', DIFFICULTY_SCALE[level] ?? 3) || null;
}

/* ---------------- Wiring ---------------- */

window.restartGame = function () {
  gameOver = true;
  gameId = null;
  document.getElementById('customAlert').style.display = 'none';
  intro.style.display = 'flex';
};

document.getElementById('mw-easy').addEventListener('click', () => startGame('Easy'));
document.getElementById('mw-medium').addEventListener('click', () => startGame('Medium'));
document.getElementById('mw-hard').addEventListener('click', () => startGame('Hard'));
document.getElementById('restart-button-main').addEventListener('click', () => window.restartGame());

trackPageView().catch(err => console.error('trackPageView failed:', err));
