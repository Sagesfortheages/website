import { supabaseClient } from './supabaseClient.js';

export async function getTour(filters = {}) {
  const start = performance.now();

  let query = supabaseClient
    .from('tour_event')
    .select(`
      text,
      year,
      duration,
      zoom,
      icon,
      tour:tour_id!inner (
        tour_id,
        tour_name
      ),
      city:city (
        city,
        country,
        latitude,
        longitude
      )
    `);

  if (filters.tour) {
    query = query.eq('tour.tour_name', filters.tour);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const normalizedData = (data || []).map(row => ({
    ...row,
    tour_id: row.tour?.tour_id ?? null,
    tour_name: row.tour?.tour_name ?? null
  }));

  const duration = (performance.now() - start) / 1000;

  return {
    data: normalizedData,
    meta: {
      duration_seconds: duration.toFixed(4),
      count: normalizedData.length
    }
  };
}

export async function getTourSages(filters = {}) {
  const start = performance.now();

  console.log('=== getTourSages START ===');
  console.log('filters:', filters);

  let tourQuery = supabaseClient
    .from('tour_sage')
    .select(`
      person,
      tour:tour_id!inner (
        tour_id,
        tour_name
      )
    `);

  console.log('Initial tourQuery created for table: tour_sage');

  if (filters.tour) {
    console.log('Applying tour filter:', filters.tour);
    tourQuery = tourQuery.eq('tour.tour_name', filters.tour);
  } else {
    console.log('No tour filter provided');
  }

  const { data: tourData, error: tourError } = await tourQuery;

  if (tourError) {
    console.error('Error in tourQuery:', tourError);
    throw new Error(tourError.message);
  }

  const sageIds = [...new Set((tourData || []).map(row => row.person))];

  if (sageIds.length === 0) {
    const duration = (performance.now() - start) / 1000;

    return {
      data: [],
      meta: {
        duration_seconds: duration.toFixed(4),
        count: 0
      },
      sageIds: []
    };
  }

  let sagesQuery = supabaseClient
    .from('sages_with_dwellings')
    .select('*')
    .in('person', sageIds);

  if (filters.year) {
    console.log('Applying year filter:', filters.year);
    sagesQuery = sagesQuery.eq('year', filters.year);
  } else {
    console.log('No year filter provided');
  }

  const { data, error } = await sagesQuery;

  if (error) {
    console.error('Error in sagesQuery:', error);
    throw new Error(error.message);
  }

  const duration = (performance.now() - start) / 1000;

  console.log('Final return object:', {
    data,
    meta: {
      duration_seconds: duration.toFixed(4),
      count: data.length
    }
  });

  return {
    data,
    meta: {
      duration_seconds: duration.toFixed(4),
      count: data.length
    },
    sageIds
  };
}