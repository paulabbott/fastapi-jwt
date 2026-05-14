const PAGES = [
  'sa-login','sa-overview','sa-group-detail','sa-group-admins','sa-invite','sa-tracking','sa-super-admins','sa-add-group','sa-add-group-user',
  'sc-login','sc-group-detail','sc-invite','sc-tracking',
  'p-email','p-otp','p-survey'
];

let currentGroupIndex = 1; // default to Meridian (demo deployments / surveys only)
/** When set, Flow 1 group screens show this API tenant (``GET /auth/admin/groups``); demo localStorage rows are not used for the name. */
let selectedTenantGroup = null;
let activeFlowNav = 'flow1';

/** JWT `role` from FastAPI access token (sessionStorage). */
function getJwtRole() {
  return (window.JwtStaticAuth && window.JwtStaticAuth.getSessionRole && window.JwtStaticAuth.getSessionRole()) || null;
}

/** Set activeFlowNav from JWT role (super_admin → flow1, survey_creator → flow2, survey_runner → flow3). */
function syncActiveFlowNavFromJwt() {
  const r = getJwtRole();
  if (r === 'super_admin') activeFlowNav = 'flow1';
  else if (r === 'survey_creator') activeFlowNav = 'flow2';
  else if (r === 'survey_runner') activeFlowNav = 'flow3';
  else activeFlowNav = 'flow1';
}

function assertJwtRole(allowed, message) {
  const jwt = getJwtRole();
  const arr = Array.isArray(allowed) ? allowed : [allowed];
  if (!jwt) {
    window.alert(message || 'Log in first (FastAPI /auth/login).');
    return false;
  }
  if (arr.indexOf(jwt) === -1) {
    window.alert(message || ('Requires role: ' + arr.join(' or ') + '. Your JWT role is: ' + jwt));
    return false;
  }
  return true;
}

/** Which JWT roles may open each page id (before invite/tracking alias). */
const PAGE_JWT_ACCESS = {
  'sa-overview': ['super_admin'],
  'sa-group-detail': ['super_admin'],
  'sa-group-admins': ['super_admin', 'survey_creator'],
  'sa-invite': ['super_admin'],
  'sa-tracking': ['super_admin'],
  'sa-super-admins': ['super_admin'],
  'sa-add-group': ['super_admin'],
  'sa-add-group-user': ['super_admin', 'survey_creator'],
  'sc-group-detail': ['survey_creator', 'survey_runner'],
  'sc-invite': ['survey_creator', 'survey_runner'],
  'sc-tracking': ['survey_creator', 'survey_runner'],
};

function refreshFlowNavState() {
  const r = getJwtRole();
  function wire(navSelector, allowedRoles) {
    document.querySelectorAll(navSelector + ' button').forEach((btn, i) => {
      if (i === 0) {
        btn.disabled = false;
        return;
      }
      btn.disabled = !r || allowedRoles.indexOf(r) === -1;
    });
  }
  wire('#nav-flow1', ['super_admin']);
  wire('#nav-flow2', ['survey_creator']);
  wire('#nav-flow3', ['survey_runner']);
}
let currentTrackingDeploymentIndex = null;
let currentInviteDeploymentIndex = null;
const PARTICIPANT_DEMO_LINK = 'https://surveys.app/s/xdcf530k';

// ── Seed data ──
function seedData() {
  if (!localStorage.getItem('sb_seeded_v7')) {
    localStorage.setItem('sb_surveys', JSON.stringify(V7_SEED_DATA.surveys));
    localStorage.setItem('sb_deployed', JSON.stringify(V7_SEED_DATA.deployed));
    localStorage.setItem('sb_seeded_v7', '1');
  }
}

function getGroups()       { return JSON.parse(localStorage.getItem('sb_groups') || '[]'); }
function saveGroups(g)     { localStorage.setItem('sb_groups', JSON.stringify(g)); }
function getSurveys()      { return JSON.parse(localStorage.getItem('sb_surveys') || '[]'); }
function saveSurveys(s)    { localStorage.setItem('sb_surveys', JSON.stringify(s)); }
function getDeployed()     { return JSON.parse(localStorage.getItem('sb_deployed') || '[]'); }
function saveDeployed(d)   { localStorage.setItem('sb_deployed', JSON.stringify(d)); }

const DEMO_TENANT_GROUP_NAMES = ['Hartwell & Sons', 'Meridian Research Group', 'Foxglove Studio'];

function tenantGroupNameFromSurvey(s) {
  if (!s) return '';
  if (s.tenantGroupName) return String(s.tenantGroupName);
  if (typeof s.groupIndex === 'number' && s.groupIndex >= 0 && s.groupIndex < DEMO_TENANT_GROUP_NAMES.length) {
    return DEMO_TENANT_GROUP_NAMES[s.groupIndex];
  }
  return '';
}

function tenantGroupNameFromDeployment(d) {
  if (!d) return '';
  if (d.tenantGroupName) return String(d.tenantGroupName);
  if (typeof d.groupIndex === 'number' && d.groupIndex >= 0 && d.groupIndex < DEMO_TENANT_GROUP_NAMES.length) {
    return DEMO_TENANT_GROUP_NAMES[d.groupIndex];
  }
  return '';
}

function currentWorkspaceTenantGroupName() {
  if (selectedTenantGroup && selectedTenantGroup.name) return String(selectedTenantGroup.name);
  const groups = getGroups();
  const g = groups[currentGroupIndex];
  if (g && g.name) return String(g.name);
  if (typeof currentGroupIndex === 'number' && currentGroupIndex >= 0 && currentGroupIndex < DEMO_TENANT_GROUP_NAMES.length) {
    return DEMO_TENANT_GROUP_NAMES[currentGroupIndex];
  }
  return '';
}

function deploymentSameTenantAndSurvey(item, d) {
  return tenantGroupNameFromDeployment(item) === tenantGroupNameFromDeployment(d) && item.name === d.name;
}

