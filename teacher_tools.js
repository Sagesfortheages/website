import { supabaseClient } from './supabase/supabaseClient.js';
import { loadAllSages } from './supabase/sagesWithNames.js';

const ACTIVITY_TYPES = {
  SAGE_SLEUTH: 'Sage Sleuth',
  WHICH_SAGE: 'Which Sage'
};


function getActivityLabel(activityType) {
  return activityType || 'Activity';
}

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
let lastAssignments = [];
let lastProgressRows = [];
let selectedAssignmentActivityType = ACTIVITY_TYPES.SAGE_SLEUTH;

const classSelect = document.getElementById('class-global-select');
const studentsTbody = document.getElementById('students-tbody');
const assignmentsTbody = document.getElementById('assignments-tbody');
const assignmentDetailTbody = document.getElementById('assignment-detail-tbody');

const viewByAssignment = document.getElementById('view-by-assignment');
const viewByStudent = document.getElementById('view-by-student');
const assignmentDetail = document.getElementById('assignment-detail');

const addStudentButton = document.getElementById("open-add-student");

const studentsSubtitle = document.getElementById('students-subtitle');

initPage();

async function initPage() {
  wireTabs();
  wireModals();
  wireSubToggle();
  wireBackButtons();
  wireCreateStudent();
  wireCreateBulkStudents();
  wireAssignmentActivityChoice();
  wireAssignSage();
  wireCreateClassButton();
  wireOnboarding();

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

function wireBackButtons() {
  document.getElementById('back-to-assignments-top')?.addEventListener('click', () => {
    showAssignmentOverview();
  });

  document.getElementById('back-to-assignments-bottom')?.addEventListener('click', () => {
    showAssignmentOverview();
  });
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function wireAssignmentActivityChoice() {
  document.querySelectorAll('.assign-activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.assign-activity-btn').forEach(b => {
        b.classList.remove('active');
      });

      btn.classList.add('active');

      selectedAssignmentActivityType =
        btn.dataset.activityType || ACTIVITY_TYPES.SAGE_SLEUTH;
    });
  });
}

function wireModals() {
  document.getElementById('open-add-student')?.addEventListener('click', () => {
    openModal('modal-add-student');
  });

  document.getElementById('open-add-multiple-students')?.addEventListener('click', () => {
    openModal('modal-add-multiple-students');
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

function wireOnboarding() {
  document.querySelectorAll('[data-step-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      handleOnboardingStep(btn.dataset.stepAction);
    });
  });

  document.getElementById('toggle-onboarding-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('teacher-onboarding');
    const btn = document.getElementById('toggle-onboarding-btn');

    if (!panel || !btn) return;

    panel.classList.toggle('collapsed');

    const isCollapsed = panel.classList.contains('collapsed');
    btn.textContent = isCollapsed ? 'Show Guide' : 'Hide Guide';

    localStorage.setItem(
      'teacherOnboardingCollapsed',
      isCollapsed ? 'true' : 'false'
    );
  });

  const shouldCollapse =
    localStorage.getItem('teacherOnboardingCollapsed') === 'true';

  if (shouldCollapse) {
    document.getElementById('teacher-onboarding')?.classList.add('collapsed');

    const btn = document.getElementById('toggle-onboarding-btn');
    if (btn) btn.textContent = 'Show Guide';
  }
}

function handleOnboardingStep(action) {
  if (action === 'create-class') {
    const createClassButton = document.getElementById('create-class-button');

    if (createClassButton && !createClassButton.classList.contains('hidden')) {
      createClassButton.click();
      return;
    }

    const classSelect = document.getElementById('class-global-select');
    classSelect?.focus();
    return;
  }

  if (action === 'add-student') {
    if (!currentClassId) return;

    document.querySelector('[data-panel="students"]')?.click();
    document.getElementById('open-add-student')?.click();
    return;
  }

  if (action === 'assign-activity') {
    if (!currentClassId || !lastStudents.length) return;

    document.querySelector('[data-panel="assignments"]')?.click();
    document.getElementById('open-assign-game')?.click();
    return;
  }

  if (action === 'track-progress') {
    if (!lastAssignments.length) return;

    document.querySelector('[data-panel="assignments"]')?.click();
    showAssignmentOverview();
  }
}

