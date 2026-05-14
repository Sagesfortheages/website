import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makePin() {
  const bytes = crypto.randomBytes(6);
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += (bytes[i] % 10).toString();
  }
  return pin;
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not logged in'
      });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing studentId'
      });
    }

    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (teacherError || !teacherProfile) {
      return res.status(403).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        class_id,
        profile:profiles(
          id,
          auth_user_id
        )
      `)
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student lookup error:', studentError);

      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const { data: classRow, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, teacher_profile_id')
      .eq('id', student.class_id)
      .single();

    if (classError || !classRow) {
      console.error('Class lookup error:', classError);

      return res.status(404).json({
        success: false,
        message: 'Class not found for this student'
      });
    }

    if (classRow.teacher_profile_id !== teacherProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to reset this student’s PIN'
      });
    }

    const studentAuthUserId = student.profile?.auth_user_id;

    if (!studentAuthUserId) {
      return res.status(400).json({
        success: false,
        message: 'This student profile does not have an auth_user_id'
      });
    }

    const newPin = makePin();

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(studentAuthUserId, {
        password: newPin
      });

    if (updateError) {
      console.error('PIN reset error:', updateError);

      return res.status(500).json({
        success: false,
        message: updateError.message
      });
    }

    return res.status(200).json({
      success: true,
      pin: newPin
    });

  } catch (err) {
    console.error('Unexpected reset PIN error:', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Unexpected error'
    });
  }
}