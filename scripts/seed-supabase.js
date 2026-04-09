import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function readJsonFile(fileName) {
  const filePath = path.resolve(__dirname, '..', fileName);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read ${fileName}:`, error.message);
    return null;
  }
}

const missingTables = new Set();

const tableDdls = {
  socials: `CREATE TABLE IF NOT EXISTS public.socials (
  id text PRIMARY KEY,
  platform text,
  url text,
  enabled boolean
);`,
  donations: `CREATE TABLE IF NOT EXISTS public.donations (
  id text PRIMARY KEY,
  name text,
  email text,
  amount text,
  reference text,
  created_at timestamptz
);`,
  testimonies: `CREATE TABLE IF NOT EXISTS public.testimonies (
  id text PRIMARY KEY,
  content jsonb,
  created_at timestamptz
);`,
  prayer_requests: `CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id text PRIMARY KEY,
  content jsonb,
  created_at timestamptz
);`,
  news: `CREATE TABLE IF NOT EXISTS public.news (
  id text PRIMARY KEY,
  title text,
  content text,
  status text,
  pinned boolean,
  created_at timestamptz,
  updated_at timestamptz
);`,
  scroll: `CREATE TABLE IF NOT EXISTS public.scroll (
  id text PRIMARY KEY,
  override_enabled boolean,
  override_message text,
  scroll_type text
);`,
  news_headlines: `CREATE TABLE IF NOT EXISTS public.news_headlines (
  id text PRIMARY KEY,
  title text,
  source text,
  summary text,
  url text,
  timestamp timestamptz,
  provider text,
  region text,
  fetched_at timestamptz
);`
};

function isMissingTableError(error) {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('does not exist') || msg.includes('relation') && msg.includes('does not exist');
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function transformKeysToSnakeCase(obj) {
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    newObj[snakeKey] = value;
  }
  return newObj;
}

async function upsertRows(table, rows) {
  if (!Array.isArray(rows)) {
    console.warn(`Skipping ${table}: expected array but got ${typeof rows}`);
    return false;
  }
  if (rows.length === 0) {
    console.log(`No records to seed for ${table}.`);
    return false;
  }
  const transformedRows = rows.map(row => transformKeysToSnakeCase(row));
  const { error } = await supabase.from(table).upsert(transformedRows, { onConflict: 'id' });
  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add(table);
      console.warn(`Skipping ${table}: table does not exist in Supabase.`);
      return false;
    }
    throw new Error(`Supabase upsert failed for ${table}: ${error.message}`);
  }
  return true;
}

async function upsertRow(table, row) {
  const transformedRow = transformKeysToSnakeCase(row);
  const { error } = await supabase.from(table).upsert([transformedRow], { onConflict: 'id' });
  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add(table);
      console.warn(`Skipping ${table}: table does not exist in Supabase.`);
      return false;
    }
    throw new Error(`Supabase upsert failed for ${table}: ${error.message}`);
  }
  return true;
}

async function seed() {
  console.log('Starting Supabase seed...');

  const socials = await readJsonFile('socials.json');
  await upsertRows('socials', socials || []);

  const donations = await readJsonFile('donations.json');
  await upsertRows('donations', donations || []);

  const testimonies = await readJsonFile('testimonies.json');
  await upsertRows('testimonies', testimonies || []);

  const prayerRequests = await readJsonFile('prayer_requests.json');
  await upsertRows('prayer_requests', prayerRequests || []);

  const news = await readJsonFile('news.json');
  await upsertRows('news', news || []);

  const scroll = await readJsonFile('scroll.json');
  if (scroll) {
    const row = { id: 'scroll-config', ...scroll };
    const success = await upsertRow('scroll', row);
    if (success) {
      console.log('Seeded scroll config into scroll');
    }
  }

  const headlinesCache = await readJsonFile('headlines_cache.json');
  if (headlinesCache && Array.isArray(headlinesCache.headlines)) {
    const success = await upsertRows('news_headlines', headlinesCache.headlines);
    if (success) {
      console.log(`Seeded ${headlinesCache.headlines.length} news_headlines records`);
    }
  }

  if (missingTables.size > 0) {
    console.error('\nSupabase seed completed with missing tables:');
    for (const table of missingTables) {
      console.error(`- ${table}`);
    }
    console.error('\nCreate the missing tables in Supabase before re-running the seed script.');
    console.error('Suggested DDL statements:');
    for (const table of missingTables) {
      console.error(`\n-- ${table}\n${tableDdls[table] || 'No DDL available.'}`);
    }
    process.exit(1);
  }

  console.log('Supabase seed completed successfully.');
}

seed().catch((error) => {
  console.error('Supabase seed failed:', error.message || error);
  process.exit(1);
});
