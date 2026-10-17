import { supabase, dbService } from './db.js';

async function verifyCredentialsTable() {
  console.log('--- Checking Supabase public.user_credentials Table ---');
  
  // 1. Check if we can select from user_credentials
  const { data: credRows, error: selErr } = await supabase
    .from('user_credentials')
    .select('user_id, created_at, updated_at');

  if (selErr) {
    console.error('❌ SELECT error on user_credentials:', selErr.message);
  } else {
    console.log(`✅ user_credentials table is readable. Current row count: ${credRows.length}`);
  }

  // 2. Test insert/upsert permissions
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, bridge_account, full_name, email')
    .limit(1);

  if (profErr || !profiles || profiles.length === 0) {
    console.log('ℹ️ No profile found to test upsert.');
    return;
  }

  const testUser = profiles[0];
  console.log(`Testing credential write for profile: ${testUser.bridge_account} (${testUser.id})...`);

  // Try saving via dbService.updateUserPasswordHash
  const dummyHash = '$2a$10$testdummyhashonlyforverification1234567890abcdefghij';
  
  const { error: insErr } = await supabase
    .from('user_credentials')
    .upsert({
      user_id: testUser.id,
      password_hash: dummyHash,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (insErr) {
    console.error('❌ INSERT/UPSERT blocked on user_credentials:', insErr.message);
    console.log('👉 Action needed: Run supabase/migration_enable_user_credentials_storage.sql in the Supabase SQL Editor!');
  } else {
    console.log('✅ INSERT/UPSERT succeeded! Rows can now be written into user_credentials.');
  }
}

verifyCredentialsTable().catch(console.error);
