import { supabaseClient } from './supabaseClient.js';

export async function loadAllSagesNames() {
    const { data, error } = await supabaseClient
    .from('sages_with_dwellings')
    .select('*');

    if (error) {
    console.error(error);
    }

    return {
    data,
    meta: {
        count: data.length
    }
    };
}
