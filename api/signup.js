import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidRole(role) {
  return role === 'user' || role === 'teacher' || role === 'student';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const {
      email,
      password,
      isTeacher,
      teacherJoinCode
    } = req.body || {};

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanTeacherJoinCode = String(teacherJoinCode || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    let role = 'user';

    if (isTeacher === true) {
      if (cleanTeacherJoinCode !== process.env.TEACHER_JOIN_CODE) {
        return res.status(403).json({
          success: false,
          message: 'Invalid teacher join code.'
        });
      }

      role = 'teacher';
    }

    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type.'
      });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true
      });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    const user = authData.user;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        auth_user_id: user.id,
        role
      });

    if (profileError) {
      return res.status(500).json({
        success: false,
        message: profileError.message
      });
    }

    return res.status(200).json({
      success: true,
      message: role === 'teacher'
        ? 'Teacher account created.'
        : 'Account created.',
      role
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong.'
    });
  }
}