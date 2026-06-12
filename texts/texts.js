import { supabaseClient } from '../supabase/supabaseClient.js';

export async function loadTextImage(filename) {
    const { data, error } = await supabaseClient.storage
        .from('public_images')
        .getPublicUrl(`texts/${filename}`);

    return data
}