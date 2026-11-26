import { supabaseClient } from './supabaseClient.js';
import { fetchAllRows } from './fetchAllRows.js';

export async function loadAllSages() {
  // Supabase returns at most 1000 rows per request, so load in pages (sorted by the unique key).
  const { data, error } = await fetchAllRows(() => supabaseClient
    .from('sage')
    .select(`
      person,
      name,
      birthday,
      yahrtzeit,
      birth,
      passing,
      background,
      difficulty,
      sage_aka(aka),
      expertise(expertise),
      city_of_passing:city (
        city,
        country,
        latitude,
        longitude
      )
    `)
    .order('person'));

  if (error) throw error;
  return data;
}