// src/supabaseClient.js
// Shared Supabase client. Extracted from MainApp.js so services can import
// `supabase` without pulling in MainApp's React tree — that dependency chain
// was preventing the login-screen bundle from being split from the app shell.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Prewarm Supabase on app start
supabase
  .from('zip_codes')
  .select('zip_code')
  .limit(1)
  .then(() => console.log('Supabase prewarm complete'))
  .catch((err) => console.error('Prewarm error:', err));
