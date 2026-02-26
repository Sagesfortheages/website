import { trackPageView } from './supabase/supabaseFunctions.js';
import { supabaseClient } from './supabase/supabaseClient.js';

trackPageView("quest");

/* ===========================
   CONFIG
=========================== */

const QUEST_DURATION = 90; // seconds

// Storage keys (use IDs, not indexes)
const ACTIVE_KEY = "activeQuest";     // { questionId, expiresAt }
const USED_KEY   = "usedQuestIds";    // [questionId, ...]

// Loaded from DB
let QUESTIONS = [];

/* ===========================
   SUPABASE QUERY (yours)
=========================== */

export async function loadAllQuestions() {
  const { data, error } = await supabaseClient
    .from('question')
    .select(`
      id,
      field1,
      question_type (
        id,
        text,
        answer_type,
        field1
      )
    `);

  if (error) throw error;
  return data;
}

/* ===========================
   UTILITIES
=========================== */

function now() {
  return Math.floor(Date.now() / 1000);
}

function getUsedIds() {
  return JSON.parse(localStorage.getItem(USED_KEY) || "[]");
}

function setUsedIds(arr) {
  localStorage.setItem(USED_KEY, JSON.stringify(arr));
}

function saveActive(activeObj) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeObj));
}

function getActive() {
  return JSON.parse(localStorage.getItem(ACTIVE_KEY));
}

function clearActive() {
  localStorage.removeItem(ACTIVE_KEY);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ===========================
   QUEST TEXT BUILDER
   (Customize this!)
=========================== */

// Default: show question_type.text, and if question.field1 exists, append it.
function buildQuestText(q) {
  const template = (q?.question_type?.text ?? "").toString();
  const val = (q?.field1 ?? "").toString().trim();

  const filled = template.replace(/\{field1\}/g, val);

  if (filled === template && val) return `${template}: ${val}`;
  return filled || "Quest";
}

/* ===========================
   DISPLAY QUEST
=========================== */

let timerInterval = null;

function showQuestFromRecord(q, expiresAt) {
  const container = document.getElementById("quest-container");
  const text = buildQuestText(q);

  container.innerHTML = `
    <div class="quest-card">
      <div class="quest-text">${text}</div>
      <div class="timer" id="timer"></div>
    </div>
  `;

  startTimer(expiresAt);
}

function startTimer(expiresAt) {
  const timerEl = document.getElementById("timer");
  if (!timerEl) return;

  // Prevent multiple intervals stacking
  if (timerInterval) clearInterval(timerInterval);

  const tick = () => {
    const remaining = expiresAt - now();

    if (remaining <= 0) {
      timerEl.textContent = "Quest expired";
      clearActive();
      clearInterval(timerInterval);
      timerInterval = null;

      // Optional: clear the card when expired
      // document.getElementById("quest-container").innerHTML = "";
      return;
    }

    timerEl.textContent = formatTime(remaining);
  };

  tick();
  timerInterval = setInterval(tick, 250);
}

/* ===========================
   NEXT QUEST LOGIC
=========================== */

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nextQuest() {
  if (!QUESTIONS.length) {
    alert("No quests loaded yet.");
    return;
  }

  const usedIds = getUsedIds();

  // Remaining = questions whose id not in usedIds
  const remaining = QUESTIONS.filter(q => !usedIds.includes(q.id));

  if (remaining.length === 0) {
    alert("All quests completed!");
    return;
  }

  const chosen = pickRandom(remaining);
  const expiresAt = now() + QUEST_DURATION;

  // Mark used + persist active
  usedIds.push(chosen.id);
  setUsedIds(usedIds);

  saveActive({
    questionId: chosen.id,
    expiresAt
  });

  showQuestFromRecord(chosen, expiresAt);
}

/* ===========================
   RESTORE ON LOAD
=========================== */

function restore() {
  const active = getActive();
  if (!active) return;

  if (active.expiresAt <= now()) {
    clearActive();
    return;
  }

  const q = QUESTIONS.find(x => x.id === active.questionId);
  if (!q) {
    // DB changed / question deleted
    clearActive();
    return;
  }

  showQuestFromRecord(q, active.expiresAt);
}

/* ===========================
   INIT
=========================== */

async function initQuestPage() {
  try {
    QUESTIONS = await loadAllQuestions();

    // If you want to filter out bad rows:
    QUESTIONS = QUESTIONS.filter(q => q?.id && q?.question_type);

    restore();
  } catch (err) {
    console.error("Failed to load quests:", err);
    alert("Couldn't load quests.");
  }
}

document.getElementById("next-btn")
  ?.addEventListener("click", nextQuest);

initQuestPage();