import { supabaseClient } from './supabaseClient.js';

function getSageImageUrl(picture) {
  const imageToUse = picture ? `sages/${picture}` : 'sages/sage';

  const { data } = supabaseClient.storage
    .from('public_images')
    .getPublicUrl(`${imageToUse}.webp`);

  return data?.publicUrl || '';
}

/**
 * Load sages who have at least one recorded work, for the Master Works game.
 * Returns: [{ person, name, difficulty, image, books: [string] }]
 */
export async function loadMasterWorksSages(maxDifficulty = 5) {
  const { data, error } = await supabaseClient
    .from('sage')
    .select(`
      person,
      name,
      difficulty,
      picture,
      books:book(book)
    `)
    .lte('difficulty', maxDifficulty)
    .order('person', { ascending: true });

  if (error) throw error;

  const usableSages = (data || [])
    .filter(sage =>
      sage.person &&
      Array.isArray(sage.books) &&
      sage.books.some(b => b?.book && b.book.trim().length > 0)
    )
    .map(sage => ({
      person: sage.person,
      name: sage.name,
      difficulty: sage.difficulty,
      image: getSageImageUrl(sage.picture),
      books: sage.books
        .map(b => (b?.book || '').trim())
        .filter(Boolean)
    }));

  if (usableSages.length < 12) {
    throw new Error(
      `Only found ${usableSages.length} sages with recorded works at this difficulty. Need at least 12.`
    );
  }

  return usableSages;
}
