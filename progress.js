import { supabaseClient } from './supabase/supabaseClient.js';
import { trackPageView} from './supabase/supabaseFunctions.js';

import {
  loadUniqueSagesViewed,
  loadCompletedGamesCount,
  loadMostGuessedSage,
  loadGameSuccessRate,
  loadMostViewedSage
} from './supabase/progress_queries.js';

async function initProgress() {


  try {
    // Loading indicators (only set what exists)
    setText('stat-sages', '…');
    setText('stat-most-viewed', '…');
    setText('stat-games', '…');
    setText('stat-success-rate', '…');
    setText('stat-most-guessed', '…');
    setText('stat-badges', '…');
    setText('stat-rank', '…');
    setRing(0);

    const page = await trackPageView();

    const [
      sagesViewed,
      gamesSolved,
      mostGuessedSage,
      successRate,
      mostViewedSage
    ] = await Promise.all([
      loadUniqueSagesViewed(),
      loadCompletedGamesCount(),
      loadMostGuessedSage(),
      loadGameSuccessRate(),
      loadMostViewedSage()
    ]);

    // Top stamps
    setText('stat-sages', sagesViewed);
    setText('stat-games', gamesSolved);
    setText('stat-most-guessed', mostGuessedSage ?? '—');
    setText('stat-most-viewed', mostViewedSage ?? '—');

    // Fix: successRate should be solved / totalAttempted (not attempted+solved)
    // Expecting successRate = { attempted: total, solved: solvedCount }
    setText('stat-success-rate', formatSuccessRate(successRate));

    // Badges: earn all reached + highlight top-earned
    updateCategoryBadges('sages', sagesViewed);
    updateCategoryBadges('games', gamesSolved);

    // Badge tooltips (safe / no data dependency)
    applyBadgeTooltips();

    // Badges Earned stamp
    const totalBadges = document.querySelectorAll('.badge').length;
    const earnedBadges = document.querySelectorAll('.badge.earned').length;
    setText('stat-badges', earnedBadges);

    // Completion ring
    const pct = totalBadges > 0 ? Math.round((earnedBadges / totalBadges) * 100) : 0;
    setRing(pct);

    // Rank/title
    setText('stat-rank', computeRankTitle());

    // Next milestones panels
    updateMilestoneUI('sages', sagesViewed);
    updateMilestoneUI('games', gamesSolved);

  } catch (err) {
    console.error("Progress page failed to load:", err);

    // Safe fallback (only IDs that exist)
    setText('stat-sages', '0');
    setText('stat-most-viewed', '—');
    setText('stat-games', '0');
    setText('stat-success-rate', '0%');
    setText('stat-most-guessed', '—');
    setText('stat-badges', '0');
    setText('stat-rank', '—');
    setRing(0);

    lockAllBadges();
  }
}

initProgress();

