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

function normalizeClassName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isValidClassName(className) {
  return className.length >= 1 && className.length <= 50;
}

function generateJoinCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);

  let code = '';

  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }

  return code;
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const joinCode = generateJoinCode(6);

    const { data: existingClass, error } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('join_code', joinCode)
      .maybeSingle();

    if (error) {
      throw new Error('Failed to validate join code');
    }

    if (!existingClass) {
      return joinCode;
    }
  }

  throw new Error('Could not generate unique join code');
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

    const { className } = req.body ?? {};

    // 2. Validate class name
    const cleanClassName = normalizeClassName(className);

    if (!isValidClassName(cleanClassName)) {
      return res.status(400).json({
        success: false,
        message: 'Class name must be between 1 and 50 characters'
      });
    }

    // 3. Find teacher profile from authenticated caller
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
        message: 'Only teachers can create classes'
      });
    }

    // 4. Enforce one class per teacher
    const { data: existingClass, error: existingClassError } = await supabaseAdmin
      .from('classes')
      .select('id, class_name, join_code')
      .eq('teacher_profile_id', teacherProfile.id)
      .maybeSingle();

    if (existingClassError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing classes'
      });
    }

    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: 'You already have a class',
        class: {
          classId: existingClass.id,
          className: existingClass.class_name,
          joinCode: existingClass.join_code
        }
      });
    }

    // 5. Generate unique join code
    let joinCode;

    try {
      joinCode = await createUniqueJoinCode();
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate class join code'
      });
    }

    // 6. Create class
    const { data: classRow, error: classInsertError } = await supabaseAdmin
      .from('classes')
      .insert({
        teacher_profile_id: teacherProfile.id,
        class_name: cleanClassName,
        join_code: joinCode
      })
      .select('id, class_name, join_code, teacher_profile_id')
      .single();

    if (classInsertError || !classRow) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create class'
      });
    }

    // 7. Success
    return res.status(200).json({
      success: true,
      message: 'Class created successfully',
      class: {
        classId: classRow.id,
        className: classRow.class_name,
        joinCode: classRow.join_code
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed'
    });
  }
}