// ── Navigation ──
const flow1NavIndexByPage = { 'sa-login': 0, 'sa-overview': 1, 'sa-super-admins': 2, 'sa-group-detail': 3, 'sa-invite': 4, 'sa-tracking': 5 };
const flow2NavIndexByPage = { 'sc-login': 0, 'sc-group-detail': 1, 'sc-invite': 2, 'sc-tracking': 3 };
const flow3NavIndexByPage = { 'sc-login': 0, 'sc-group-detail': 1, 'sc-invite': 2, 'sc-tracking': 3 };
const flow4NavIndexByPage = { 'p-email': 0, 'p-otp': 1, 'p-survey': 2 };

function openSharedLogin() {
  syncActiveFlowNavFromJwt();
  const roleLabel = document.getElementById('sc-login-role-label');
  if (roleLabel) {
    roleLabel.textContent = 'Log in with FastAPI /auth/login. After login, the highlighted flow matches your JWT role.';
  }
  navigateToPage('sc-login');
}

function openRoleFlowPage(id) {
  syncActiveFlowNavFromJwt();
  navigateToPage(id);
}

function openRolePage(id) {
  syncActiveFlowNavFromJwt();
  navigateToPage(id);
}

function continueFromAppLoginAfterSuccess() {
  if (getJwtRole() === 'super_admin') {
    navigateToPage('sa-overview');
    return;
  }
  navigateToPage('sc-group-detail');
}

async function finishAppLogin(email, password, errEl) {
  if (errEl) errEl.textContent = '';
  if (!email || !password) {
    if (errEl) errEl.textContent = 'Email and password are required.';
    return;
  }
  const r = await window.JwtStaticAuth.login(email, password);
  if (!r.ok) {
    if (errEl) errEl.textContent = r.message || 'Login failed';
    return;
  }
  const role = getJwtRole();
  if (!role) {
    window.JwtStaticAuth.logout();
    if (errEl) errEl.textContent = 'Token is missing a role claim.';
    return;
  }
  syncActiveFlowNavFromJwt();
  continueFromAppLoginAfterSuccess();
  refreshFlowNavState();
}

async function submitSaLogin() {
  const email = (document.getElementById('sa-login-email') && document.getElementById('sa-login-email').value || '').trim();
  const password = (document.getElementById('sa-login-password') && document.getElementById('sa-login-password').value) || '';
  const errEl = document.getElementById('sa-login-error');
  await finishAppLogin(email, password, errEl);
}

async function submitSharedLogin() {
  const email = (document.getElementById('sc-login-email') && document.getElementById('sc-login-email').value || '').trim();
  const password = (document.getElementById('sc-login-password') && document.getElementById('sc-login-password').value) || '';
  const errEl = document.getElementById('sc-login-error');
  await finishAppLogin(email, password, errEl);
}

function getCurrentWorkspaceGroup() {
  if (selectedTenantGroup && selectedTenantGroup.id && selectedTenantGroup.name) {
    return { id: String(selectedTenantGroup.id), name: String(selectedTenantGroup.name) };
  }
  const groups = getGroups();
  const g = groups[currentGroupIndex];
  if (g && g.name) {
    return { id: g.groupId ? String(g.groupId) : null, name: g.name };
  }
  const name = currentWorkspaceTenantGroupName();
  return name ? { id: null, name } : null;
}

function showGroupOverview() {
  selectedTenantGroup = null;
  if (getJwtRole() === 'super_admin') {
    navigateToPage('sa-overview');
    return;
  }
  navigateToPage('sc-group-detail');
}

function showGroupDetailPage() {
  if (getJwtRole() === 'super_admin') {
    navigateToPage('sa-group-detail');
    return;
  }
  navigateToPage('sc-group-detail');
}

function navigateToPage(id) {
  if (getJwtRole()) syncActiveFlowNavFromJwt();

  const gate = PAGE_JWT_ACCESS[id];
  if (gate && gate.length) {
    const jwtRole = getJwtRole();
    if (!jwtRole || gate.indexOf(jwtRole) === -1) {
      if (!jwtRole) window.alert('Log in first (FastAPI /auth/login).');
      else window.alert('This screen requires one of: ' + gate.join(', ') + '. Your JWT role is: ' + jwtRole);
      return;
    }
  }

  if (id === 'sa-overview') selectedTenantGroup = null;

  const effectiveId = (id === 'sa-invite' ? 'sc-invite' : (id === 'sa-tracking' ? 'sc-tracking' : id));
  PAGES.forEach(p => document.getElementById('page-' + p).style.display = p === effectiveId ? '' : 'none');
  document.querySelectorAll('#nav-flow1 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow2 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow3 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow4 button').forEach(b => b.classList.remove('active-btn'));
  if (id === 'sc-login' && activeFlowNav === 'flow1') {
    document.querySelectorAll('#nav-flow1 button')[0].classList.add('active-btn');
  } else if (id === 'sc-login' && activeFlowNav === 'flow2') {
    document.querySelectorAll('#nav-flow2 button')[0].classList.add('active-btn');
  } else if (id === 'sc-login' && activeFlowNav === 'flow3') {
    document.querySelectorAll('#nav-flow3 button')[0].classList.add('active-btn');
  } else if (flow1NavIndexByPage[id] !== undefined) {
    document.querySelectorAll('#nav-flow1 button')[flow1NavIndexByPage[id]].classList.add('active-btn');
  }
  if (flow2NavIndexByPage[id] !== undefined && !(id === 'sc-login' && activeFlowNav === 'flow1')) {
    const navSelector = activeFlowNav === 'flow3' ? '#nav-flow3 button' : '#nav-flow2 button';
    const navIndexByPage = activeFlowNav === 'flow3' ? flow3NavIndexByPage : flow2NavIndexByPage;
    document.querySelectorAll(navSelector)[navIndexByPage[id]].classList.add('active-btn');
  }
  if (flow4NavIndexByPage[id] !== undefined) document.querySelectorAll('#nav-flow4 button')[flow4NavIndexByPage[id]].classList.add('active-btn');

  if (id === 'sa-overview')     renderOverview();
  if (id === 'sa-group-detail') renderSaGroupDetail();
  if (id === 'sa-group-admins') renderSaGroupAdmins();
  if (id === 'sa-tracking')     renderTrackingViewShared('super_admin');
  if (id === 'sa-add-group-user') renderSaAddGroupUser();
  if (id === 'sa-invite' || id === 'sc-invite') renderInviteLanding(id === 'sa-invite' ? 'super_admin' : (getJwtRole() || ''));
  if (id === 'sc-group-detail') renderScGroupDetail();
  if (id === 'sc-tracking')     renderTrackingViewShared(getJwtRole() || 'survey_creator');
  if (id === 'p-email')         renderParticipantEmail();

  refreshFlowNavState();
}

