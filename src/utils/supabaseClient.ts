/**
 * Supabase Client for Frontend Auth
 */

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const SUPABASE_ANON_KEY = publicAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
