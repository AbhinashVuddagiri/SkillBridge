import { supabase, dbService } from './db.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('  [PASS]', msg);
    passed++;
  } else {
    console.error('  [FAIL]', msg);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('SKILLBRIDGE VERIFICATION: EXPLORE SKILLS & REGISTRATION TEXT');
  console.log('================================================================');

  console.log('\n1. CHANGE 1: Explore Skills Profiles Discovery');
  const allUsers = await dbService.getExploreUsers(null);
  assert(Array.isArray(allUsers), 'dbService.getExploreUsers returns array');
  assert(allUsers.length >= 2, `Returns all existing registered users (count: ${allUsers.length})`);

  const sankar = allUsers.find(u => u.bridgeAccount?.toLowerCase() === 'sankar');
  assert(!!sankar, 'Found existing user Bhavani Sankaram Boddu (@Sankar)');
  if (sankar) {
    assert(sankar.name === 'Bhavani Sankaram Boddu', `Sankar full name is correct: ${sankar.name}`);
    assert(sankar.instituteName === 'Vsvt', `Sankar institute is correct: ${sankar.instituteName}`);
    assert(!!sankar.avatar, 'Sankar avatar is present');
    assert(Array.isArray(sankar.skillsTeach), 'Sankar skillsTeach is an array');
    assert(Array.isArray(sankar.skillsLearn), 'Sankar skillsLearn is an array');
  }

  const abhi = allUsers.find(u => u.bridgeAccount?.toLowerCase() === 'abhi');
  assert(!!abhi, 'Found existing user Abhinash (@abhi)');
  if (abhi) {
    assert(abhi.name === 'Abhinash', `Abhinash full name is correct: ${abhi.name}`);
    assert(abhi.instituteName === 'niat', `Abhinash institute is correct: ${abhi.instituteName}`);
    assert(!!abhi.avatar, 'Abhinash avatar is present');
    assert(Array.isArray(abhi.skillsTeach), 'Abhinash skillsTeach is an array');
    assert(Array.isArray(abhi.skillsLearn), 'Abhinash skillsLearn is an array');
  }

  console.log('\n2. CHANGE 1: Current User Exclusion (Self-Profile Filter)');
  if (abhi && sankar) {
    const forAbhi = await dbService.getExploreUsers(abhi.id);
    assert(!forAbhi.some(u => u.id === abhi.id), 'Currently logged-in user (Abhinash) is excluded from own explore list');
    assert(forAbhi.some(u => u.id === sankar.id), 'Other user (Sankar) is visible to Abhinash');

    const forSankar = await dbService.getExploreUsers(sankar.id);
    assert(!forSankar.some(u => u.id === sankar.id), 'Currently logged-in user (Sankar) is excluded from own explore list');
    assert(forSankar.some(u => u.id === abhi.id), 'Other user (Abhinash) is visible to Sankar');
  }

  console.log('\n3. CHANGE 1: Search Filtering');
  const searchSankar = await dbService.getExploreUsers(null, 'sankar');
  assert(searchSankar.length === 1 && searchSankar[0].id === sankar?.id, 'Search by username "sankar" returns only Sankar');

  const searchVsvt = await dbService.getExploreUsers(null, 'vsvt');
  assert(searchVsvt.length >= 1 && searchVsvt.every(u => u.instituteName.toLowerCase().includes('vsvt')), 'Search by institute "vsvt" matches users with institute Vsvt');

  const searchAbhi = await dbService.getExploreUsers(null, 'abhi');
  assert(searchAbhi.length === 1 && searchAbhi[0].id === abhi?.id, 'Search by username "abhi" returns only Abhinash');

  const searchNiat = await dbService.getExploreUsers(null, 'niat');
  assert(searchNiat.length >= 1 && searchNiat.every(u => u.instituteName.toLowerCase().includes('niat')), 'Search by institute "niat" matches users with institute niat');

  const searchNone = await dbService.getExploreUsers(null, 'nonexistent_skill_quantum_computing_xyz');
  assert(searchNone.length === 0, 'Non-matching search returns 0 profiles');

  console.log('\n4. CHANGE 2: Registration Description Text');
  const fs = await import('fs');
  const authModalContent = fs.readFileSync('client/src/components/AuthModal.jsx', 'utf8');
  assert(
    authModalContent.includes('6 digit OTP is sent to your mail account'),
    'AuthModal.jsx includes exact string "6 digit OTP is sent to your mail account"'
  );
  assert(
    !authModalContent.includes('A 6-digit OTP will be sent to your Gmail via Supabase Auth for identity verification.'),
    'Old description text has been removed completely'
  );

  console.log('\n5. Invariant Checks');
  assert(allUsers.length >= 2, `All legitimate registered users preserved (count: ${allUsers.length})`);

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
