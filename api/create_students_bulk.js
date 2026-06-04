import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default function handler(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Bulk API route is alive with imports',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    randomTest: crypto.randomUUID()
  });
}