function updateOnboardingState() {
  const hasClass = !!currentClassId;
  const hasStudents = lastStudents.length > 0;
  const hasAssignments = lastAssignments.length > 0;

  const hasAnyProgress = lastProgressRows.length > 0;
  const hasCompletedProgress =
    lastProgressRows.some(r => r.status === 'completed');

  const states = [
    {
      action: 'create-class',
      complete: hasClass,
      active: !hasClass,
      disabled: false,
      status: hasClass ? 'Complete' : 'Next step'
    },
    {
      action: 'add-student',
      complete: hasStudents,
      active: hasClass && !hasStudents,
      disabled: !hasClass,
      status: hasStudents
        ? 'Complete'
        : hasClass
          ? 'Next step'
          : 'Create class first'
    },
    {
      action: 'assign-activity',
      complete: hasAssignments,
      active: hasClass && hasStudents && !hasAssignments,
      disabled: !hasStudents,
      status: hasAssignments
        ? 'Complete'
        : hasStudents
          ? 'Next step'
          : 'Add students first'
    },
    {
      action: 'track-progress',
      complete: hasCompletedProgress,
      active: hasAssignments,
      disabled: !hasAssignments,
      status: hasCompletedProgress
        ? 'Results ready'
        : hasAnyProgress
          ? 'In progress'
          : hasAssignments
            ? 'Waiting for students'
            : 'Assign first'
    }
  ];

  let completed = 0;

  states.forEach(state => {
    const el = document.querySelector(`[data-step-action="${state.action}"]`);
    if (!el) return;

    el.classList.toggle('complete', !!state.complete);
    el.classList.toggle('active', !!state.active);
    el.classList.toggle('disabled', !!state.disabled);

    if (state.disabled) {
      el.setAttribute('aria-disabled', 'true');
    } else {
      el.removeAttribute('aria-disabled');
    }

    const statusEl = el.querySelector('.step-status');
    if (statusEl) statusEl.textContent = state.status;

    if (state.complete) completed++;
  });

  const fill = document.getElementById('onboarding-progress-fill');
  if (fill) {
    fill.style.width = `${(completed / 4) * 100}%`;
  }

  const progressText = document.getElementById('onboarding-progress-text');
  if (progressText && completed !== 3) {
    progressText.textContent = `${completed} of 4 steps completed`;
  }
  else if (progressText && completed === 3) {
    progressText.textContent = `Setup ready - results will appear after students begin.`;
  }

  const nextText = document.getElementById('onboarding-next');
  if (nextText) {
    if (!hasClass) {
      nextText.textContent = 'Start by creating your first class.';
    } else if (!hasStudents) {
      nextText.textContent = 'Next: add your first student to this class.';
    } else if (!hasAssignments) {
      nextText.textContent = 'Next: assign an activity to your students.';
    } else if (!hasAnyProgress) {
      nextText.textContent = 'Assignment is ready. Results will appear after students begin.';
    } else if (!hasCompletedProgress) {
      nextText.textContent = 'Students have started. Check the Assignments tab for progress.';
    } else {
      nextText.textContent = 'Student results are ready. Open the Assignments tab to review them.';
    }
  }

  maybeAutoCollapseOnboarding({
    hasClass,
    hasStudents,
    hasAssignments
  });
}

function maybeAutoCollapseOnboarding({ hasClass, hasStudents, hasAssignments }) {
  const panel = document.getElementById('teacher-onboarding');
  const btn = document.getElementById('toggle-onboarding-btn');

  if (!panel || !btn) return;

  const setupComplete = hasClass && hasStudents && hasAssignments;

  const hasAlreadyAutoCollapsed =
    localStorage.getItem('teacherOnboardingAutoCollapsed') === 'true';

  if (setupComplete && !hasAlreadyAutoCollapsed) {
    panel.classList.add('collapsed');
    btn.textContent = 'Show Guide';

    localStorage.setItem('teacherOnboardingCollapsed', 'true');
    localStorage.setItem('teacherOnboardingAutoCollapsed', 'true');
  }
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
  viewByAssignment?.classList.remove('hidden');
  viewByStudent?.classList.add('hidden');
  assignmentDetail?.classList.add('hidden');
}

