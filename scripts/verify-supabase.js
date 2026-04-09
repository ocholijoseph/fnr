import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = ['socials', 'donations', 'testimonies', 'prayer_requests', 'news', 'scroll', 'news_headlines'];

async function verifyTable(table) {
  try {
    const { data, error, status } = await supabase.from(table).select('*', { count: 'exact' });
    
    if (error) {
      console.error(`❌ ${table}: ${error.message}`);
      return false;
    }
    
    const recordCount = data ? data.length : 0;
    console.log(`✅ ${table}: ${recordCount} records`);
    return true;
  } catch (error) {
    console.error(`❌ ${table}: ${error.message}`);
    return false;
  }
}

async function verify() {
  console.log('Verifying Supabase tables...\n');
  
  let allGood = true;
  for (const table of tables) {
    const ok = await verifyTable(table);
    allGood = allGood && ok;
  }
  
  if (allGood) {
    console.log('\n✅ All Supabase tables verified successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tables could not be verified.');
    process.exit(1);
  }
}

verify();
