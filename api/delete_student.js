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

    // =========================
    // 1. Get auth token
    // =========================

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not logged in.'
      });
    }

    // =========================
    // 2. Verify logged-in user
    // =========================

    const { data: userData, error: userError } =
      await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login session.'
      });
    }

    const userId = userData.user.id;

    // =========================
    // 3. Get student id
    // =========================

    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing studentId.'
      });
    }

    // =========================
    // 4. Find teacher record
    // =========================

    const { data: teacher, error: teacherError } =
      await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (teacherError || !teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can delete students.'
      });
    }

    const teacherId = teacher.id;

    // =========================
    // 5. Verify ownership
    // =========================

    const { data: student, error: studentError } =
      await supabaseAdmin
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('teacher_id', teacherId)
        .single();

    if (studentError || !student) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this student.'
      });
    }

    // =========================
    // 6. Soft delete student
    // =========================

    const { error: deleteError } =
      await supabaseAdmin
        .from('students')
        .update({
          active: false
        })
        .eq('id', studentId)
        .eq('teacher_id', teacherId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: deleteError.message
      });
    }

    // =========================
    // 7. Success
    // =========================

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