function showStudentOverview() {
  viewByAssignment?.classList.add('hidden');
  assignmentDetail?.classList.add('hidden');

  if (!viewByStudent) return;

  viewByStudent.classList.remove('hidden');

  const tbody = document.getElementById('student-results-tbody');
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
  await loadCreateClassButton();
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
    currentClassId = null;
    lastStudents = [];
    lastAssignments = [];
    lastProgressRows = [];

    classSelect.innerHTML = '<option value="">No classes found</option>';
    studentsTbody.innerHTML = statusRow('No classes found.');
    assignmentsTbody.innerHTML = statusRow('No classes found.');

    updateOnboardingState();
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
    lastStudents = [];
    lastAssignments = [];
    lastProgressRows = [];

    studentsTbody.innerHTML = statusRow('Select a class to view students.');
    assignmentsTbody.innerHTML = statusRow('Select a class to view assignments.');

    updateOnboardingState();
    return;
  }

    await refreshClassData();
  });
}

async function loadCreateClassButton() {

  const createClassButton =
    document.getElementById("create-class-button");

  if (!createClassButton) {
    return;
  }

  createClassButton.classList.add("hidden");

  if (addStudentButton) {
    addStudentButton.disabled = true;
    addStudentButton.classList.add("disabled");
  }


  if (!teacherProfileId) {
    return;
  }

  const { data: existingClass, error } =
    await supabaseClient
      .from("classes")
      .select("id")
      .eq("teacher_profile_id", teacherProfileId)
      .eq("is_active", true)
      .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!existingClass) {
    createClassButton.classList.remove("hidden");
  } else {
    if (addStudentButton) {
      addStudentButton.disabled = false;
      addStudentButton.classList.remove("disabled");
    }
  }
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
    .eq('active', true)
    .order('username');

  if (error) {
    console.error(error);
    studentsTbody.innerHTML = statusRow('Error loading students.');
    return;
  }

  lastStudents = students || [];

  if (studentsSubtitle) {
    studentsSubtitle.textContent = `${lastStudents.length}/30 students`;
  }


  if (!students?.length) {
    if (studentsSubtitle) {
      studentsSubtitle.textContent = '0/30 students';
    }

    studentsTbody.innerHTML = statusRow('No students in this class.');
    updateOnboardingState();
    return;
  }

  studentsTbody.innerHTML = students.map(s => {
    const name = s.profile?.display_name || s.username

    return `
    <tr>
      <td><span class="student-name-cell">${avatarEl(name)}${esc(name)}</span></td>
      <td>${esc(s.username)}</td>
      <td class="student-actions">
        <button
          class="cta-button sm"
          data-reset-pin="${esc(s.id)}"
          data-reset-name="${esc(name)}">
          Reset PIN
        </button>

        <button
          class="trash-btn"
          data-delete-student="${esc(s.id)}"
          data-delete-name="${esc(name)}"
          title="Delete student">
          🗑
        </button>
      </td>
    </tr>
`;
  }).join('');

  studentsTbody.querySelectorAll('[data-reset-pin]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetStudentPin(btn.dataset.resetPin, btn.dataset.resetName);
    });
});

studentsTbody.querySelectorAll('[data-delete-student]').forEach(btn => {
  btn.addEventListener('click', () => {
    deleteStudent(
      btn.dataset.deleteStudent,
      btn.dataset.deleteName
    );
  });
});

updateOnboardingState();

}


