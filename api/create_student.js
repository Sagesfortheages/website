export default async function handler(req, res) {
  try {
    const cryptoModule = await import('crypto');
    const { createClient } = await import('@supabase/supabase-js');

    const crypto = cryptoModule.default || cryptoModule;

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

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