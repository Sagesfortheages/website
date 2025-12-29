import { supabaseClient } from '../supabase/supabaseClient.js';

export async function loadTextImage(filename) {
    const { data, error } = await supabaseClient.storage
        .from('images')
        .createSignedUrl(`texts/${filename}`, 60); // valid for 5 minutes

    return data
}