async function deleteStudent(studentId, displayName) {
  const bodyEl = document.getElementById('delete-student-body');
  const actionsEl = document.getElementById('delete-student-actions');

  bodyEl.innerHTML = `
    <p style="font-family:var(--font-body);font-size:clamp(14px,1.8vmin,17px);color:var(--ink);">
      Delete <b style="font-family:var(--font-ui)">${esc(displayName)}</b>?
      <br><br>
      This student will become inactive and will no longer appear in your roster.
    </p>
  `;

  actionsEl.innerHTML = `
    <button class="cta-button" data-close="modal-delete-student">Cancel</button>
    <button class="cta-button filled" id="confirm-delete-student-btn">Delete Student</button>
  `;

  openModal('modal-delete-student');

  actionsEl.querySelector('[data-close]').addEventListener('click', () => {
    closeModal('modal-delete-student');
  });

  actionsEl.querySelector('#confirm-delete-student-btn').addEventListener('click', async () => {
    bodyEl.innerHTML = `
      <div class="result-card loading">
        <div class="result-title">⏳ Working…</div>
        Deleting student…
      </div>
    `;

    actionsEl.innerHTML = '';

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/delete_student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ studentId })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        bodyEl.innerHTML = `
          <div class="result-card error">
            <div class="result-title">⚠️ Could not delete student</div>
            ${esc(data?.message || 'An unexpected error occurred.')}
          </div>
        `;

        actionsEl.innerHTML = `
          <button class="cta-button filled" data-close="modal-delete-student">Close</button>
        `;

        actionsEl.querySelector('[data-close]').addEventListener('click', () => {
          closeModal('modal-delete-student');
        });

        return;
      }

      bodyEl.innerHTML = `
        <div class="result-card success">
          <div class="result-title">✅ Student deleted</div>
          <div class="result-row-pair">
            <span>Student</span>
            <b>${esc(displayName)}</b>
          </div>
        </div>
      `;

      actionsEl.innerHTML = `
        <button class="cta-button filled" data-close="modal-delete-student">Done</button>
      `;

      actionsEl.querySelector('[data-close]').addEventListener('click', async () => {
        closeModal('modal-delete-student');
        await loadStudents(currentClassId);
      });

    } catch (err) {
      bodyEl.innerHTML = `
        <div class="result-card error">
          <div class="result-title">⚠️ Error</div>
          ${esc(err.message || 'Unexpected error.')}
        </div>
      `;

      actionsEl.innerHTML = `
        <button class="cta-button filled" data-close="modal-delete-student">Close</button>
      `;

      actionsEl.querySelector('[data-close]').addEventListener('click', () => {
        closeModal('modal-delete-student');
      });
    }
  });
}



/* Assignments */

