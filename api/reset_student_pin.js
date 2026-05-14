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

function generateSecurePin(length = 6) {
  const bytes = crypto.randomBytes(length);
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += (bytes[i] % 10).toString();
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
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    // 1. Extract and validate bearer token
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    // 2. Authenticate the caller via anon client
    const { data: { user: callerUser }, error: callerAuthError } =
      await supabaseAuth.auth.getUser(accessToken);

    if (callerAuthError || !callerUser) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // 3. Validate studentId input
    const { studentId } = req.body ?? {};
    const parsedStudentId = Number(studentId);
    if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid studentId' });
    }

    // 4. Verify caller is a teacher
    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', callerUser.id)
      .single();

    if (teacherError || !teacherProfile) {
      return res.status(403).json({ success: false, message: 'Teacher profile not found' });
    }

    if (teacherProfile.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can reset student PINs' });
    }

    // 5. Look up the student and their auth user ID
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, class_id, profile:profiles(id, auth_user_id)')
      .eq('id', parsedStudentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 6. Verify the student's class belongs to this teacher
    const { data: classRow, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, teacher_profile_id')
      .eq('id', student.class_id)
      .single();

    if (classError || !classRow) {
      return res.status(404).json({ success: false, message: 'Class not found for this student' });
    }

    if (classRow.teacher_profile_id !== teacherProfile.id) {
      return res.status(403).json({ success: false, message: 'You are not allowed to reset this student\'s PIN' });
    }

    // 7. Ensure we have an auth user to update
    const studentAuthUserId = student.profile?.auth_user_id;
    if (!studentAuthUserId) {
      return res.status(400).json({ success: false, message: 'Student profile is missing an auth user' });
    }

    // 8. Generate and apply new PIN
    const newPin = generateSecurePin(6);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      studentAuthUserId,
      { password: newPin }
    );

    if (updateError) {
      return res.status(500).json({ success: false, message: 'Failed to reset PIN' });
    }

    // 9. Success
    return res.status(200).json({ success: true, pin: newPin });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Function failed' });
  }
}