import { supabaseClient } from './supabaseClient.js';

export async function loadAllQuestions() {
  const { data, error } = await supabaseClient
    .from('question')
    .select(`
      id,
      field1,
      question_type (
        id,
        text,
        answer_type,
        field1
      )
    `);

  if (error) throw error;
  return data;
}
