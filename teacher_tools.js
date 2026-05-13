import { supabaseClient } from './supabase/supabaseClient.js';
import { loadAllSages } from './supabase/sagesWithNames.js';

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function statusRow(text) {
  return `<tr><td colspan="10" class="status-cell">${esc(text)}</td></tr>`;
}

function avatarColor(name) {
  const colors = [
    '#2f4f4f',
    '#6a2f52',
    '#7a5a00',
    '#4a3228',
    'rgba(60,60,140,0.85)',
    'rgba(90,120,60,0.85)'
  ];

  let h = 0;
  for (const c of String(name || 'S')) {
    h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  }

  return colors[Math.abs(h) % colors.length];
}

function avatarEl(name) {
  const safeName = String(name || 'Student').trim();
  const letter = safeName.charAt(0).toUpperCase() || 'S';
  return `<span class="avatar" style="background:${avatarColor(safeName)}">${esc(letter)}</span>`;
}

let teacherProfileId = null;
let currentClassId = null;
let lastStudents = [];

const classSelect = document.getElementById('class-global-select');
const studentsTbody = document.getElementById('students-tbody');
const assignmentsTbody = document.getElementById('assignments-tbody');
const assignmentDetailTbody = document.getElementById('assignment-detail-tbody');

const viewByAssignment = document.getElementById('view-by-assignment');
const viewByStudent = document.getElementById('view-by-student');
const assignmentDetail = document.getElementById('assignment-detail');

initPage();

async function initPage() {
  wireTabs();
  wireModals();
  wireSubToggle();
  wireCreateStudent();
  wireAssignSage();

  await loadTeacherSession();
  await loadSageDropdown();
}

/* Tabs */

function wireTabs() {
  document.querySelectorAll('.teacher-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.teacher-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.teacher-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');

      const panel = document.getElementById(`panel-${tab.dataset.panel}`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* Modals */

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function wireModals() {
  document.getElementById('open-add-student')?.addEventListener('click', () => {
    openModal('modal-add-student');
  });

  document.getElementById('open-assign-game')?.addEventListener('click', () => {
    openModal('modal-assign-game');
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => {
        m.classList.remove('open');
      });
    }
  });
}

/* Assignment sub-toggle */

function wireSubToggle() {
  document.querySelectorAll('.sub-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;

      if (view === 'assignment') {
        showAssignmentOverview();
      }

      if (view === 'student') {
        showStudentOverview();
      }
    });
  });
}

function showAssignmentOverview() {
  if (viewByAssignment) viewByAssignment.style.display = '';
  if (viewByStudent) viewByStudent.style.display = 'none';
  if (assignmentDetail) assignmentDetail.style.display = 'none';
}

function showStudentOverview() {
  if (viewByAssignment) viewByAssignment.style.display = 'none';
  if (assignmentDetail) assignmentDetail.style.display = 'none';

  if (!viewByStudent) return;

  viewByStudent.style.display = 'block';

  const tbody = document.getElementById('student-overview-tbody');
  if (!tbody) return;

  if (!lastStudents.length) {
    tbody.innerHTML = statusRow('No students loaded yet.');
    return;
  }

  tbody.innerHTML = lastStudents.map(s => {
    const name = s.profile?.display_name || 'Student';

    return `
      <tr>
        <td><span class="student-name-cell">${avatarEl(name)}${esc(name)}</span></td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td><button class="cta-button sm" data-student-id="${esc(s.id)}">View</button></td>
      </tr>
    `;
  }).join('');
}

/* Auth/profile/classes */

async function loadTeacherSession() {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    classSelect.innerHTML = '<option value="">Please log in</option>';
    studentsTbody.innerHTML = statusRow('No logged-in teacher session found.');
    assignmentsTbody.innerHTML = statusRow('No logged-in teacher session found.');
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !profile) {
    classSelect.innerHTML = '<option value="">Profile not found</option>';
    studentsTbody.innerHTML = statusRow('Teacher profile not found.');
    assignmentsTbody.innerHTML = statusRow('Teacher profile not found.');
    return;
  }

  teacherProfileId = profile.id;
  await loadClasses();
}

async function loadClasses() {
  const { data: classes, error } = await supabaseClient
    .from('classes')
    .select('id, class_name')
    .eq('teacher_profile_id', teacherProfileId)
    .order('class_name');

  if (error) {
    console.error(error);
    classSelect.innerHTML = '<option value="">Error loading classes</option>';
    return;
  }

  if (!classes?.length) {
    classSelect.innerHTML = '<option value="">No classes found</option>';
    studentsTbody.innerHTML = statusRow('No classes found.');
    assignmentsTbody.innerHTML = statusRow('No classes found.');
    return;
  }

  classSelect.innerHTML = '<option value="">Select class…</option>';

  classes.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `👥 ${c.class_name}`;
    classSelect.appendChild(option);
  });

  currentClassId = classes[0].id;
  classSelect.value = currentClassId;

  await refreshClassData();

  classSelect.addEventListener('change', async () => {
    currentClassId = classSelect.value || null;

    if (!currentClassId) {
      studentsTbody.innerHTML = statusRow('Select a class to view students.');
      assignmentsTbody.innerHTML = statusRow('Select a class to view assignments.');
      return;
    }

    await refreshClassData();
  });
}

