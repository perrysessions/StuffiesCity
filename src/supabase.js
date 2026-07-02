import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const IS_CONFIGURED =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' &&
  SUPABASE_URL.startsWith('http');

// Only create client when properly configured; otherwise export a stub
export const supabase = IS_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
