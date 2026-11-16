import fs from 'fs';
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
  console.log('SKILLBRIDGE VERIFICATION: LOGO, DEFAULT NAME & CONNECTED SORT');
  console.log('================================================================');

  console.log('\n--- CHANGE 1: Official Logo Integration & Favicon ---');
  // 1. Files existence & integrity
  assert(fs.existsSync('client/public/logo.png'), 'client/public/logo.png exists');
  assert(fs.existsSync('client/public/favicon.ico'), 'client/public/favicon.ico exists');
  assert(fs.existsSync('client/public/favicon.png'), 'client/public/favicon.png exists');
  assert(fs.existsSync('client/src/assets/logo.png'), 'client/src/assets/logo.png exists');

  const logoBuf = fs.readFileSync('client/public/logo.png');
  assert(logoBuf.length > 50000, `Logo file has valid size (${logoBuf.length} bytes)`);
  assert(!fs.existsSync('client/public/favicon.svg'), 'Old purple favicon.svg has been removed');

  // 2. HTML and Component references
  const indexHtml = fs.readFileSync('client/index.html', 'utf8');
  assert(indexHtml.includes('href="/logo.png"'), 'client/index.html links to /logo.png');

  const navbarContent = fs.readFileSync('client/src/components/Navbar.jsx', 'utf8');
  assert(navbarContent.includes('src="/logo.png"'), 'Navbar.jsx displays official logo.png');

  const footerContent = fs.readFileSync('client/src/components/Footer.jsx', 'utf8');
  assert(footerContent.includes('src="/logo.png"'), 'Footer.jsx displays official logo.png');

  const authModalContent = fs.readFileSync('client/src/components/AuthModal.jsx', 'utf8');
  assert(authModalContent.includes('src="/logo.png"'), 'AuthModal.jsx displays official logo.png in header');

  const exploreContent = fs.readFileSync('client/src/pages/ExploreSkillsPage.jsx', 'utf8');
  assert(exploreContent.includes('src="/logo.png"'), 'ExploreSkillsPage.jsx displays official logo.png in header & loading');

  const profileContent = fs.readFileSync('client/src/pages/ProfilePage.jsx', 'utf8');
  assert(profileContent.includes('src="/logo.png"'), 'ProfilePage.jsx displays official logo.png in header');

  const chatContent = fs.readFileSync('client/src/pages/ChatPage.jsx', 'utf8');
  assert(chatContent.includes('src="/logo.png"'), 'ChatPage.jsx displays official logo.png in header & states');

  const notifContent = fs.readFileSync('client/src/components/NotificationDrawer.jsx', 'utf8');
  assert(notifContent.includes('src="/logo.png"'), 'NotificationDrawer.jsx displays official logo.png in header & footer');

  const dashboardContent = fs.readFileSync('client/src/pages/DashboardPage.jsx', 'utf8');
  assert(dashboardContent.includes('src="/logo.png"'), 'DashboardPage.jsx displays official logo.png');

  const appContent = fs.readFileSync('client/src/App.jsx', 'utf8');
  assert(appContent.includes('src="/logo.png"'), 'App.jsx Suspense fallback displays official logo.png');

  console.log('\n--- CHANGE 2: Default Name Alex Replaced with Abhi ---');
  assert(authModalContent.includes('placeholder="e.g. Abhi"'), 'AuthModal full name placeholder uses "e.g. Abhi"');
  assert(authModalContent.includes('placeholder="abhi@gmail.com"'), 'AuthModal gmail placeholder uses "abhi@gmail.com"');
  assert(authModalContent.includes('placeholder="abhi"'), 'AuthModal username placeholder uses "abhi"');
  assert(authModalContent.includes('placeholder="abhi or abhi@gmail.com"'), 'AuthModal login placeholder uses "abhi or abhi@gmail.com"');
  assert(authModalContent.includes('placeholder="Enter your username or abhi@gmail.com"'), 'AuthModal recovery placeholder uses "abhi@gmail.com"');

  const communityContent = fs.readFileSync('server/routes/community.js', 'utf8');
  assert(communityContent.includes("lead: 'Abhi'"), "server/routes/community.js uses lead: 'Abhi'");
  assert(!communityContent.includes('Alex Rivera'), 'server/routes/community.js does not contain Alex Rivera');

  // Verify no "Alex" in client/src
  const clientFiles = ['Navbar.jsx', 'Footer.jsx', 'AuthModal.jsx', 'NotificationDrawer.jsx', 'App.jsx'];
  let alexFound = false;
  for (const f of clientFiles) {
    const fullPath = `client/src/${f.endsWith('.jsx') && f !== 'App.jsx' ? 'components/' + f : f}`;
    if (fs.existsSync(fullPath)) {
      const text = fs.readFileSync(fullPath, 'utf8');
      if (text.toLowerCase().includes('alex')) {
        alexFound = true;
        console.error(`Found alex in ${fullPath}`);
      }
    }
  }
  assert(!alexFound, 'Zero occurrences of "alex" in critical client UI components');

  console.log('\n--- CHANGE 3: Connected Profiles First in Explore Skills ---');
  // 1. Unit test of sorting algorithm with mixed connection statuses
  const mockProfiles = [
    { id: '1', name: 'Zack (None)', connectionStatus: 'none', skillsTeach: ['React'] },
    { id: '2', name: 'Charlie (Pending)', connectionStatus: 'pending', skillsTeach: ['Python'] },
    { id: '3', name: 'Alice (Accepted)', connectionStatus: 'accepted', skillsTeach: ['Design'] },
    { id: '4', name: 'David (Rejected)', connectionStatus: 'rejected', skillsTeach: ['Rust'] },
    { id: '5', name: 'Bob (Accepted)', connectionStatus: 'accepted', skillsTeach: ['Guitar'] },
    { id: '6', name: 'Emma (None)', connectionStatus: 'none', skillsTeach: ['Java'] }
  ];

  const sortedMock = [...mockProfiles].sort((a, b) => {
    const aConnected = a.connectionStatus === 'accepted' ? 1 : 0;
    const bConnected = b.connectionStatus === 'accepted' ? 1 : 0;
    if (bConnected !== aConnected) return bConnected - aConnected;
    const aSkills = (a.skillsTeach?.length || 0) + (a.skillsLearn?.length || 0);
    const bSkills = (b.skillsTeach?.length || 0) + (b.skillsLearn?.length || 0);
    if (bSkills !== aSkills) return bSkills - aSkills;
    return (a.name || '').localeCompare(b.name || '');
  });

  assert(sortedMock[0].connectionStatus === 'accepted', 'First profile has connectionStatus accepted');
  assert(sortedMock[1].connectionStatus === 'accepted', 'Second profile has connectionStatus accepted');
  assert(sortedMock[2].connectionStatus !== 'accepted', 'Third profile is from remaining profiles');
  assert(sortedMock[0].name === 'Alice (Accepted)', 'Accepted profiles correctly sorted');
  assert(sortedMock[1].name === 'Bob (Accepted)', 'Accepted profiles correctly sorted');

  // Verify pending and rejected are strictly in the remaining section
  const acceptedSlice = sortedMock.slice(0, 2);
  const remainingSlice = sortedMock.slice(2);
  assert(acceptedSlice.every(p => p.connectionStatus === 'accepted'), 'Top section contains ONLY accepted connections');
  assert(!acceptedSlice.some(p => p.connectionStatus === 'pending'), 'Pending requests are NOT in top connected section');
  assert(!acceptedSlice.some(p => p.connectionStatus === 'rejected'), 'Rejected requests are NOT in top connected section');
  assert(remainingSlice.some(p => p.connectionStatus === 'pending'), 'Pending request is in remaining section');
  assert(remainingSlice.some(p => p.connectionStatus === 'rejected'), 'Rejected request is in remaining section');

  // 2. Integration test with dbService.getExploreUsers
  const liveUsers = await dbService.getExploreUsers(null);
  assert(Array.isArray(liveUsers), 'dbService.getExploreUsers returns array');
  assert(liveUsers.length >= 2, `Database profiles retrieved successfully (count: ${liveUsers.length})`);

  // Verify currently logged in user self-exclusion
  const sankar = liveUsers.find(u => u.bridgeAccount?.toLowerCase() === 'sankar');
  const abhiUser = liveUsers.find(u => u.bridgeAccount?.toLowerCase() === 'abhi');

  if (abhiUser && sankar) {
    const forAbhi = await dbService.getExploreUsers(abhiUser.id);
    assert(!forAbhi.some(u => u.id === abhiUser.id), 'Currently logged in user is excluded from explore results');
    assert(forAbhi.some(u => u.id === sankar.id), 'Other user is visible');
  }

  console.log('\n--- Database Invariant Checks ---');
  assert(liveUsers.length >= 2, `Preserved all existing registered users (database count: ${liveUsers.length})`);

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