/* =========================
   Small DOM helpers
========================= */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setRing(pct) {
  const ring = document.getElementById('badge-ring');
  const txt = document.getElementById('badge-ring-text');
  if (ring) ring.style.setProperty('--p', clamp(pct, 0, 100));
  if (txt) txt.textContent = `${clamp(pct, 0, 100)}%`;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/* =========================
   Success rate formatting
========================= */

function formatSuccessRate(rateObj) {
  if (!rateObj) return '0%';
  const completed = Number(rateObj.attempted + rateObj.solved ?? 0);
  const solved = Number(rateObj.solved ?? 0);

  if (!Number.isFinite(completed) || completed <= 0) return '0%';
  const pct = Math.round((solved / completed) * 100);
  return `${solved}/${completed} (${pct}%)`;
}

/* =========================
   Badge logic
========================= */

/**
 * For a given badge category (e.g. sages/games),
 * earn every badge whose data-tier <= count,
 * lock the rest,
 * and add .top-earned to the highest earned tier.
 */
function updateCategoryBadges(category, count) {
  const grid = document.querySelector(`.badge-grid[data-category="${category}"]`);
  if (!grid) return;

  const badges = Array.from(grid.querySelectorAll('.badge'));
  if (badges.length === 0) return;

  // clear top-earned
  badges.forEach(b => b.classList.remove('top-earned'));

  let bestEarned = null;
  let bestTier = -Infinity;

  for (const b of badges) {
    const tier = Number(b.getAttribute('data-tier')) || 0;
    const earned = count >= tier;

    b.classList.toggle('earned', earned);
    b.classList.toggle('locked', !earned);

    if (earned && tier >= bestTier) {
      bestTier = tier;
      bestEarned = b;
    }
  }

  if (bestEarned) bestEarned.classList.add('top-earned');
}

function lockAllBadges() {
  document.querySelectorAll('.badge').forEach(b => {
    b.classList.remove('earned', 'top-earned');
    b.classList.add('locked');
  });
}

/* =========================
   Tooltips (nice UX, no extra data)
========================= */

function applyBadgeTooltips(){
  document.querySelectorAll('.badge').forEach(b => {
    const title = b.querySelector('.badge-title')?.textContent?.trim() ?? '';
    const desc  = b.querySelector('.badge-desc')?.textContent?.trim() ?? '';
    if (!title && !desc) return;
    const status = b.classList.contains('earned') ? 'Earned' : 'Locked';
    b.title = `${title}\n${desc}\nStatus: ${status}`;
  });
}

/* =========================
   Rank/title
========================= */

function computeRankTitle(){
  // Determine the best tier achieved across ALL categories
  // using the existing badge tiers and earned state.
  const earned = Array.from(document.querySelectorAll('.badge.earned'));
  if (earned.length === 0) return 'Novice';

  let bestTier = 0;
  let bestRankClass = '';

  for (const b of earned){
    const tier = Number(b.getAttribute('data-tier')) || 0;
    if (tier > bestTier){
      bestTier = tier;
      bestRankClass = getRankClass(b);
    }
  }

  // Map class to a “title”
  const map = {
    'rank-bronze': 'Explorer',
    'rank-silver': 'Reader',
    'rank-gold': 'Dedicated',
    'rank-emerald': 'Scholar',
    'rank-platinum': 'Historian',
    'rank-diamond': 'Master'
  };

  return map[bestRankClass] ?? 'Explorer';
}

function getRankClass(badgeEl){
  const classes = ['rank-bronze','rank-silver','rank-gold','rank-emerald','rank-platinum','rank-diamond'];
  return classes.find(c => badgeEl.classList.contains(c)) ?? '';
}

/* =========================
   Next Milestones panel
========================= */

function updateMilestoneUI(category, count){
  const grid = document.querySelector(`.badge-grid[data-category="${category}"]`);
  if (!grid) return;

  const tiers = Array.from(grid.querySelectorAll('.badge'))
    .map(b => Number(b.getAttribute('data-tier')) || 0)
    .filter(n => Number.isFinite(n))
    .sort((a,b) => a-b);

  if (tiers.length === 0) return;

  const next = tiers.find(t => t > count) ?? null;
  const max  = tiers[tiers.length - 1];

  const rightId = category === 'sages' ? 'ms-sages-right' : 'ms-games-right';
  const barId   = category === 'sages' ? 'ms-sages-bar'   : 'ms-games-bar';
  const textId  = category === 'sages' ? 'ms-sages-text'  : 'ms-games-text';

  if (!next){
    setText(rightId, `${count}/${max}`);
    setBar(barId, 100);
    setText(textId, `Max tier reached. Absolute legend.`);
    return;
  }

  const progressPct = Math.round((count / next) * 100);
  const remaining = Math.max(0, next - count);

  setText(rightId, `${count}/${next}`);
  setBar(barId, progressPct);
  setText(textId, `Next badge at ${next}. You need ${remaining} more.`);
}

function setBar(id, pct){
  const el = document.getElementById(id);
  if (!el) return;
  el.style.setProperty('--w', `${clamp(pct, 0, 100)}%`);
}