async function refreshClassData() {
  await Promise.all([
    loadStudents(currentClassId),
    loadAssignments(currentClassId)
  ]);

  showAssignmentOverview();
}

/* Students */

async function loadStudents(classId) {
  studentsTbody.innerHTML = statusRow('Loading students…');

  const { data: students, error } = await supabaseClient
    .from('students')
    .select(`
      id,
      username,
      profile:profiles(display_name)
    `)
    .eq('class_id', classId)
    .order('username');

  if (error) {
    console.error(error);
    studentsTbody.innerHTML = statusRow('Error loading students.');
    return;
  }

  lastStudents = students || [];

  if (!students?.length) {
    studentsTbody.innerHTML = statusRow('No students in this class.');
    return;
  }

  studentsTbody.innerHTML = students.map(s => {
    const name = s.profile?.display_name || 'Student';

    return `
      <tr>
        <td><span class="student-name-cell">${avatarEl(name)}${esc(name)}</span></td>
        <td>${esc(s.username)}</td>
        <td>
          <button class="cta-button sm" data-reset-pin="${esc(s.id)}">Reset PIN</button>
        </td>
      </tr>
    `;
  }).join('');

  studentsTbody.querySelectorAll('[data-reset-pin]').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Reset PIN endpoint not connected yet.');
    });
  });
}

/* Assignments */

