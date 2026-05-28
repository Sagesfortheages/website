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
export async function loadGuessWhoSages() {
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
    .order('person', { ascending: true });

  if (error) throw error;

  const usableSages = (data || [])
    .filter(hasUsableExpertise)
    .map(sage => ({
      ...sage,
      image: getSageImageUrl(sage.picture)
    }));

  if (usableSages.length < 25) {
    throw new Error(`Only found ${usableSages.length} usable sages. Need at least 25.`);
  }

  return usableSages;
}