async function loadAssignments(classId) {
  assignmentsTbody.innerHTML = statusRow('Loading assignments…');

  const { data: assignments, error } = await supabaseClient
    .from('assignments')
    .select('id, title, activity_type, target_sage_person, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    lastAssignments = [];
    lastProgressRows = [];
    assignmentsTbody.innerHTML = statusRow('Error loading assignments.');
    updateOnboardingState();
    return;
  }

  lastAssignments = assignments || [];

  if (!assignments?.length) {
    lastProgressRows = [];
    assignmentsTbody.innerHTML = statusRow('No assignments for this class yet.');
    updateOnboardingState();
    return;
  }

  const assignmentIds = assignments.map(a => a.id);

  const { data: progressRows, error: progressError } = await supabaseClient
    .from('assignment_progress')
    .select('assignment_id, student_id, correct_count, total_questions, status')
    .in('assignment_id', assignmentIds);

  lastProgressRows = progressRows || [];

  if (progressError) {
    console.error(progressError);
    lastProgressRows = [];
    assignmentsTbody.innerHTML = statusRow('Error loading assignment progress.');
    updateOnboardingState();
    return;
  }

  const progressByAssignment = {};

  for (const row of progressRows || []) {
    if (!progressByAssignment[row.assignment_id]) {
      progressByAssignment[row.assignment_id] = [];
    }

    progressByAssignment[row.assignment_id].push(row);
  }

  assignmentsTbody.innerHTML = assignments.map(a => {
    const rows = progressByAssignment[a.id] || [];

    const completedCount = rows.filter(r => r.status === 'completed').length;

    const scoredRows = rows.filter(r =>
      r.correct_count != null &&
      r.total_questions != null &&
      r.total_questions > 0
    );

    const avgScore = scoredRows.length
      ? `${Math.round(
          scoredRows.reduce((sum, r) => {
            return sum + (100 * r.correct_count / r.total_questions);
          }, 0) / scoredRows.length
        )}%`
      : '—';

    const dateText = a.created_at
      ? new Date(a.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : '—';

    const activityLabel = getActivityLabel(a.activity_type);

    const title =
      a.target_sage_person
        ? `${activityLabel} - ${a.target_sage_person}`
        : a.title || activityLabel;

    return `
      <tr>
        <td>
          <span style="display:flex;align-items:center;gap:0.5em;">
            <span class="assign-icon">📜</span>${esc(title)}
          </span>
        </td>
        <td class="num">${esc(completedCount)}</td>
        <td class="num">${esc(avgScore)}</td>
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
  updateOnboardingState();
}

async function showAssignmentDetail(assignmentId, title) {
  viewByAssignment?.classList.add('hidden');
  viewByStudent?.classList.add('hidden');
  assignmentDetail?.classList.remove('hidden');

  const titleEl = document.querySelector('.assign-detail-title');
  if (titleEl) {
    titleEl.innerHTML = `<span class="assign-icon">📜</span>${esc(title)}`;
  }

  assignmentDetailTbody.innerHTML = statusRow('Loading student results…');

  // Fetch students and their progress for this assignment in parallel
  const [studentsRes, progressRes] = await Promise.all([
    supabaseClient
      .from('students')
      .select('id, username, profile:profiles(display_name)')
      .eq('class_id', currentClassId)
      .eq('active', true)
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
    const name = s.profile?.display_name || s.username || 'Unknown';
    const p = progressByStudent[s.id];

    let chipHtml;
    if (!p) {
      chipHtml = `<span class="chip notstarted">○ Not Started</span>`;
    } else if (p.status === 'completed') {
      chipHtml = `<span class="chip completed">✓ Completed</span>`;
    } else {
      chipHtml = `<span class="chip progress">↻ In Progress</span>`;
    }

    const score =
  p?.correct_count != null &&
  p?.total_questions != null &&
  p.total_questions > 0
    ? `${Math.round(100 * p.correct_count / p.total_questions)}%`
    : '—';

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

    function hasAtLeastOneExpertise(sage) {
      return (
        Array.isArray(sage.expertise) &&
        sage.expertise.length > 0
      );
    }

    function hasCityOfPassing(sage) {
      return !!(
        sage.city_of_passing?.city ||
        sage.city?.city ||
        sage.city ||
        sage.passing_city ||
        sage.city_of_death
      );
    }

    const unique = [...new Map(
      sages
        .filter(s =>
          s?.person &&
          s?.birth != null &&
          s?.passing != null &&
          s?.background &&
          hasCityOfPassing(s) &&
          hasAtLeastOneExpertise(s)
        )
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
    const displayNameInput = document.getElementById('student-name');
    const usernameInput = document.getElementById('student-username');

    const displayName = displayNameInput?.value.trim();
    const username = usernameInput?.value.trim();
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

          <div class="result-row-pair">
            <span>Display name</span>
            <b>${esc(student.displayName || student.display_name || displayName)}</b>
          </div>

        <div class="result-row-pair">
          <span>Class code</span>
          <b>${esc(student.classCode || '—')}</b>
        </div>

        <div class="result-row-pair">
          <span>Username</span>
          <b>${esc(student.username || username)}</b>
        </div>

        <div class="result-row-pair">
          <span>PIN</span>
          <b>${esc(student.pin || student.tempPin || '—')}</b>
        </div>
        </div>
      `;

      if (displayNameInput) displayNameInput.value = '';
      if (usernameInput) usernameInput.value = '';
      await loadStudents(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message);
    }
  });
}



let lastCreatedBulkStudents = [];

