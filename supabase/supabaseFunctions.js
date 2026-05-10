import { supabaseClient } from './supabaseClient.js';

export async function trackPageView(pageDetail = null) {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.warn("Supabase getUser warning:", error);
    }

    let visitorId = localStorage.getItem("sfta_visitor_id");

    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("sfta_visitor_id", visitorId);
    }

    const userId = user?.id ?? null;

    const { data: existingViews, error: queryError } = await supabaseClient
      .from("page_views")
      .select("id")
      .eq(userId ? "user_id" : "visitor_id", userId || visitorId)
      .eq("page_title", document.title)
      .limit(1);

    const isFirstVisit = !queryError && existingViews.length === 0;

    await supabaseClient
      .from("page_views")
      .insert({
        user_id: userId,
        visitor_id: visitorId,
        page_title: document.title,
        path: window.location.pathname,
        referrer: document.referrer,
        page_detail: pageDetail,
      });

    return { isFirstVisit };

  } catch (err) {
    console.error("trackPageView failed:", err);
    return { isFirstVisit: false };
  }
}

//insert games into database

export async function trackGameStart(correct_answer, difficulty) {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error("Supabase getUser error:", error);
    }

    // Track the current game
    const { data, error: insertError } = await supabaseClient
      .from('game')
      .insert({
        user_id: user.id,
        correct_answer: correct_answer,
        solved: null,
        guesses_used: null,
        difficulty: difficulty
      })
      .select() // This returns the inserted row(s)
      .single(); // This gets just the single row instead of an array

    if (insertError) {
      console.error("Insert error:", insertError);
      return null;
    }
    
    console.log("game start tracked successfully");
    console.log(user.id, correct_answer, difficulty);

    return data.id; // Return the game ID so you can use it later

  } catch (err) {
    console.error("trackGameStart failed:", err);
  }
}



export async function updateGameResult(gameId, solved, guessesUsed) {
  const { error } = await supabaseClient
    .from('game')
    .update({
      solved: solved,
      guesses_used: guessesUsed,
      ended_at: new Date().toISOString()
    })
    .eq('id', gameId);

  if (error) {
    console.error("Update error:", error);
    return false;
  }
  
  return true;
}



export async function trackGuess(guess_person, correct, guess_number, game_id) {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();  // ← FIX: Capture the result

    if (error) {
      console.error("Supabase getUser error:", error);
      return null;  // ← FIX: Return early if error
    }

    // Track the current guess
    const { data, error: insertError } = await supabaseClient
      .from('guess')
      .insert({
        game_id: game_id,
        user_id: user.id,
        guess_person: guess_person,
        guess_number: guess_number,
        correct: correct
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return null;
    }
    
    console.log(data);
    console.log(guess_person, correct, guess_number);

    return true;  // ← Good practice: return success indicator

  } catch (err) {
    console.error("trackGuess failed:", err);
    return null;
  }
}



export async function countSolvedGames() {
  try {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return 0;
    }

    const { count, error } = await supabaseClient
      .from('game')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('solved', true);

    if (error) {
      console.error("Error counting solved games:", error);
      return 0;
    }

    console.log(`User has solved ${count} games`);
    return count;

  } catch (err) {
    console.error("countSolvedGames failed:", err);
    return 0;
  }
}