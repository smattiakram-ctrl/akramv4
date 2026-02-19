import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://flshtvylpvljyhpylweh.supabase.co';
const supabaseKey = 'sb_publishable_vd4QKYTDpmORhUT0dHug9g_gOlhSQ8H';

export const supabase = createClient(supabaseUrl, supabaseKey);