function parseBulkStudentNames(rawText) {
  return String(rawText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter((name, index, arr) => {
      return arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index;
    });
}

function renderLoginCards(students) {
  const cardsEl = document.getElementById('bulk-login-cards');
  if (!cardsEl) return;

  cardsEl.innerHTML = students.map(student => `
    <div class="login-card">
      <div class="login-card-title">Sages For The Ages</div>

      <div class="login-card-name">
        ${esc(student.displayName)}
      </div>

      <div class="login-card-row">
        <span>Class Code</span>
        <b>${esc(student.classCode)}</b>
      </div>

      <div class="login-card-row">
        <span>Username</span>
        <b>${esc(student.username)}</b>
      </div>

      <div class="login-card-row">
        <span>PIN</span>
        <b class="pin-box">${esc(student.pin)}</b>
      </div>
    </div>
  `).join('');
}

function renderBulkSuccessMessage(classId, textarea, resultEl) {
  resultEl.innerHTML = `
    <div class="result-card success">
      <div class="result-title">✅ ${lastCreatedBulkStudents.length} student profiles created</div>

      <p style="margin-top:0.8vmin;">
        <b>Print these login cards now.</b>
        PINs cannot be viewed again after you leave this screen.
      </p>

      <div class="bulk-created-actions">
        <button class="cta-button filled" id="print-bulk-cards-btn" type="button">
          🖨 Print All Login Cards
        </button>

        <button class="cta-button" id="done-bulk-students-btn" type="button">
          Done
        </button>
      </div>
    </div>
  `;

  document.getElementById('print-bulk-cards-btn')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('done-bulk-students-btn')?.addEventListener('click', () => {
    resultEl.innerHTML = `
      <div class="result-card warning">
        <div class="result-title">⚠️ Before you close this screen</div>

        <p style="margin-top:0.8vmin;">
          Student PINs are shown only once. After you close this screen,
          you will not be able to view these PINs again.
        </p>

        <div class="bulk-created-actions">
          <button class="cta-button filled" id="print-bulk-cards-btn-2" type="button">
            🖨 Print Login Cards
          </button>

          <button class="cta-button" id="cancel-close-bulk-btn" type="button">
            Go Back
          </button>

          <button class="cta-button danger" id="confirm-close-bulk-btn" type="button">
            Close Anyway
          </button>
        </div>
      </div>
    `;

    document.getElementById('print-bulk-cards-btn-2')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('cancel-close-bulk-btn')?.addEventListener('click', () => {
      renderBulkSuccessMessage(classId, textarea, resultEl);
    });

    document.getElementById('confirm-close-bulk-btn')?.addEventListener('click', async () => {
      lastCreatedBulkStudents = [];
      textarea.value = '';
      resultEl.innerHTML = '';
      closeModal('modal-add-multiple-students');
      await loadStudents(classId);
    });
  });
}

function wireCreateBulkStudents() {
  const textarea = document.getElementById('bulk-student-names');
  const createBtn = document.getElementById('create-bulk-students-btn');
  const resultEl = document.getElementById('bulk-student-result');

  textarea?.addEventListener('input', () => {
    const names = parseBulkStudentNames(textarea.value);
    if (createBtn) {
      createBtn.textContent = names.length
        ? `Create ${names.length} Student Profile${names.length === 1 ? '' : 's'}`
        : 'Create Student Profiles';
    }
  });

  createBtn?.addEventListener('click', async () => {
    const classId = currentClassId;
    const names = parseBulkStudentNames(textarea?.value || '');

    if (!classId) {
      resultEl.innerHTML = errorCard(
        'No class selected',
        'Please select a class before adding students.'
      );
      return;
    }

    if (!names.length) {
      resultEl.innerHTML = errorCard(
        'No names entered',
        'Type or paste at least one student name.'
      );
      return;
    }

    const remainingSlots = 30 - lastStudents.length;

    if (names.length > remainingSlots) {
      resultEl.innerHTML = errorCard(
        'Too many students',
        `This class has ${lastStudents.length}/30 students. You can only add ${remainingSlots} more.`
      );
      return;
    }

    resultEl.innerHTML = loadingCard(`Creating ${names.length} student profiles…`);
    createBtn.disabled = true;

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/create_students_bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          classId,
          studentNames: names
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        resultEl.innerHTML = errorCard(
          'Students not created',
          data?.message || 'The student profiles could not be created.'
        );
        return;
      }

      lastCreatedBulkStudents = data.students || [];

      renderLoginCards(lastCreatedBulkStudents);

      renderBulkSuccessMessage(classId, textarea, resultEl);
  

      await loadStudents(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message || 'Unexpected error.');
    } finally {
      createBtn.disabled = false;
    }
  });
}

