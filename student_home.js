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

    console.log('USER:', user);
    console.log('USER ERROR:', userError);

    if (userError) throw userError;
    if (!user) {
      window.location.href = 'student_login.html';
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role, display_name, auth_user_id')
      .eq('auth_user_id', user.id)
      .single();

    console.log('PROFILE:', profile);
    console.log('PROFILE ERROR:', profileError);

    if (profileError || !profile) {
      throw new Error(profileError?.message || 'Profile not found.');
    }

    if (profile.role !== 'student') {
      throw new Error('This account is not a student account.');
    }

    const { data: studentRow, error: studentError } = await supabaseClient
      .from('students')
      .select('id, username, active, class_id, profile_id')
      .eq('profile_id', profile.id)
      .single();

    console.log('STUDENT ROW:', studentRow);
    console.log('STUDENT ERROR:', studentError);

    if (studentError || !studentRow) {
      throw new Error(studentError?.message || 'Student record not found.');
    }

    if (!studentRow.active) {
      throw new Error('This student account is inactive.');
    }

    const { data: classRow, error: classError } = await supabaseClient
      .from('classes')
      .select('id, class_name, join_code')
      .eq('id', studentRow.class_id)
      .single();

    console.log('CLASS ROW:', classRow);
    console.log('CLASS ERROR:', classError);

    if (classError || !classRow) {
      throw new Error(classError?.message || 'Class record not found.');
    }

    studentNameEl.textContent =
      profile.display_name || studentRow.username || 'Student';

    studentClassEl.textContent =
      classRow.class_name || `Class ${classRow.join_code || ''}`;

    studentStatusEl.textContent = 'Ready to begin today’s learning activity.';
    startActivityBtn.disabled = false;
  } catch (err) {
    console.error('LOAD STUDENT HOME ERROR:', err);
    studentNameEl.textContent = 'Unavailable';
    studentClassEl.textContent = 'Unavailable';
    studentStatusEl.textContent =
      err.message || 'Could not load student dashboard.';
    startActivityBtn.disabled = true;
  }

  const { data: assignment, error: assignmentError } = await supabaseClient
  .from('assignments')
  .select('id, title, activity_type, target_sage_person, status, created_at')
  .eq('class_id', studentRow.class_id)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

  if (!assignment) {
  studentStatusEl.textContent = 'No activity has been assigned yet.';
  startActivityBtn.disabled = true;
  return;
}

studentStatusEl.textContent = `Today’s activity: ${assignment.title}`;
startActivityBtn.disabled = false;

startActivityBtn.onclick = () => {
  window.location.href = `play.html?assignment_id=${assignment.id}`;
};
}




async function logoutStudent() {
  await supabaseClient.auth.signOut();
  window.location.href = 'student_login.html';
}

function startActivity() {
  window.location.href = 'discover_select.html';
}

startActivityBtn.addEventListener('click', startActivity);
logoutBtn.addEventListener('click', logoutStudent);

loadStudentHome();