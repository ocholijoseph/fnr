import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkHeadlines() {
  const { data, error } = await supabase
    .from('news_headlines')
    .select('id, provider, title, summary')
    .eq('id', 'newsapi-1775549611893-3x7yum');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated headline:');
  console.log(data[0]);
}

checkHeadlines();