import { supabaseClient } from './supabaseClient.js';

export async function trackPageView(pageDetail = null) {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error("Supabase getUser error:", error);
      return { isFirstVisit: false };
    }

    if (!user) return { isFirstVisit: false };

    // Check if this is the first visit to this page
    const { data: existingViews, error: queryError } = await supabaseClient
      .from('page_views')
      .select('*')
      .eq('user_id', user.id)
      .eq('page_title', document.title)
      .limit(1);

    const isFirstVisit = !queryError && existingViews.length === 0;


    // Track the current page view
    await supabaseClient
      .from('page_views')
      .insert({
        user_id: user.id,
        page_title: document.title,
        referrer: document.referrer,
        page_detail: pageDetail,
      });
    
    console.log("Page view tracked successfully");
    console.log(user.id, pageDetail, window.location.pathname, document.title, document.referrer);

    return { isFirstVisit };

  } catch (err) {
    console.error("trackPageView failed:", err);
    return { isFirstVisit: false };
  }
}