async function loadAssignments(classId) {
  assignmentsTbody.innerHTML = statusRow('Loading assignments…');

  const { data: assignments, error } = await supabaseClient
    .from('assignments')
    .select('id, title, target_sage_person, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
    

  if (error) {
    console.error(error);
    assignmentsTbody.innerHTML = statusRow('Error loading assignments.');
    return;
  }

  if (!assignments?.length) {
    assignmentsTbody.innerHTML = statusRow('No assignments for this class yet.');
    return;
  }

  assignmentsTbody.innerHTML = assignments.map(a => {
    const dateText = a.created_at
      ? new Date(a.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '—';

    console.log(a)

    const title = `${a.title} - ${a.target_sage_person}` || a.target_sage_person || 'Mystery Sage';

    return `
      <tr>
        <td>
          <span style="display:flex;align-items:center;gap:0.5em;">
            <span class="assign-icon">📜</span>${esc(title)}
          </span>
        </td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">${esc(dateText)}</td>
        <td>
          <button 
            class="cta-button sm" 
            data-assignment-id="${esc(a.id)}" 
            data-assignment-title="${esc(title)}"
          >
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  assignmentsTbody.querySelectorAll('[data-assignment-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      showAssignmentDetail(btn.dataset.assignmentId, btn.dataset.assignmentTitle);
    });
  });
}

async function showAssignmentDetail(assignmentId, title) {
  if (viewByAssignment) viewByAssignment.style.display = 'none';
  if (viewByStudent) viewByStudent.style.display = 'none';
  if (assignmentDetail) assignmentDetail.style.display = 'block';

  const titleEl = document.querySelector('.assign-detail-title');
  if (titleEl) {
    titleEl.innerHTML = `<span class="assign-icon">📜</span>${esc(title)} - {}`;
  }

  assignmentDetailTbody.innerHTML = statusRow('Loading student results…');

  // Fetch students and their progress for this assignment in parallel
  const [studentsRes, progressRes] = await Promise.all([
    supabaseClient
      .from('students')
      .select('id, username, profile:profiles(display_name)')
      .eq('class_id', currentClassId)
      .order('username'),
    supabaseClient
      .from('assignment_progress')
      .select('student_id, correct_count, total_questions, status')
      .eq('assignment_id', assignmentId)
  ]);

  if (studentsRes.error) {
    console.error(studentsRes.error);
    assignmentDetailTbody.innerHTML = statusRow('Error loading students.');
    return;
  }

  if (progressRes.error) {
    console.error(progressRes.error);
    assignmentDetailTbody.innerHTML = statusRow('Error loading progress data.');
    return;
  }

  const students = studentsRes.data || [];
  const progress = progressRes.data || [];

  if (!students.length) {
    assignmentDetailTbody.innerHTML = statusRow('No students found.');
    return;
  }

  // Build a lookup map: student_id → progress row
  const progressByStudent = Object.fromEntries(
    progress.map(p => [p.student_id, p])
  );

    // ===== Calculate stats =====

  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  let totalScore = 0;
  let scoredStudents = 0;

  students.forEach(s => {
    const p = progressByStudent[s.id];

    if (!p) {
      notStartedCount++;
      return;
    }

    if (p.status === 'completed') {
      completedCount++;
    } else {
      inProgressCount++;
    }

    if (
      p.correct_count != null &&
      p.total_questions != null &&
      p.total_questions > 0
    ) {
      const percent = Math.round(
        (100 * p.correct_count) / p.total_questions
      );

      totalScore += percent;
      scoredStudents++;
    }
  });

  const avgScore = scoredStudents
    ? `${Math.round(totalScore / scoredStudents)}%`
    : '—';

  // ===== Update UI =====

  document.getElementById('stat-completed').textContent =
    completedCount;

  document.getElementById('stat-progress').textContent =
    inProgressCount;

  document.getElementById('stat-not-started').textContent =
    notStartedCount;

  document.getElementById('stat-avg-score').textContent =
    avgScore;

  assignmentDetailTbody.innerHTML = students.map(s => {
    const name = s.profile?.display_name || 'Student';
    const p = progressByStudent[s.id];

    let chipHtml;
    if (!p) {
      chipHtml = `<span class="chip notstarted">○ Not Started</span>`;
    } else if (p.status === 'completed') {
      chipHtml = `<span class="chip completed">✓ Completed</span>`;
    } else {
      chipHtml = `<span class="chip progress">↻ In Progress</span>`;
    }

    const score = p?.correct_count!= null ? `${Math.round(100*p.correct_count/p.total_questions)}%` : '—';

    return `
      <tr>
        <td><span class="student-name-cell">${avatarEl(name)}${esc(name)}</span></td>
        <td>${chipHtml}</td>
        <td class="num">${esc(score)}</td>
        <td class="num">—</td>
        <td class="num">—</td>
      </tr>
    `;
  }).join('');
}

window.hideAssignmentDetail = function hideAssignmentDetail() {
  showAssignmentOverview();
};

/* Sage dropdown */

async function loadSageDropdown() {
  try {
    const sages = await loadAllSages();

    const unique = [...new Map(
      sages
        .filter(s => s?.person)
        .map(s => [s.person, s])
    ).values()].sort((a, b) => a.person.localeCompare(b.person));

    const select = document.getElementById('sage-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select a sage…</option>';

    unique.forEach(s => {
      const option = document.createElement('option');
      option.value = s.person;
      option.textContent = s.person;
      select.appendChild(option);
    });

  } catch (err) {
    console.error('Could not load sages:', err);
  }
}

/* Create student */

function wireCreateStudent() {
  document.getElementById('create-student-btn')?.addEventListener('click', async () => {
    const classId = currentClassId;
    const displayName = document.getElementById('student-name')?.value.trim();
    const username = document.getElementById('student-username')?.value.trim();
    const resultEl = document.getElementById('add-student-result');

    if (!classId) {
      resultEl.innerHTML = errorCard('No class selected', 'Please select a class from the top before adding a student.');
      return;
    }

    if (!displayName || !username) {
      resultEl.innerHTML = errorCard('Missing information', 'Please fill in all fields.');
      return;
    }

    resultEl.innerHTML = loadingCard('Creating the student account…');

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/create_student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ classId, displayName, username })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        resultEl.innerHTML = errorCard(
          'Not created',
          data?.userMessage || data?.message || 'The student could not be created.'
        );
        return;
      }

      const student = data?.student || data || {};

      resultEl.innerHTML = `
        <div class="result-card success">
          <div class="result-title">✅ Student created successfully</div>
          <div class="result-row-pair"><span>Display name</span><b>${esc(student.display_name || displayName)}</b></div>
          <div class="result-row-pair"><span>Username</span><b>${esc(student.username || username)}</b></div>
          <div class="result-row-pair"><span>PIN</span><b>${esc(student.pin || student.tempPin || '—')}</b></div>
        </div>
      `;

      await loadStudents(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message);
    }
  });
}

/* Assign sage */

function wireAssignSage() {
  document.getElementById('assign-sage-btn')?.addEventListener('click', async () => {
    const classId = currentClassId;
    const targetSagePerson = document.getElementById('sage-select')?.value;
    const resultEl = document.getElementById('assign-game-result');

    if (!classId) {
      resultEl.innerHTML = errorCard('No class selected', 'Please select a class from the top first.');
      return;
    }

    if (!targetSagePerson) {
      resultEl.innerHTML = errorCard('Missing information', 'Please choose a sage.');
      return;
    }

    resultEl.innerHTML = loadingCard('Creating the assignment…');

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/create_assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          classId,
          targetSagePerson,
          activityType: 'mystery_sage'
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        resultEl.innerHTML = errorCard(
          'Not created',
          data?.userMessage || data?.message || 'The assignment could not be created.'
        );
        return;
      }

      const assignment = data?.assignment || data || {};

      resultEl.innerHTML = `
        <div class="result-card success">
          <div class="result-title">✅ Assignment created successfully</div>
          <div class="result-row-pair"><span>Activity</span><b>${esc(assignment.title || 'Mystery Sage')}</b></div>
          <div class="result-row-pair"><span>Mystery sage</span><b>${esc(targetSagePerson)}</b></div>
        </div>
      `;

      await loadAssignments(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message);
    }
  });
}

/* Shared helpers */

async function getAccessToken() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.access_token || null;
}

function errorCard(title, message) {
  return `
    <div class="result-card error">
      <div class="result-title">⚠️ ${esc(title)}</div>
      ${esc(message)}
    </div>
  `;
}

function loadingCard(message) {
  return `
    <div class="result-card loading">
      <div class="result-title">⏳ Working…</div>
      ${esc(message)}
    </div>
  `;
}