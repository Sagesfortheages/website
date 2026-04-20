import { supabaseClient } from './supabase/supabaseClient.js';


async function createStudent(e) {
  e?.preventDefault();

  const classId = Number(document.getElementById('class-id').value);
  const displayName = document.getElementById('student-name').value.trim();
  const username = document.getElementById('student-username').value.trim();
  const resultEl = document.getElementById('result');

  resultEl.textContent = 'Creating student...';

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error('No logged-in teacher session found.');
    }

    const res = await fetch('/api/create-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        classId,
        displayName,
        username
      })
    });

    const text = await res.text();

    console.log('STATUS:', res.status);
    console.log('RAW RESPONSE:', text);

    resultEl.textContent = `Status: ${res.status}\n${text || '(empty response)'}`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

document
  .getElementById('create-student-btn')
  .addEventListener('click', createStudent);