function resetDemoData() {
  if (window.JwtStaticAuth && window.JwtStaticAuth.logout) window.JwtStaticAuth.logout();
  activeFlowNav = 'flow1';
  selectedTenantGroup = null;
  localStorage.removeItem('sb_groups');
  localStorage.removeItem('sb_surveys');
  localStorage.removeItem('sb_deployed');
  localStorage.removeItem('sb_seeded_v7');
  seedData();
  openSharedLogin();
}

// ── F1: Overview ──
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return mins + 'm ago';
  if (hours < 24) return hours + 'h ago';
  return days + 'd ago';
}

function renderOverview() {
  const allDeployed = getDeployed();
  const deployed = allDeployed.filter(d => !d.closed);
  const container = document.getElementById('overview-container');

  const sorted = [...deployed].sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));
  const deploymentRows = sorted.map(d => {
    const groupName = tenantGroupNameFromDeployment(d) || 'Unknown group';
    const nameJs = JSON.stringify(groupName);
    const escHtml = function (s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
    };
    return `
      <tr>
        <td><a href="#" onclick='event.preventDefault();void openTenantGroupByName(${nameJs});' style="cursor:pointer;color:blue">${escHtml(groupName)}</a></td>
        <td>${escHtml(d.name)}</td>
        <td>${timeAgo(d.deployedAt)}</td>
        <td>${d.closed ? 'Closed' : 'Live'}</td>
        <td>${d.invited}</td>
        <td>${d.submitted}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <h3>Live deployments</h3>
    <p class="compact-meta">Demo surveys and deployments from <code>localStorage</code>; group names match tenant groups from <code>GET /auth/admin/groups</code>.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Group</th><th>Survey</th><th>Age</th><th>Status</th><th>Invited</th><th>Submitted</th></tr></thead>
      <tbody>${deploymentRows || '<tr><td colspan="6">No live deployments yet</td></tr>'}</tbody>
    </table>
    <br>
    <h3>Tenant groups <button onclick="navigateToPage('sa-add-group')">+ Add group</button></h3>
    <p class="compact-meta">Loaded from <code>GET /auth/admin/groups</code> (not localStorage).</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Name</th><th>Global admin group</th></tr></thead>
      <tbody id="api-groups-summary-body"><tr><td colspan="2">Loading…</td></tr></tbody>
    </table>`;

  const bodyEl = document.getElementById('api-groups-summary-body');
  if (!bodyEl) return;

  (async function loadTenantGroupsTable() {
    try {
      if (getJwtRole() !== 'super_admin') {
        bodyEl.innerHTML =
          '<tr><td colspan="2">Log in as <code>super_admin</code> to load tenant groups from the API.</td></tr>';
        return;
      }
      const res = await window.JwtStaticAuth.authFetch('/auth/admin/groups');
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        bodyEl.innerHTML =
          '<tr><td colspan="2">' +
          (typeof data.detail === 'string' ? data.detail : 'Could not load groups') +
          '</td></tr>';
        return;
      }
      const list = data.groups || [];
      if (!Array.isArray(list) || !list.length) {
        bodyEl.innerHTML = '<tr><td colspan="2">No tenant groups yet. Use + Add group.</td></tr>';
        return;
      }
      bodyEl.innerHTML = list
        .map(function (g) {
          const esc = function (s) {
            return String(s)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/"/g, '&quot;');
          };
          const globalCell = g.is_super_admin_group ? 'Yes' : '—';
          return (
            '<tr><td><a href="#" onclick=\'event.preventDefault();void openTenantGroupFromApi(' +
            JSON.stringify(String(g.id)) +
            ',' +
            JSON.stringify(String(g.name)) +
            ');\' style="cursor:pointer;color:blue">' +
            esc(g.name) +
            '</a></td><td>' +
            globalCell +
            '</td></tr>'
          );
        })
        .join('');
    } catch (e) {
      bodyEl.innerHTML = '<tr><td colspan="2">Error loading groups.</td></tr>';
    }
  })();
}

async function openTenantGroupByName(name) {
  if (!assertJwtRole(['super_admin'], 'Open tenant from overview requires super_admin JWT.')) return;
  const want = String(name || '').trim();
  if (!want) return;
  try {
    const res = await window.JwtStaticAuth.authFetch('/auth/admin/groups');
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      window.alert(typeof data.detail === 'string' ? data.detail : ('HTTP ' + res.status));
      return;
    }
    const list = data.groups || [];
    const row = list.find(function (g) { return String(g.name || '').trim() === want; });
    if (!row || row.id == null) {
      window.alert(
        'No tenant group named "' + want + '" in the API. Restart the app so demo groups are seeded, or create the group first.',
      );
      return;
    }
    openTenantGroupFromApi(row.id, row.name);
  } catch (e) {
    window.alert('Error loading groups.');
  }
}

function openTenantGroupFromApi(id, name) {
  selectedTenantGroup = { id: String(id), name: String(name) };
  currentGroupIndex = -1;
  navigateToPage('sa-group-detail');
}

async function addGroup() {
  const name = document.getElementById('sa-co-name').value.trim();
  if (!name) return;
  const res = await window.JwtStaticAuth.authFetch('/auth/admin/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name }),
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    window.alert(typeof data.detail === 'string' ? data.detail : ('HTTP ' + res.status));
    return;
  }
  document.getElementById('sa-co-name').value = '';
  navigateToPage('sa-overview');
}

