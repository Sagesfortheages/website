import { supabaseClient } from './supabaseClient.js';

export async function getTour(filters = {}) {
  const start = performance.now();

  let query = supabaseClient
    .from('tour')
    .select(`
      text,
      year,
      duration,
      zoom,
      icon,
      tour,
      city:city (
        city,
        country,
        latitude,
        longitude
      )
    `);

  // Apply filters if they exist
  if (filters.tour) {
    query = query.eq('tour', filters.tour);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const duration = (performance.now() - start) / 1000;

  return {
    data,
    meta: {
      duration_seconds: duration.toFixed(4),
      count: data.length
    }
  };
}
