import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    const { data: { user }, error: authError } =
      await supabaseAuth.auth.getUser(accessToken);

    if (authError || !user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const { classId, targetSagePerson, activityType } = req.body ?? {};

    const parsedClassId = Number(classId);
    const cleanTargetSagePerson = String(targetSagePerson || '').trim();
    const cleanActivityType = String(activityType || 'mystery_sage').trim();

    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid classId' });
    }

    if (!cleanTargetSagePerson) {
      return res.status(400).json({ success: false, message: 'Missing target sage' });
    }

    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single();

    if (teacherError || !teacherProfile || teacherProfile.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can create assignments'
      });
    }

    const { data: classRow, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, class_name, teacher_profile_id')
      .eq('id', parsedClassId)
      .single();

    if (classError || !classRow) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classRow.teacher_profile_id !== teacherProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'That class does not belong to this teacher'
      });
    }

    const title = `Mystery Sage: ${cleanTargetSagePerson}`;

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('assignments')
      .insert({
        class_id: parsedClassId,
        teacher_profile_id: teacherProfile.id,
        activity_type: cleanActivityType,
        target_sage_person: cleanTargetSagePerson,
        title,
        status: 'active'
      })
      .select('id, class_id, activity_type, target_sage_person, title, status, created_at')
      .single();

if (assignmentError || !assignment) {
  return res.status(500).json({
    success: false,
    message: 'Failed to create assignment',
    error: assignmentError?.message,
    details: assignmentError?.details,
    hint: assignmentError?.hint,
    code: assignmentError?.code
  });
}

    return res.status(200).json({
      success: true,
      message: 'Assignment created',
      assignment: {
        id: assignment.id,
        classId: assignment.class_id,
        className: classRow.class_name,
        activityType: assignment.activity_type,
        targetSagePerson: assignment.target_sage_person,
        title: assignment.title,
        status: assignment.status
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed',
      error: err?.message || String(err)
    });
  }
}