// ── F1: Group detail ──
function renderSaGroupDetail() {
  const ws = getCurrentWorkspaceGroup();
  const name = ws ? ws.name : 'Unknown';
  document.getElementById('sa-group-crumb').textContent = name;
  document.getElementById('sa-group-title').textContent = name;
  renderGroupDetailTables({
    surveysBodyId: 'sa-group-surveys-body',
    deployedBodyId: 'sa-group-deployed-body',
    deployHandler: 'deploySurveyForCurrentView',
    trackingHandler: 'openTrackingAdmin',
    inviteHandler: 'openInviteAdmin',
    closeHandler: 'closeSurveyAdmin'
  });
}

function renderSaGroupAdmins() {
  const ws = getCurrentWorkspaceGroup();
  const groupName = ws ? ws.name : 'Unknown';
  const localRow = getGroups()[currentGroupIndex];
  const useApiUsersNote = !!(selectedTenantGroup || !localRow);
  const demoUsers = !useApiUsersNote && localRow.users ? localRow.users : [];
  const crumbs = document.getElementById('group-admins-breadcrumbs');
  if (getJwtRole() === 'super_admin') {
    crumbs.innerHTML = `
      <span>Admin</span> /
      <a onclick="showGroupOverview()">Overview</a> /
      <a onclick="showGroupDetailPage()">${groupName}</a> /
      <span>Survey creators & runners</span>
    `;
  } else {
    crumbs.innerHTML = `
      <span>${groupName}</span> /
      <a onclick="showGroupOverview()">Dashboard</a> /
      <span>Survey creators & runners</span>
    `;
  }
  document.getElementById('sa-add-user-title').textContent = 'Add user — ' + groupName;
  const demoNote = useApiUsersNote
    ? '<tr><td colspan="3">Demo user rows are not stored for API-backed tenant groups. Use Add user to create staff in FastAPI.</td></tr>'
    : null;
  document.getElementById('sa-group-users-body').innerHTML = demoNote
    ? demoNote
    : demoUsers.length
      ? demoUsers.map((u, i) => `
        <tr>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td><button onclick="removeGroupUser(${i})">Remove</button></td>
        </tr>`).join('')
      : '<tr><td colspan="3">No users yet</td></tr>';
}

/** Resolve tenant id for ``POST /auth/admin/users`` from the current workspace (API selection or demo row). */
async function resolveWorkspaceTenantGroupId() {
  const ws = getCurrentWorkspaceGroup();
  if (!ws || !ws.name) return { id: null, source: 'none' };
  if (ws.id) return { id: String(ws.id), source: 'tenant id for this workspace' };
  const rc = await window.JwtStaticAuth.authFetch('/auth/admin/groups');
  const data = await rc.json().catch(function () { return {}; });
  if (!rc.ok || !Array.isArray(data.groups)) return { id: null, source: 'none' };
  const want = String(ws.name || '').trim();
  const row = data.groups.find(function (x) { return String(x.name || '').trim() === want; });
  if (row && row.id) return { id: String(row.id), source: 'GET /auth/admin/groups matched name "' + want + '"' };
  return { id: null, source: 'none' };
}

async function renderSaAddGroupUser() {
  const ws = getCurrentWorkspaceGroup();
  const titleEl = document.getElementById('sa-add-user-title');
  if (titleEl && ws) titleEl.textContent = 'Add user — ' + ws.name;
  const hintEl = document.getElementById('sa-tenant-group-hint');
  if (!hintEl) return;
  hintEl.textContent = 'Resolving tenant group…';
  const resolved = await resolveWorkspaceTenantGroupId();
  if (!resolved.id) {
    hintEl.textContent =
      'No tenant id for this workspace. Open it from the Tenant groups table (API list) or ensure a tenant group name matches this workspace.';
    return;
  }
  hintEl.textContent =
    'New users will be created with JSON field "group": ' +
    resolved.id +
    ' — source: ' +
    resolved.source +
    '. (FastAPI expects "group", not "groupID".)';
}

async function addGroupUser() {
  const email = document.getElementById('sa-cu-email').value.trim();
  const role = document.getElementById('sa-cu-role').value;
  const password = (document.getElementById('sa-cu-password') && document.getElementById('sa-cu-password').value) || '';
  if (!email) return;
  if (getJwtRole() !== 'super_admin') {
    window.alert('Only a super_admin JWT can create staff users via POST /auth/admin/users.');
    return;
  }
  if (password.length < 8) {
    window.alert('Password must be at least 8 characters (API rule).');
    return;
  }
  const resolved = await resolveWorkspaceTenantGroupId();
  const group = resolved.id;
  if (!group) {
    window.alert(
      'Could not resolve a tenant group id for this workspace. Open the group from the Overview list (loaded from GET /auth/admin/groups), or ensure a tenant group exists with the same display name.',
    );
    return;
  }
  const res = await window.JwtStaticAuth.authFetch('/auth/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password: password, role: role, group: group }),
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    window.alert(typeof data.detail === 'string' ? data.detail : ('HTTP ' + res.status));
    return;
  }
  document.getElementById('sa-cu-email').value = '';
  document.getElementById('sa-cu-password').value = '';
  navigateToPage('sa-group-admins');
}
function removeGroupUser(i) {
  const groups = getGroups();
  const row = groups[currentGroupIndex];
  if (!row || !row.users) return;
  row.users.splice(i, 1);
  saveGroups(groups);
  renderSaGroupAdmins();
}

// ── F1: Super admins (from FastAPI) ──
async function fetchGlobalAdminGroupId() {
  const rc = await window.JwtStaticAuth.authFetch('/auth/admin/groups');
  const data = await rc.json().catch(function () { return {}; });
  if (!rc.ok || !Array.isArray(data.groups)) return null;
  const row = data.groups.find(function (g) { return g.is_super_admin_group === true; });
  return row && row.id ? String(row.id) : null;
}

