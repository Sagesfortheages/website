import { supabaseClient } from './supabaseClient.js';

export async function loadAllSages() {
  const { data, error } = await supabaseClient
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
    `);

  if (error) throw error;
  return data;
}