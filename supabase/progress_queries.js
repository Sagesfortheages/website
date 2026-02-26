import { supabaseClient } from './supabaseClient.js';

export async function loadUniqueSagesViewed() {
  // Get current user
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  // Query page_views
  const { data, error } = await supabaseClient
    .from('page_views')
    .select('page_detail')
    .eq('user_id', user.id)
    .in('page_title', ['🔍 Discover', 'Discover']);

  if (error) throw error;

  // Count unique page_detail values
  const unique = new Set(
    (data ?? [])
      .map(r => r.page_detail)
      .filter(v => v != null)
  );

  return unique.size;
}

export async function loadCompletedGamesCount() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const { count, error } = await supabaseClient
    .from('game')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('solved', true);

  if (error) throw error;

  return count ?? 0;
}

/**
 * Most viewed sage (by page_views frequency, Discover only)
 * Returns a string (page_detail) or null.
 */
export async function loadMostViewedSage() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const { data, error } = await supabaseClient
    .from('page_views')
    .select('page_detail')
    .eq('user_id', user.id)
    .in('page_title', ['🔍 Discover', 'Discover']);

  if (error) throw error;

  const freq = new Map();
  for (const row of (data ?? [])) {
    const k = (row?.page_detail ?? '').toString().trim();
    if (!k) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }

  let best = null;
  let bestCount = -1;

  for (const [k, c] of freq.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }

  return best;
}

/**
 * Game success rate: solved / attempted
 * Returns { attempted: number, solved: number }.
 */
export async function loadGameSuccessRate() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const attemptedReq = supabaseClient
    .from('game')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('solved', false);


  const solvedReq = supabaseClient
    .from('game')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('solved', true);

  const [{ count: attempted, error: errA }, { count: solved, error: errS }] =
    await Promise.all([attemptedReq, solvedReq]);

  if (errA) throw errA;
  if (errS) throw errS;

  return {
    attempted: attempted ?? 0,
    solved: solved ?? 0,
  };
}

/**
 * Most guessed sage (by guess.guess_person frequency)
 * Returns a string (guess_person) or null.
 */
export async function loadMostGuessedSage() {
  const { data: { user }, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const { data, error } = await supabaseClient
    .from('guess')
    .select('guess_person')
    .eq('user_id', user.id);

  if (error) throw error;

  const freq = new Map();
  for (const row of (data ?? [])) {
    const k = (row?.guess_person ?? '').toString().trim();
    if (!k) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }

  let best = null;
  let bestCount = -1;

  for (const [k, c] of freq.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }

  return best;
}