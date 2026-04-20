import crypto from 'crypto';
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
  try {
    return res.status(200).json({
      success: true,
      stage: 'imports_and_clients_ok'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      stage: 'imports_and_clients_ok',
      error: err?.message || String(err)
    });
  }
}