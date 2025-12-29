import { supabaseClient } from './supabaseClient.js';

/**
 * Fetch a sage by person name, including:

/**
 * Fetch a sage by person name, including:
 * - dwellings, books, expertises, akas (main sage only)
 * - teachers and students (just their basic info, no dwellings/books/etc)
 */
export async function getSelectedSage(personName) {
  const start = performance.now();

  if (!personName) throw new Error("No personName provided");

  try {
    // 1️⃣ Fetch main sage with full data
    const { data: mainSages, error: mainError } = await supabaseClient
      .from('sage')
      .select(`
        person,
        name,
        difficulty,
        biography,
        birthday,
        yahrtzeit,
        further_link,
        birth,
        passing,
        background,
        picture,
        akas:sage_aka(aka),
        expertises:expertise(expertise),
        books:book(book),
        dwellings:dwelling(
          from_year,
          to_year,
          date_approximate,
          location_approximate,
          source,
          number_in_city,
          number,
          city:city(city,country,latitude,longitude),
          coordinate_shift:coordinate_shift(number,lat_shift,lng_shift)
        )
      `)
      .eq('person', personName);

    if (mainError) throw mainError;
    if (!mainSages || mainSages.length === 0)
      return { data: [], meta: { message: "No sage found" } };

    const mainPerson = mainSages[0].person;

    // 2️⃣ Fetch all relations (teachers + students) in one query
    const { data: relations, error: relationsError } = await supabaseClient
      .from('teacher')
      .select('teacher, student')
      .or(`teacher.eq.${mainPerson},student.eq.${mainPerson}`);

    if (relationsError) throw relationsError;

    const teachers = relations.filter(r => r.student === mainPerson).map(r => r.teacher);
    const students = relations.filter(r => r.teacher === mainPerson).map(r => r.student);

    // 3️⃣ Fetch related sages (teachers + students) with minimal info
    const relatedPeople = [...new Set([...teachers, ...students])];
    let relatedSages = [];

    if (relatedPeople.length > 0) {
      const { data: relatedData, error: relatedError } = await supabaseClient
        .from('sage')
        .select('person, name, difficulty, biography, birthday, yahrtzeit, further_link, birth, passing, background, picture')
        .in('person', relatedPeople);

      if (relatedError) throw relatedError;
      relatedSages = relatedData || [];
    }

    // 4️⃣ Flatten dwellings & build results
    const results = [];

    function pushSageData(s, isMain, relationType = 'main') {
      if (!s.dwellings || s.dwellings.length === 0) {
        results.push({
          person: s.person,
          name: s.name,
          expertise: s.expertises?.map(e => e.expertise).join(', ') || '',
          books: s.books?.map(b => b.book).join(', ') || '',
          aka: s.akas?.map(a => a.aka).join(', ') || '',
          difficulty: s.difficulty,
          biography: s.biography,
          birthday: s.birthday || '0',
          yahrtzeit: s.yahrtzeit || 'not found',
          further_link: s.further_link,
          birth: s.birth,
          passing: s.passing,
          background: s.background,
          picture: s.picture ?? null,
          is_main_sage: isMain,
          relationship_type: relationType,
          city: null,
          country: null,
          from: null,
          to: null,
          date_approximate: null,
          location_approximate: null,
          source: null,
          number_in_city: null,
          number: null,
          coordinate_shift: null,
          latitude: null,
          longitude: null
        });
      } else {
        s.dwellings.forEach(d => {
          const lat = (d.city?.latitude || 0) + (d.coordinate_shift?.lat_shift || 0);
          const lng = (d.city?.longitude || 0) + (d.coordinate_shift?.lng_shift || 0);

          results.push({
            person: s.person,
            name: s.name,
            expertise: s.expertises?.map(e => e.expertise).join(', ') || '',
            books: s.books?.map(b => b.book).join(', ') || '',
            aka: s.akas?.map(a => a.aka).join(', ') || '',
            difficulty: s.difficulty,
            biography: s.biography,
            birthday: s.birthday || '0',
            yahrtzeit: s.yahrtzeit || 'not found',
            further_link: s.further_link,
            birth: s.birth,
            passing: s.passing,
            background: s.background,
            picture: s.picture ?? null,
            is_main_sage: isMain,
            relationship_type: relationType,
            city: d.city?.city,
            country: d.city?.country,
            from: d.from_year,
            to: d.to_year,
            date_approximate: d.date_approximate,
            location_approximate: d.location_approximate,
            source: d.source,
            number_in_city: d.number_in_city,
            number: d.number,
            coordinate_shift: d.coordinate_shift ?? null,
            latitude: lat,
            longitude: lng
          });
        });
      }
    }

    // 5️⃣ Push main sage
    mainSages.forEach(s => pushSageData(s, true, 'main'));

    // 6️⃣ Push related sages (minimal info)
    relatedSages.forEach(s => {
      const relationType = teachers.includes(s.person) ? 'teacher' : 'student';
      pushSageData(s, false, relationType);
    });

    const duration = (performance.now() - start) / 1000;

    return {
      data: results,
      meta: {
        duration_seconds: duration.toFixed(4),
        count: results.length,
        main_sages_count: mainSages.length,
        related_sages_count: relatedSages.length
      }
    };
  } catch (err) {
    console.error("Supabase getSelectedSage error:", err);
    throw err;
  }
}
