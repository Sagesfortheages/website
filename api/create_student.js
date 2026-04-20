import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function normalizeDisplayName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function generateSecurePin(length = 6) {
  const digits = new Uint32Array(length);
  crypto.getRandomValues(digits);

  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += (digits[i] % 10).toString();
  }
  return pin;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;

  return authHeader.slice('Bearer '.length).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
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

    // 1. Authenticate the caller
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

    const { classId, displayName, username } = req.body ?? {};

    // 2. Validate classId (int8 / bigint in DB)
    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId'
      });
    }

    // 3. Validate displayName
    const cleanDisplayName = normalizeDisplayName(displayName);
    if (!cleanDisplayName || cleanDisplayName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Display name must be between 1 and 50 characters'
      });
    }

    // 4. Validate username
    const cleanUsername = normalizeUsername(username);
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters and use only lowercase letters, numbers, or underscores'
      });
    }

    // 5. Find teacher profile from the real authenticated caller
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

    // 6. Verify class belongs to this teacher
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

    // 7. Ensure username is unique within class
    const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('class_id', parsedClassId)
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingStudentError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to validate username'
      });
    }

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'That username already exists in this class'
      });
    }

    // 8. Generate secure PIN and temporary placeholder email
    const pin = generateSecurePin(6);
    const tempEmail = `student_${crypto.randomUUID()}@students.sfta.local`;

    // 9. Create auth user
    const { data: authResult, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: tempEmail,
        password: pin,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          display_name: cleanDisplayName
        }
      });

    if (authError || !authResult?.user) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create auth user'
      });
    }

    const authUserId = authResult.user.id;

    // 10. Create profile row
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        role: 'student',
        display_name: cleanDisplayName
      })
      .select('id')
      .single();

    if (profileError || !profileRow) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return res.status(500).json({
        success: false,
        message: 'Failed to create profile row'
      });
    }

    // 11. Create student row with temporary placeholder email
    const { data: studentRow, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        profile_id: profileRow.id,
        class_id: parsedClassId,
        username: cleanUsername,
        placeholder_email: tempEmail,
        active: true
      })
      .select('id, username')
      .single();

    if (studentError || !studentRow) {
      await supabaseAdmin.from('profiles').delete().eq('id', profileRow.id);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return res.status(500).json({
        success: false,
        message: 'Failed to create student row'
      });
    }

    // 12. Finalize stable email based on student.id
    const stableEmail = `student_${studentRow.id}@students.sfta.local`;

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email: stableEmail
      });

    if (authUpdateError) {
      return res.status(500).json({
        success: false,
        message: 'Student created, but final email setup failed. Manual cleanup may be needed.'
      });
    }

    const { error: studentUpdateError } = await supabaseAdmin
      .from('students')
      .update({ placeholder_email: stableEmail })
      .eq('id', studentRow.id);

    if (studentUpdateError) {
      return res.status(500).json({
        success: false,
        message: 'Student created, but student email record update failed. Manual cleanup may be needed.'
      });
    }

    // 13. Success
    return res.status(200).json({
      success: true,
      message: 'Student created successfully',
      student: {
        studentId: studentRow.id,
        displayName: cleanDisplayName,
        username: cleanUsername,
        pin,
        classCode: classRow.join_code,
        className: classRow.class_name
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed'
    });
  }
}