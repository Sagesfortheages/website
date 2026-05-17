import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
        message: 'Not logged in.'
      });
    }

    const { data: userData, error: userError } =
      await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login session.'
      });
    }

    const userId = userData.user.id;
    const { studentId } = req.body ?? {};

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing studentId.'
      });
    }

    // 1. Confirm logged-in user is a teacher profile
    const { data: teacherProfile, error: teacherError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('auth_user_id', userId)
        .eq('role', 'teacher')
        .single();

    if (teacherError || !teacherProfile) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can delete students.'
      });
    }

    const teacherProfileId = teacherProfile.id;

    // 2. Confirm this student belongs to one of this teacher's classes
    const { data: student, error: studentError } =
      await supabaseAdmin
        .from('students')
        .select(`
          id,
          class:classes!inner (
            id,
            teacher_profile_id
          )
        `)
        .eq('id', studentId)
        .eq('classes.teacher_profile_id', teacherProfileId)
        .single();

    if (studentError || !student) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this student.'
      });
    }

    // 3. Soft delete student
    const { error: deleteError } =
      await supabaseAdmin
        .from('students')
        .update({ active: false })
        .eq('id', studentId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: deleteError.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Student deleted.'
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error.'
    });
  }
}