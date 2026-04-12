import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // 1) Require secret header
    const providedSecret = req.headers['x-debug-secret'];

    if (providedSecret !== process.env.DEBUG_ROUTE_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    // 2) Connect to Supabase with service role
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3) Minimal smoke test
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase connection failed'
      });
    }

    // 4) Success
    return res.status(200).json({
      success: true,
      message: 'Vercel + Supabase working'
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Function failed'
    });
  }
}