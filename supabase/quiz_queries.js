import { supabaseClient } from './supabaseClient.js';

export async function loadExtraQuizDataForSage(personName) {
  const { data, error } = await supabaseClient
    .from('sage')
    .select(`
      person,
      expertises:expertise(expertise),
      dwellings:dwelling(
        number,
        city:city(city,country)
      )
    `)
    .eq('person', personName)
    .single();

  if (error) {
    console.error('LOAD EXTRA QUIZ DATA ERROR:', error);
    throw error;
  }

  const { data: relations, error: relationsError } = await supabaseClient
    .from('teacher')
    .select('teacher, student')
    .or(`teacher.eq.${personName},student.eq.${personName}`);

  if (relationsError) {
    console.error('LOAD TEACHER/STUDENT RELATIONS ERROR:', relationsError);
    throw relationsError;
  }

  const teachers = (relations || [])
    .filter(r => r.student === personName)
    .map(r => r.teacher);

  const students = (relations || [])
    .filter(r => r.teacher === personName)
    .map(r => r.student);

  return {
    ...data,
    teachers,
    students
  };
}