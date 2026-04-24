import { supabaseClient } from './supabase/supabaseClient.js';
import { loadAllSages } from './supabase/sagesWithNames.js';

async function createStudent(e) {
  e?.preventDefault();

  const classId = Number(document.getElementById('class-id').value);
  const displayName = document.getElementById('student-name').value.trim();
  const username = document.getElementById('student-username').value.trim();
  const resultEl = document.getElementById('result');

  resultEl.textContent = 'Creating student...';

  try {
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error('No logged-in teacher session found.');
    }

    const res = await fetch('/api/create_student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ classId, displayName, username })
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

async function loadSagesDropdown() {
  const sageSelect = document.getElementById('sage-select');

  try {
    const sages = await loadAllSages();

    const uniqueSages = [
      ...new Map(sages.map((item) => [item.person, item])).values()
    ];

    uniqueSages.sort((a, b) => a.person.localeCompare(b.person));

    sageSelect.innerHTML = `<option value="">Select a sage...</option>`;

    uniqueSages.forEach((sage) => {
      const option = document.createElement('option');
      option.value = sage.person;
      option.textContent = sage.person;
      sageSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading sages:', err);
    sageSelect.innerHTML = `<option value="">Failed to load sages</option>`;
  }
}

document
  .getElementById('create-student-btn')
  .addEventListener('click', createStudent);


async function assignSage(e) {
  e?.preventDefault();

  const classId = Number(document.getElementById('assignment-class-id').value);
  const targetSagePerson = document.getElementById('sage-select').value;
  const resultEl = document.getElementById('result');

  if (!classId || !targetSagePerson) {
    resultEl.textContent = 'Please enter a class ID and choose a sage.';
    return;
  }

  resultEl.textContent = 'Creating assignment...';

  try {
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error('No logged-in teacher session found.');
    }

    const res = await fetch('/api/create_assignment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        classId,
        targetSagePerson,
        activityType: 'mystery_sage'
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to create assignment.');
    }

    resultEl.textContent =
      `Assignment created!\n\n` +
      `Class: ${data.assignment.className}\n` +
      `Activity: ${data.assignment.title}`;
  } catch (err) {
    console.error(err);
    resultEl.textContent = `Error: ${err.message}`;
  }
}

document
  .getElementById('assign-sage-btn')
  ?.addEventListener('click', assignSage); // only if assignSage exists already

loadSagesDropdown();