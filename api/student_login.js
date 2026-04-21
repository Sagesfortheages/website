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

function normalizeClassCode(value) {
  return String(value || '')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const { classCode, username, pin } = req.body ?? {};

    const cleanClassCode = normalizeClassCode(classCode);
    const cleanUsername = normalizeUsername(username);
    const cleanPin = String(pin || '').trim();

    if (!cleanClassCode || !cleanUsername || !cleanPin) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // 1. Find the matching student and placeholder email
    const { data: studentRow, error: studentLookupError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        username,
        placeholder_email,
        active,
        profile_id,
        classes!inner (
          id,
          join_code
        )
      `)
      .eq('username', cleanUsername)
      .eq('classes.join_code', cleanClassCode)
      .single();

    if (studentLookupError || !studentRow) {
      return res.status(401).json({
        success: false,
        message: 'Invalid class code, username, or PIN'
      });
    }

    if (!studentRow.active) {
      return res.status(403).json({
        success: false,
        message: 'This student account is inactive'
      });
    }

    // 2. Sign in with placeholder email + PIN
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: studentRow.placeholder_email,
      password: cleanPin
    });

    if (signInError || !signInData?.session || !signInData?.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid class code, username, or PIN'
      });
    }

    // 3. Optional safety check: verify logged-in user is actually a student
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('auth_user_id', signInData.user.id)
      .single();

    if (profileError || !profileRow || profileRow.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'This account is not authorized as a student'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed'
    });
  }
}