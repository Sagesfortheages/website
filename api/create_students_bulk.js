import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;

  return authHeader.slice('Bearer '.length).trim();
}

function normalizeDisplayName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
}

function generateSecurePin(length = 6) {
  const bytes = crypto.randomBytes(length);
  let pin = '';

  for (let i = 0; i < length; i++) {
    pin += (bytes[i] % 10).toString();
  }

  return pin;
}

function makeUniqueUsername(displayName, usedUsernames) {
  let base = normalizeUsername(displayName);

  if (base.length < 3) {
    base = `student_${crypto.randomInt(1000, 9999)}`;
  }

  let candidate = base;
  let counter = 2;

  while (usedUsernames.has(candidate)) {
    const suffix = `_${counter}`;
    candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    counter++;
  }

  usedUsernames.add(candidate);
  return candidate;
}

async function createOneStudent({ classId, displayName, username, classRow }) {
  const pin = generateSecurePin(6);
  const tempEmail = `student_${crypto.randomUUID()}@students.sfta.local`;

  const { data: authResult, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: tempEmail,
      password: `Sfta${pin}!`,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        display_name: displayName
      }
    });

  if (authError || !authResult?.user) {
    throw new Error(`Failed to create auth user for ${displayName}`);
  }

  const authUserId = authResult.user.id;

  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      auth_user_id: authUserId,
      role: 'student',
      display_name: displayName
    })
    .select('id')
    .single();

  if (profileError || !profileRow) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed to create profile row for ${displayName}`);
  }

  const { data: studentRow, error: studentError } = await supabaseAdmin
    .from('students')
    .insert({
      profile_id: profileRow.id,
      class_id: classId,
      username,
      placeholder_email: tempEmail,
      active: true
    })
    .select('id, username')
    .single();

  if (studentError || !studentRow) {
    await supabaseAdmin.from('profiles').delete().eq('id', profileRow.id);
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed to create student row for ${displayName}`);
  }

  const stableEmail = `student_${studentRow.id}@students.sfta.local`;

  const { error: authUpdateError } =
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      email: stableEmail
    });

  if (authUpdateError) {
    throw new Error(`Final email setup failed for ${displayName}`);
  }

  const { error: studentUpdateError } = await supabaseAdmin
    .from('students')
    .update({ placeholder_email: stableEmail })
    .eq('id', studentRow.id);

  if (studentUpdateError) {
    throw new Error(`Student email record update failed for ${displayName}`);
  }

  return {
    studentId: studentRow.id,
    displayName,
    username,
    pin,
    classCode: classRow.join_code,
    className: classRow.class_name
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.SUPABASE_ANON_KEY
    ) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Missing bearer token'
      });
    }

    const {
      data: { user: callerUser },
      error: callerAuthError
    } = await supabaseAuth.auth.getUser(accessToken);

    if (callerAuthError || !callerUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const { classId, studentNames } = req.body ?? {};

    const parsedClassId = Number(classId);

    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId'
      });
    }

    const cleanNames = Array.isArray(studentNames)
      ? studentNames
          .map(normalizeDisplayName)
          .filter(Boolean)
          .filter((name, index, arr) =>
            arr.findIndex(n => n.toLowerCase() === name.toLowerCase()) === index
          )
      : [];

    if (!cleanNames.length) {
      return res.status(400).json({
        success: false,
        message: 'No student names provided'
      });
    }

    if (cleanNames.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'You can add at most 20 students at a time'
      });
    }

    const tooLong = cleanNames.find(name => name.length > 50);

    if (tooLong) {
      return res.status(400).json({
        success: false,
        message: `Student name is too long: ${tooLong}`
      });
    }

    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, auth_user_id')
      .eq('auth_user_id', callerUser.id)
      .single();

    if (teacherError || !teacherProfile) {
      return res.status(403).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    if (teacherProfile.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can create students'
      });
    }

    const { data: classRow, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, join_code, teacher_profile_id, class_name')
      .eq('id', parsedClassId)
      .single();

    if (classError || !classRow) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    if (classRow.teacher_profile_id !== teacherProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'That class does not belong to this teacher'
      });
    }

    const { data: existingStudents, error: existingStudentsError } =
      await supabaseAdmin
        .from('students')
        .select('id, username')
        .eq('class_id', parsedClassId)
        .eq('active', true);

    if (existingStudentsError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing students'
      });
    }

    const activeStudentCount = existingStudents?.length || 0;

    if (activeStudentCount + cleanNames.length > 20) {
      return res.status(403).json({
        success: false,
        message: `This class has ${activeStudentCount}/20 students. You can only add ${20 - activeStudentCount} more.`
      });
    }

    const usedUsernames = new Set(
      (existingStudents || []).map(s => String(s.username || '').toLowerCase())
    );

    const studentsToCreate = cleanNames.map(displayName => ({
      displayName,
      username: makeUniqueUsername(displayName, usedUsernames)
    }));

    const createdStudents = [];

    for (const student of studentsToCreate) {
      const created = await createOneStudent({
        classId: parsedClassId,
        displayName: student.displayName,
        username: student.username,
        classRow
      });

      createdStudents.push(created);
    }

    return res.status(200).json({
      success: true,
      message: 'Students created successfully',
      students: createdStudents
    });

  } catch (err) {
    console.error('create_students_bulk error:', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Function failed'
    });
  }
}