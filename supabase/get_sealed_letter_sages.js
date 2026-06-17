import { supabaseClient } from './supabaseClient.js';

function getSageImageUrl(picture) {
  const imageToUse = picture ? `sages/${picture}` : 'sages/sage';

  const { data } = supabaseClient.storage
    .from('public_images')
    .getPublicUrl(`${imageToUse}.webp`);

  return data?.publicUrl || '';
}

/**
 * Load sages usable as Sealed Letter addressees: they need a passing year
 * (era clue), at least one dwelling city with a country (geography clue),
 * and at least one recorded work (bookshop clue).
 *
 * Returns: [{ person, name, difficulty, birth, passing, background,
 *             biography, image, books: [string], cities: [{city, country}] }]
 */
export async function loadSealedLetterSages(maxDifficulty = 5) {
  const { data, error } = await supabaseClient
    .from('sage')
    .select(`
      person,
      name,
      difficulty,
      birth,
      passing,
      background,
      biography,
      picture,
      books:book(book),
      dwellings:dwelling(
        city:city(city, country)
      )
    `)
    .lte('difficulty', maxDifficulty)
    .not('passing', 'is', null)
    .order('person', { ascending: true });

  if (error) throw error;

  const usableSages = (data || [])
    .map(sage => {
      // Drop any work whose title matches the sage's own name/aka — those would
      // give the answer away when used as the letter's "author of ___" clue.
      const selfNames = new Set(
        [sage.person, sage.name]
          .filter(Boolean)
          .map(n => n.trim().toLowerCase())
      );

      const books = (sage.books || [])
        .map(b => (b?.book || '').trim())
        .filter(Boolean)
        .filter(title => !selfNames.has(title.toLowerCase()));

      const seen = new Set();
      const cities = (sage.dwellings || [])
        .map(d => d?.city)
        .filter(c => c?.city && c?.country)
        .filter(c => {
          const key = `${c.city}|${c.country}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(c => ({ city: c.city.trim(), country: c.country.trim() }));

      return {
        person: sage.person,
        name: sage.name,
        difficulty: sage.difficulty,
        birth: sage.birth,
        passing: sage.passing,
        background: sage.background,
        biography: sage.biography,
        image: getSageImageUrl(sage.picture),
        books,
        cities
      };
    })
    .filter(sage => sage.person && sage.books.length > 0 && sage.cities.length > 0);

  if (usableSages.length < 8) {
    throw new Error(
      `Only found ${usableSages.length} sages with works and cities at this difficulty. Need at least 8.`
    );
  }

  return usableSages;
}
