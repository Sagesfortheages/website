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
        <span>Username</span>
        <b>${esc(student.username)}</b>
      </div>

      <div class="login-card-row">
        <span>Class Code</span>
        <b>${esc(student.classCode)}</b>
      </div>

      <div class="login-card-row">
        <span>PIN</span>
        <b class="pin-box">${esc(student.pin)}</b>
      </div>
    </div>
  `).join('');
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

    const remainingSlots = 20 - lastStudents.length;

    if (names.length > remainingSlots) {
      resultEl.innerHTML = errorCard(
        'Too many students',
        `This class has ${lastStudents.length}/20 students. You can only add ${remainingSlots} more.`
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

      document.getElementById('done-bulk-students-btn')?.addEventListener('click', async () => {
        const ok = confirm(
          'Leave this screen? Student PINs cannot be viewed again after you close it.'
        );

        if (!ok) return;

        lastCreatedBulkStudents = [];
        textarea.value = '';
        resultEl.innerHTML = '';
        closeModal('modal-add-multiple-students');
        await loadStudents(classId);
      });

      await loadStudents(classId);

    } catch (err) {
      resultEl.innerHTML = errorCard('Error', err.message || 'Unexpected error.');
    } finally {
      createBtn.disabled = false;
    }
  });
}