import { supabaseClient } from './supabaseClient.js';
import { fetchAllRows } from './fetchAllRows.js';

export async function loadAllSagesNames() {
    // One row per sage per dwelling (well over 1000 rows). Supabase returns at most 1000 per
    // request, so load it in pages. person + number identifies a dwelling, which keeps the order stable.
    const { data, error } = await fetchAllRows(() => supabaseClient
    .from('sages_with_dwellings')
    .select('*')
    .order('person')
    .order('number'));

    if (error) {
    console.error(error);
    }

    return {
    data,
    meta: {
        count: data ? data.length : 0
    }
    };
}
