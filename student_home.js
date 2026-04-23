import { supabaseClient } from './supabase/supabaseClient.js';

const studentNameEl = document.getElementById('student-name');
const studentClassEl = document.getElementById('student-class');
const studentStatusEl = document.getElementById('student-status');
const startActivityBtn = document.getElementById('start-activity-btn');
const logoutBtn = document.getElementById('logout-button');

async function loadStudentHome() {
  try {
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      window.location.href = 'student_login.html';
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role, display_name')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found.');
    }

    if (profile.role !== 'student') {
      throw new Error('This account is not a student account.');
    }

    const { data: studentRow, error: studentError } = await supabaseClient
      .from('students')
      .select(`
        id,
        username,
        active,
        classes!inner (
          id,
          class_name,
          join_code
        )
      `)
      .eq('profile_id', profile.id)
      .single();

    if (studentError || !studentRow) {
      throw new Error('Student record not found.');
    }

    if (!studentRow.active) {
      throw new Error('This student account is inactive.');
    }

    studentNameEl.textContent = profile.display_name || studentRow.username || 'Student';
    studentClassEl.textContent = studentRow.classes?.class_name || `Class ${studentRow.classes?.join_code || ''}`;
    studentStatusEl.textContent = 'Ready to begin today’s learning activity.';

    startActivityBtn.disabled = false;
  } catch (err) {
    console.error(err);
    studentNameEl.textContent = 'Unavailable';
    studentClassEl.textContent = 'Unavailable';
    studentStatusEl.textContent = err.message || 'Could not load student dashboard.';
    startActivityBtn.disabled = true;
  }
}

async function logoutStudent() {
  await supabaseClient.auth.signOut();
  window.location.href = 'student_login.html';
}

function startActivity() {
  // Fastest MVP: send them into your existing content flow
  window.location.href = 'discover_select.html';
}

startActivityBtn.addEventListener('click', startActivity);
logoutBtn.addEventListener('click', logoutStudent);

loadStudentHome();