async function renderSuperAdmins() {
  const bodyEl = document.getElementById('superadmins-body');
  if (!bodyEl) return;
  bodyEl.innerHTML = '<tr><td colspan="2">Loading…</td></tr>';
  const res = await window.JwtStaticAuth.authFetch('/auth/super-admins');
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : (res.statusText || 'Request failed');
    bodyEl.innerHTML = '<tr><td colspan="2">' + msg + '</td></tr>';
    return;
  }
  const list = data.super_admins || [];
  bodyEl.innerHTML = list.length
    ? list.map(function (u) {
        return '<tr><td>' + String(u).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td><td><button type="button" onclick="removeSuperAdmin(' + JSON.stringify(u) + ')">Remove</button></td></tr>';
      }).join('')
    : '<tr><td colspan="2">No super admins</td></tr>';
}

async function addSuperAdmin() {
  const username = (document.getElementById('new-sa-email') && document.getElementById('new-sa-email').value || '').trim();
  const password = (document.getElementById('new-sa-password') && document.getElementById('new-sa-password').value) || '';
  if (!username || !password) {
    window.alert('Username and password are required.');
    return;
  }
  const group = await fetchGlobalAdminGroupId();
  if (!group) {
    window.alert('Could not resolve the Global Admin group. Ensure one row has is_super_admin_group true in GET /auth/admin/groups.');
    return;
  }
  const res = await window.JwtStaticAuth.authFetch('/auth/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password, role: 'super_admin', group: group }),
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    window.alert(typeof data.detail === 'string' ? data.detail : 'Create failed');
    return;
  }
  document.getElementById('new-sa-email').value = '';
  document.getElementById('new-sa-password').value = '';
  await renderSuperAdmins();
}

