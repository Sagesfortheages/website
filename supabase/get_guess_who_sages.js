import { supabaseClient } from './supabaseClient.js';

function getSageImageUrl(picture) {
  const imageToUse = picture ? `sages/${picture}` : 'sages/sage';

  const { data } = supabaseClient.storage
    .from('public_images')
    .getPublicUrl(`${imageToUse}.webp`);

  return data?.publicUrl || '';
}

function hasUsableExpertise(sage) {
  return Array.isArray(sage.expertise) && sage.expertise.length > 0;
}

export async function loadGuessWhoSages(count = 25) {
  /*
    Get more than 25 because some rows may still be removed
    after checking joined expertise.
  */
  const candidateCount = Math.max(count * 3, 75);

  const { count: totalCount, error: countError } = await supabaseClient
    .from('sage')
    .select('person', { count: 'exact', head: true })
    .not('birth', 'is', null)
    .not('passing', 'is', null)
    .not('background', 'is', null);

  if (countError) throw countError;

  if (!totalCount || totalCount < count) {
    throw new Error(`Not enough sages found. Needed ${count}, found ${totalCount || 0}.`);
  }

  const maxOffset = Math.max(totalCount - candidateCount, 0);
  const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

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
      picture,
      sage_aka(aka),
      expertise(expertise),
      city_of_passing:city (
        city,
        country,
        latitude,
        longitude
      )
    `)
    .not('birth', 'is', null)
    .not('passing', 'is', null)
    .not('background', 'is', null)
    .order('person', { ascending: true })
    .range(randomOffset, randomOffset + candidateCount - 1);

  if (error) throw error;

  const usableSages = (data || [])
    .filter(hasUsableExpertise)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(sage => ({
      ...sage,
      image: getSageImageUrl(sage.picture)
    }));

  if (usableSages.length < count) {
    throw new Error(`Only found ${usableSages.length} usable sages. Need at least ${count}.`);
  }

  return usableSages;
}