async function resetStudentPin(studentId, displayName) {
  const bodyEl = document.getElementById('reset-pin-body');
  const actionsEl = document.getElementById('reset-pin-actions');

  // Confirmation state
  bodyEl.innerHTML = `
    <p style="font-family:var(--font-body);font-size:clamp(14px,1.8vmin,17px);color:var(--ink);">
      Reset the PIN for <b style="font-family:var(--font-ui)">${esc(displayName)}</b>? 
      The old PIN will stop working immediately.
    </p>
  `;

  actionsEl.innerHTML = `
    <button class="cta-button" data-close="modal-reset-pin">Cancel</button>
    <button class="cta-button filled" id="confirm-reset-pin-btn">Reset PIN</button>
  `;

  openModal('modal-reset-pin');

  // Re-wire close button
  actionsEl.querySelector('[data-close]').addEventListener('click', () => {
    closeModal('modal-reset-pin');
  });

  // Confirm button
  actionsEl.querySelector('#confirm-reset-pin-btn').addEventListener('click', async () => {
    bodyEl.innerHTML = `
      <div class="result-card loading">
        <div class="result-title">⏳ Working…</div>
        Generating a new PIN…
      </div>
    `;
    actionsEl.innerHTML = '';

    try {
      const token = await getAccessToken();

      const res = await fetch('/api/reset_student_pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ studentId })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        bodyEl.innerHTML = `
          <div class="result-card error">
            <div class="result-title">⚠️ Could not reset PIN</div>
            ${esc(data?.message || 'An unexpected error occurred.')}
          </div>
        `;
        actionsEl.innerHTML = `
          <button class="cta-button filled" data-close="modal-reset-pin">Close</button>
        `;
        actionsEl.querySelector('[data-close]').addEventListener('click', () => {
          closeModal('modal-reset-pin');
        });
        return;
      }
      bodyEl.innerHTML = `
        <div class="result-card success">
          <div class="result-title">✅ PIN reset successfully</div>
          <div class="result-row-pair">
            <span>Student</span>
            <b>${esc(displayName)}</b>
          </div>
          <div class="result-row-pair">
            <span>New PIN</span>
            <b>${esc(data.pin)}</b>
          </div>
        </div>
      `;
      actionsEl.innerHTML = `
        <button class="cta-button filled" data-close="modal-reset-pin">Done</button>
      `;
      actionsEl.querySelector('[data-close]').addEventListener('click', () => {
        closeModal('modal-reset-pin');
      });

    } catch (err) {
      bodyEl.innerHTML = `
        <div class="result-card error">
          <div class="result-title">⚠️ Error</div>
          ${esc(err.message || 'Unexpected error.')}
        </div>
      `;
      actionsEl.innerHTML = `
        <button class="cta-button filled" data-close="modal-reset-pin">Close</button>
      `;
      actionsEl.querySelector('[data-close]').addEventListener('click', () => {
        closeModal('modal-reset-pin');
      });
    }
  });
}

/* Assign sage */


function wireAssignSage() {
  document.getElementById('assign-sage-btn')?.addEventListener('click', async () => {
    const classId = currentClassId;
    const targetSagePerson = document.getElementById('sage-select')?.value;
    const resultEl = document.getElementById('assign-game-result');

    const activityType =
  selectedAssignmentActivityType || ACTIVITY_TYPES.SAGE_SLEUTH;

const activityLabel = getActivityLabel(activityType);

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
          activityType
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
          <div class="result-row-pair"><span>Activity</span><b>${esc(activityLabel)}</b></div>
          <div class="result-row-pair"><span>Target sage</span><b>${esc(targetSagePerson)}</b></div>
        </div>
      `;

      await loadAssignments(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message);
    }
  });
}

function wireCreateClassButton() {
  document
    .getElementById("create-class-button")
    ?.addEventListener("click", () => {
      document.getElementById("new-class-name").value = "";
      document.getElementById("create-class-result").innerHTML = "";
      openModal("modal-create-class");
    });

  document
    .getElementById("confirm-create-class-btn")
    ?.addEventListener("click", async () => {
      const className = document.getElementById("new-class-name")?.value.trim();
      const resultEl = document.getElementById("create-class-result");

      if (!className) {
        resultEl.innerHTML = errorCard("Missing class name", "Please enter a class name.");
        return;
      }

      resultEl.innerHTML = loadingCard("Creating your class…");

      const token = await getAccessToken();

      const res = await fetch("/api/create_class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ className })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        resultEl.innerHTML = errorCard(
          "Class not created",
          data?.message || "Could not create class."
        );
        return;
      }

      const createdClass = data?.class || data || {};

      resultEl.innerHTML = `
        <div class="result-card success">
          <div class="result-title">✅ Class created</div>

          <div class="result-row-pair">
            <span>Class</span>
            <b>${esc(createdClass.class_name || className)}</b>
          </div>

          <div class="result-row-pair">
            <span>Class code</span>
            <b>${esc(createdClass.joinCode || createdClass.join_code || createdClass.class_code || '—')}</b>
          </div>
        </div>
      `;

      setTimeout(async () => {
        closeModal("modal-create-class");
        await loadCreateClassButton();
        await loadClasses();
      }, 900);
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