async function removeSuperAdmin(username) {
  if (!window.confirm('Remove ' + username + '?')) return;
  const res = await window.JwtStaticAuth.authFetch('/auth/admin/users/' + encodeURIComponent(username), { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(function () { return {}; });
    window.alert(typeof data.detail === 'string' ? data.detail : ('Error ' + res.status));
    return;
  }
  await renderSuperAdmins();
}

// ── F2: Group detail (creator) ──
function renderScGroupDetail() {
  const ws = getCurrentWorkspaceGroup();
  const groupName = ws ? ws.name : 'Unknown group';
  const isSurveyRunner = getJwtRole() === 'survey_runner';
  document.getElementById('sc-group-title').textContent = groupName;
  document.getElementById('sc-group-admins-row').style.display = isSurveyRunner ? 'none' : '';
  document.getElementById('sc-create-survey-row').style.display = isSurveyRunner ? 'none' : '';
  renderGroupDetailTables({
    surveysBodyId: 'sc-surveys-body',
    deployedBodyId: 'sc-deployed-body',
    deployHandler: 'deploySurveyForCurrentView',
    trackingHandler: 'openTracking',
    inviteHandler: 'openInvite',
    closeHandler: 'closeSurvey',
    showEditButton: !isSurveyRunner
  });
}

function getDeployedForCurrentGroup() {
  const want = currentWorkspaceTenantGroupName();
  return getDeployed()
    .map((d, i) => ({ ...d, globalIndex: i }))
    .filter(d => tenantGroupNameFromDeployment(d) === want)
    .sort((a, b) => {
      if (!!a.closed !== !!b.closed) return a.closed ? 1 : -1;
      return new Date(b.deployedAt) - new Date(a.deployedAt);
    });
}

function renderGroupDetailTables(config) {
  const showEditButton = config.showEditButton !== false;
  const want = currentWorkspaceTenantGroupName();
  const surveys = getSurveys().filter(s => tenantGroupNameFromSurvey(s) === want);
  document.getElementById(config.surveysBodyId).innerHTML = surveys.length
    ? surveys.map(s => `
        <tr>
          <td>${s.name}</td>
          <td>
            ${showEditButton ? '<button>Edit</button>' : ''}
            <button onclick="${config.deployHandler}(${s.id})">Deploy</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="2">No surveys yet</td></tr>';

  const deployedForGroup = getDeployedForCurrentGroup();
  const deploymentOrdinalByIndex = getDeploymentOrdinalByIndex(deployedForGroup);
  document.getElementById(config.deployedBodyId).innerHTML = deployedForGroup.length
    ? deployedForGroup.map(d => `
        <tr>
          <td>${d.name}</td>
          <td>${deploymentOrdinalByIndex[d.globalIndex] || ''}</td>
          <td>${timeAgo(d.deployedAt)}</td>
          <td>${d.closed ? 'Closed' : '<span style="color:green">Live</span>'}</td>
          <td>${d.invited || 0}</td>
          <td>${d.submitted || 0}</td>
          <td>${d.tracked === undefined ? '' : (d.tracked ? `<a onclick="${config.trackingHandler}(${d.globalIndex})" style="cursor:pointer;color:blue">Yes</a>` : 'No')}</td>
          <td>${d.closed ? '' : `<button onclick="${config.inviteHandler}(${d.globalIndex})">Invite</button>`}</td>
          <td><button>Preview</button></td>
          <td><button>Analyse</button></td>
          <td><button>Export</button></td>
          <td><button onclick="${config.closeHandler}(${d.globalIndex})">${d.closed ? 'Reopen' : 'Close'}</button></td>
        </tr>`).join('')
    : '<tr><td colspan="12">None yet</td></tr>';
}

function getDeploymentOrdinalByIndex(deployedForGroup) {
  const bySurveyName = {};
  deployedForGroup.forEach(d => {
    if (!bySurveyName[d.name]) bySurveyName[d.name] = [];
    bySurveyName[d.name].push(d);
  });
  const ordinalByIndex = {};
  Object.values(bySurveyName).forEach(items => {
    const sortedByTime = [...items].sort((a, b) => new Date(a.deployedAt) - new Date(b.deployedAt));
    sortedByTime.forEach((item, idx) => {
      ordinalByIndex[item.globalIndex] = String(idx + 1);
    });
  });
  return ordinalByIndex;
}

function createSurveyAdmin() {
  createSurveyForCurrentGroup();
  renderSaGroupDetail();
}

function closeSurveyAdmin(globalIndex) {
  toggleSurveyClosed(globalIndex);
  renderSaGroupDetail();
}

function createSurvey() {
  createSurveyForCurrentGroup();
  renderScGroupDetail();
}

function deploySurveyForCurrentView(id) {
  deploySurveyForCurrentGroup(id);
  const showingAdminGroupDetail = document.getElementById('page-sa-group-detail').style.display !== 'none';
  if (showingAdminGroupDetail) {
    renderSaGroupDetail();
    return;
  }
  renderScGroupDetail();
}

function closeSurvey(globalIndex) {
  toggleSurveyClosed(globalIndex);
  renderScGroupDetail();
}

function createSurveyForCurrentGroup() {
  const surveys = getSurveys();
  const names = ['Customer Satisfaction Study','Product Feedback Survey','Quarterly Pulse Check','Market Research Q3','Brand Awareness Survey'];
  const used = surveys.map(s => s.name);
  const name = names.find(n => !used.includes(n)) || 'New Survey ' + (surveys.length + 1);
  const newId = surveys.length ? Math.max(...surveys.map(s => s.id)) + 1 : 1;
  const tenant = currentWorkspaceTenantGroupName();
  if (!tenant) {
    window.alert('Could not resolve a tenant group name for this workspace.');
    return;
  }
  surveys.push({ id: newId, name, tenantGroupName: tenant });
  saveSurveys(surveys);
}

function deploySurveyForCurrentGroup(id) {
  const survey = getSurveys().find(s => s.id === id);
  if (!survey) return;
  const deployed = getDeployed();
  const tenant = currentWorkspaceTenantGroupName();
  if (!tenant) {
    window.alert('Could not resolve a tenant group name for this workspace.');
    return;
  }
  deployed.push({ name: survey.name, tenantGroupName: tenant, deployedAt: new Date().toISOString(), invited: 0, submitted: 0 });
  saveDeployed(deployed);
}

function toggleSurveyClosed(globalIndex) {
  const deployed = getDeployed();
  deployed[globalIndex].closed = !deployed[globalIndex].closed;
  saveDeployed(deployed);
}

function openTracking(globalIndex) {
  if (!assertJwtRole(['survey_creator', 'survey_runner'], 'Open Tracking requires survey_creator or survey_runner JWT.')) return;
  currentTrackingDeploymentIndex = globalIndex;
  navigateToPage('sc-tracking');
}

function openTrackingAdmin(globalIndex) {
  if (!assertJwtRole(['super_admin'], 'Admin tracking requires super_admin JWT.')) return;
  currentTrackingDeploymentIndex = globalIndex;
  navigateToPage('sa-tracking');
}

function renderTrackingViewShared(role) {
  const deployed = getDeployed();
  let d = deployed[currentTrackingDeploymentIndex];
  let usedFallback = false;
  if (!d) {
    const want = currentWorkspaceTenantGroupName();
    const fallbackIndex = deployed.findIndex(item =>
      tenantGroupNameFromDeployment(item) === want &&
      Array.isArray(item.invites) &&
      item.invites.length > 0
    );
    if (fallbackIndex !== -1) {
      currentTrackingDeploymentIndex = fallbackIndex;
      d = deployed[fallbackIndex];
      usedFallback = true;
    }
  }
  if (!d) {
    document.getElementById('sc-tracking-deployed-at').textContent = '';
    document.getElementById('tracking-context-text').textContent = '';
    document.getElementById('sc-tracking-demo-note').style.display = 'none';
    document.getElementById('tracking-emails-body').innerHTML = '<tr><td colspan="4">No invites yet</td></tr>';
    return;
  }
  document.getElementById('sc-tracking-demo-note').style.display = usedFallback ? '' : 'none';

  const groupName = tenantGroupNameFromDeployment(d) || 'Unknown group';
  const deploymentNumber = getDeploymentNumber(currentTrackingDeploymentIndex);
  const breadcrumbs = document.getElementById('tracking-breadcrumbs');
  if (role === 'super_admin') {
    breadcrumbs.innerHTML = `
      <span>Admin</span> /
      <a onclick="navigateToPage('sa-overview')">Overview</a> /
      <a onclick="navigateToPage('sa-group-detail')">${groupName}</a> /
      <span>${d.name}</span> /
      <span>${deploymentNumber}</span> /
      <span>Tracking</span>
    `;
  } else {
    breadcrumbs.innerHTML = `
      <span>${groupName}</span> /
      <a onclick="navigateToPage('sc-group-detail')">Dashboard</a> /
      <span>${d.name}</span> /
      <span>${deploymentNumber}</span> /
      <span>Tracking</span>
    `;
  }
  const trackingContext = getDeploymentContext(currentTrackingDeploymentIndex);
  const trackingMeta = getInviteDeploymentMeta(trackingContext.deployedAtText);
  document.getElementById('tracking-context-text').textContent =
    `${trackingContext.surveyName}${trackingMeta.deploymentLabel}`;
  document.getElementById('sc-tracking-deployed-at').textContent =
    `Deployed at: ${trackingMeta.deployedAtLine}`;
  const invites = d.invites || [];
  document.getElementById('tracking-emails-body').innerHTML = invites.length
    ? invites.map(i => {
      const activityAt = i.lastActivityAt || d.deployedAt;
      return `<tr><td>${i.email || 'removed'}</td><td>${i.otp || ''}</td><td>${i.status}</td><td>${activityAt ? timeAgo(activityAt) : ''}</td></tr>`;
    }).join('')
    : '<tr><td colspan="4">No invites yet</td></tr>';
}

function deleteTrackedEmails() {
  if (currentTrackingDeploymentIndex === null) return;
  const deployed = getDeployed();
  const d = deployed[currentTrackingDeploymentIndex];
  if (!d) return;
  d.invites = (d.invites || []).map(i => ({ ...i, email: '' }));
  d.tracked = 'deleted';
  saveDeployed(deployed);
  renderTrackingViewShared(getJwtRole() === 'super_admin' ? 'super_admin' : (getJwtRole() || 'survey_creator'));
}

function getDeploymentContext(globalIndex) {
  const deployed = getDeployed();
  const d = deployed[globalIndex];
  const groupName = d ? tenantGroupNameFromDeployment(d) || 'Unknown group' : 'Unknown group';
  const surveyName = d ? d.name : 'Unknown survey';
  let deployedAtText = d && d.deployedAt ? new Date(d.deployedAt).toLocaleString() : 'Unknown';
  if (d) {
    const siblings = deployed
      .map((item, idx) => ({ ...item, globalIndex: idx }))
      .filter(item => deploymentSameTenantAndSurvey(item, d))
      .sort((a, b) => new Date(a.deployedAt) - new Date(b.deployedAt));
    const ordinal = siblings.findIndex(item => item.globalIndex === globalIndex) + 1;
    if (ordinal > 0 && siblings.length > 0) {
      deployedAtText += ` Deployment (${ordinal} of ${siblings.length})`;
    }
  }
  return { groupName, surveyName, deployedAtText };
}

function getDeploymentNumber(globalIndex) {
  const deployed = getDeployed();
  const d = deployed[globalIndex];
  if (!d) return '';
  const siblings = deployed
    .map((item, idx) => ({ ...item, globalIndex: idx }))
    .filter(item => deploymentSameTenantAndSurvey(item, d))
    .sort((a, b) => new Date(a.deployedAt) - new Date(b.deployedAt));
  const deploymentNumber = siblings.findIndex(item => item.globalIndex === globalIndex) + 1;
  return deploymentNumber > 0 ? String(deploymentNumber) : '';
}

function formatDeploymentText(deployedText) {
  const marker = ' Deployment (';
  const markerIndex = deployedText.indexOf(marker);
  if (markerIndex === -1) return 'Deployed at: ' + deployedText;
  const deployedAtLine = deployedText.slice(0, markerIndex);
  const deploymentLine = deployedText.slice(markerIndex + 1);
  return `${deploymentLine}<br>Deployed at: ${deployedAtLine}`;
}

function getInviteDeploymentMeta(deployedText) {
  const marker = ' Deployment (';
  const markerIndex = deployedText.indexOf(marker);
  if (markerIndex === -1) return { deployedAtLine: deployedText, deploymentLabel: '' };
  const deployedAtLine = deployedText.slice(0, markerIndex);
  const deploymentCount = deployedText.slice(markerIndex + marker.length, -1);
  return { deployedAtLine, deploymentLabel: ` (Deployment ${deploymentCount})` };
}

function buildGeneratedInvites(emails, useOtp) {
  const nowIso = new Date().toISOString();
  // TODO: persist real magic links from the surveys API once invite creation moves server-side.
  return emails.map(email => ({
    email,
    link: '',
    otp: useOtp ? Math.random().toString(36).slice(2, 7).toUpperCase() : '',
    status: 'Pending',
    lastActivityAt: nowIso
  }));
}

function persistInvites(globalIndex, generatedInvites, saveEmail) {
  const deployed = getDeployed();
  if (globalIndex === null || !deployed[globalIndex]) return;
  deployed[globalIndex].tracked = saveEmail;
  deployed[globalIndex].invited = generatedInvites.length;
  deployed[globalIndex].invites = generatedInvites.map(i => ({
    email: saveEmail ? i.email : '',
    link: i.link,
    otp: i.otp,
    status: i.status,
    lastActivityAt: i.lastActivityAt
  }));
  saveDeployed(deployed);
}

function mergeInviteSendResults(globalIndex, recipientsOrder, sentItems, failedItems) {
  const deployed = getDeployed();
  if (globalIndex === null || !deployed[globalIndex]) return;
  const sentMap = new Map((sentItems || []).map(s => [s.email, s.link]));
  const failEmails = new Set((failedItems || []).map(f => f.email));
  const nowIso = new Date().toISOString();
  const invites = deployed[globalIndex].invites || [];
  for (let i = 0; i < invites.length && i < recipientsOrder.length; i++) {
    const req = recipientsOrder[i];
    if (sentMap.has(req.email)) {
      invites[i] = {
        ...invites[i],
        email: invites[i].email || req.email,
        link: sentMap.get(req.email) || '',
        status: 'Sent',
        lastActivityAt: nowIso
      };
    } else if (failEmails.has(req.email)) {
      invites[i] = {
        ...invites[i],
        email: invites[i].email || req.email,
        status: 'Send failed',
        lastActivityAt: nowIso
      };
    }
  }
  deployed[globalIndex].invites = invites;
  saveDeployed(deployed);
}

function renderInviteBreadcrumbs(role, groupName, surveyName, deploymentNumber) {
  const breadcrumbs = document.getElementById('invite-breadcrumbs');
  const surveyPart = surveyName ? `<span>${surveyName}</span> / ` : '';
  const deploymentPart = deploymentNumber ? `<span>${deploymentNumber}</span> / ` : '';
  if (role === 'super_admin') {
    breadcrumbs.innerHTML = `
      <span>Admin</span> /
      <a onclick="navigateToPage('sa-overview')">Overview</a> /
      <a onclick="navigateToPage('sa-group-detail')">${groupName}</a> /
      ${surveyPart}${deploymentPart}<span>Invite participants</span>
    `;
  } else {
    breadcrumbs.innerHTML = `
      <span>${groupName}</span> /
      <a onclick="navigateToPage('sc-group-detail')">Dashboard</a> /
      ${surveyPart}${deploymentPart}<span>Invite participants</span>
    `;
  }
}

function renderInviteLanding(role) {
  if (currentInviteDeploymentIndex !== null && getDeployed()[currentInviteDeploymentIndex]) return;
  const ws = getCurrentWorkspaceGroup();
  const groupName = ws ? ws.name : 'Unknown group';
  renderInviteBreadcrumbs(role, groupName, '', '');
  document.getElementById('sc-invite-deployed-at').textContent = '';
  document.getElementById('invite-context-text').textContent = '';
}

function openInviteShared(globalIndex, mode) {
  if (mode === 'admin') {
    if (!assertJwtRole(['super_admin'])) return;
  } else {
    if (!assertJwtRole(['survey_creator', 'survey_runner'])) return;
  }
  const jwtRole = getJwtRole();
  currentInviteDeploymentIndex = globalIndex;
  const { groupName, surveyName, deployedAtText } = getDeploymentContext(globalIndex);
  renderInviteBreadcrumbs(mode === 'admin' ? 'super_admin' : jwtRole, groupName, surveyName, getDeploymentNumber(globalIndex));
  const { deployedAtLine, deploymentLabel } = getInviteDeploymentMeta(deployedAtText);
  document.getElementById('invite-context-text').textContent = `${surveyName}${deploymentLabel}`;
  document.getElementById('sc-invite-deployed-at').textContent = `Deployed at: ${deployedAtLine}`;
  navigateToPage(mode === 'admin' ? 'sa-invite' : 'sc-invite');
}

function openInvite(globalIndex) {
  openInviteShared(globalIndex, 'staff');
}

function openInviteAdmin(globalIndex) {
  openInviteShared(globalIndex, 'admin');
}

function generateLinks() {
  const raw = document.getElementById('invite-emails').value.trim();
  if (!raw) return;
  const emails = raw.split('\n').map(e => e.trim()).filter(Boolean);
  const useOtp = document.getElementById('opt-otp').checked;
  const saveEmail = document.getElementById('opt-save-email').checked;
  const generatedInvites = buildGeneratedInvites(emails, useOtp);
  document.getElementById('invite-links-body').innerHTML = generatedInvites.map(i =>
    `<tr><td>${i.email}</td><td>${i.otp}</td><td>${i.status}</td></tr>`
  ).join('');
  persistInvites(currentInviteDeploymentIndex, generatedInvites, saveEmail);
  document.getElementById('send-btn').textContent = 'Send ' + emails.length + ' email' + (emails.length !== 1 ? 's' : '') + ' now';
  document.getElementById('send-btn').disabled = false;
  document.getElementById('links-section').style.display = '';
  document.getElementById('send-btn').style.display = '';
  document.getElementById('invite-results').style.display = '';
}

async function sendEmails() {
  if (!assertJwtRole(['super_admin', 'survey_creator', 'survey_runner'])) return;
  if (!window.JwtStaticAuth || !window.JwtStaticAuth.authFetch) {
    window.alert('Auth client missing; load auth-client.js.');
    return;
  }
  const btn = document.getElementById('send-btn');
  const rows = document.querySelectorAll('#invite-links-body tr');
  const recipients = Array.from(rows).map(row => ({
    email: row.cells[0].textContent.trim(),
    otp: row.cells[1].textContent.trim()
  }));
  if (!recipients.length) return;
  btn.disabled = true;
  const prevLabel = btn.textContent;
  btn.textContent = 'Sending…';
  try {
    const res = await window.JwtStaticAuth.authFetch('/invite/send-participant-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) {
      btn.disabled = false;
      btn.textContent = prevLabel;
      const d = data.detail;
      window.alert(typeof d === 'string' ? d : 'Send unavailable (service not configured).');
      return;
    }
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = prevLabel;
      const d = data.detail;
      const msg = typeof d === 'string' ? d : (Array.isArray(d) ? d.map(e => e.msg || JSON.stringify(e)).join('; ') : 'Send failed');
      window.alert(msg);
      return;
    }
    mergeInviteSendResults(currentInviteDeploymentIndex, recipients, data.sent || [], data.failed || []);
    const sentSet = new Set((data.sent || []).map(s => s.email));
    const failSet = new Set((data.failed || []).map(f => f.email));
    rows.forEach((row, idx) => {
      const email = recipients[idx] && recipients[idx].email;
      if (sentSet.has(email)) row.cells[2].textContent = 'Sent';
      else if (failSet.has(email)) row.cells[2].textContent = 'Send failed';
    });
    const anyFailed = (data.failed || []).length > 0;
    btn.disabled = true;
    btn.textContent = anyFailed ? 'Done' : 'Sent';
    if (anyFailed) {
      window.alert('Some sends failed:\n' + (data.failed || []).map(f => `${f.email}: ${f.detail || ''}`).join('\n'));
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = prevLabel;
    window.alert(e && e.message ? e.message : 'Network error');
  }
}

function openParticipantMagicLink(link) {
  updateInviteByLink(link, invite => ({ ...invite, status: 'Opened' }));
  navigateToPage('p-otp');
}

function renderParticipantEmail() {
  const deployed = getDeployed();
  let otp = '';
  for (let di = 0; di < deployed.length; di++) {
    const invites = deployed[di].invites || [];
    const invite = invites.find(i => i.link === PARTICIPANT_DEMO_LINK);
    if (invite) {
      otp = invite.otp || '';
      break;
    }
  }
  document.getElementById('p-email-otp').textContent = otp || '(no OTP set)';
}

function continueParticipantOtp(link, isSuccess) {
  const nextStatus = isSuccess ? 'otp-pass' : 'otp-fail';
  updateInviteByLink(link, invite => ({ ...invite, status: nextStatus }));
  if (isSuccess) navigateToPage('p-survey');
}

function submitParticipantSurvey(link) {
  let submittedDeploymentIndex = null;
  updateInviteByLink(link, invite => ({ ...invite, status: 'Submitted' }), idx => { submittedDeploymentIndex = idx; });
  if (submittedDeploymentIndex === null) return;
  const deployed = getDeployed();
  deployed[submittedDeploymentIndex].submitted = (deployed[submittedDeploymentIndex].submitted || 0) + 1;
  saveDeployed(deployed);
}

function updateInviteByLink(link, updater, onFoundDeployment) {
  const deployed = getDeployed();
  const nowIso = new Date().toISOString();
  for (let di = 0; di < deployed.length; di++) {
    const invites = deployed[di].invites || [];
    const inviteIndex = invites.findIndex(i => i.link === link);
    if (inviteIndex !== -1) {
      invites[inviteIndex] = { ...updater(invites[inviteIndex]), lastActivityAt: nowIso };
      deployed[di].invites = invites;
      if (onFoundDeployment) onFoundDeployment(di);
      saveDeployed(deployed);
      return true;
    }
  }
  return false;
}

// Init
seedData();
openSharedLogin();
refreshFlowNavState();
