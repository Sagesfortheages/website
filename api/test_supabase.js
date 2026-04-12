import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const providedSecret = req.headers['x-debug-secret'];

    if (providedSecret !== process.env.DEBUG_ROUTE_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({
        success: false,
        message: 'Missing SUPABASE_URL'
      });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Missing SUPABASE_SERVICE_ROLE_KEY'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase query failed',
        error: error.message,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vercel + Supabase working',
      rowsReturned: data?.length ?? 0
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed',
      error: err?.message || String(err)
    });
  }
}