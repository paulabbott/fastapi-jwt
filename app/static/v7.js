const PAGES = [
  'sa-login','sa-overview','sa-group-detail','sa-group-admins','sa-invite','sa-tracking','sa-super-admins','sa-add-group','sa-add-group-user',
  'sc-login','sc-group-detail','sc-invite','sc-tracking',
  'p-email','p-otp','p-survey'
];

let currentGroupIndex = 1; // default to Meridian
let userRole = 'super_admin';
let activeFlowNav = 'flow1';
let currentTrackingDeploymentIndex = null;
let currentInviteDeploymentIndex = null;
const PARTICIPANT_DEMO_LINK = 'https://surveys.app/s/xdcf530k';

// ── Seed data ──
function seedData() {
  if (!localStorage.getItem('sb_seeded_v7')) {
    localStorage.setItem('sb_groups', JSON.stringify(V7_SEED_DATA.groups));
    localStorage.setItem('sb_surveys', JSON.stringify(V7_SEED_DATA.surveys));
    localStorage.setItem('sb_deployed', JSON.stringify(V7_SEED_DATA.deployed));
    localStorage.setItem('sb_superadmins', JSON.stringify(V7_SEED_DATA.superadmins));
    localStorage.setItem('sb_seeded_v7', '1');
  }
}

function getGroups()       { return JSON.parse(localStorage.getItem('sb_groups') || '[]'); }
function saveGroups(g)     { localStorage.setItem('sb_groups', JSON.stringify(g)); }
function getSurveys()      { return JSON.parse(localStorage.getItem('sb_surveys') || '[]'); }
function saveSurveys(s)    { localStorage.setItem('sb_surveys', JSON.stringify(s)); }
function getDeployed()     { return JSON.parse(localStorage.getItem('sb_deployed') || '[]'); }
function saveDeployed(d)   { localStorage.setItem('sb_deployed', JSON.stringify(d)); }
function getSuperAdmins()  { return JSON.parse(localStorage.getItem('sb_superadmins') || '[]'); }
function saveSuperAdmins(l){ localStorage.setItem('sb_superadmins', JSON.stringify(l)); }

// ── Navigation ──
const flow1NavIndexByPage = { 'sa-login': 0, 'sa-overview': 1, 'sa-super-admins': 2, 'sa-group-detail': 3, 'sa-invite': 4, 'sa-tracking': 5 };
const flow2NavIndexByPage = { 'sc-login': 0, 'sc-group-detail': 1, 'sc-invite': 2, 'sc-tracking': 3 };
const flow3NavIndexByPage = { 'sc-login': 0, 'sc-group-detail': 1, 'sc-invite': 2, 'sc-tracking': 3 };
const flow4NavIndexByPage = { 'p-email': 0, 'p-otp': 1, 'p-survey': 2 };

function openRoleFlowPage(id, role, flowNav) {
  userRole = role;
  activeFlowNav = flowNav;
  const roleLabel = document.getElementById('sc-login-role-label');
  if (roleLabel) roleLabel.textContent = 'Role: ' + role;
  navigateToPage(id);
}

function openSharedLogin(role, flowNav) {
  openRoleFlowPage('sc-login', role, flowNav);
}

function openRolePage(id, role, flowNav) {
  userRole = role;
  activeFlowNav = flowNav;
  navigateToPage(id);
}

function continueFromSharedLogin() {
  if (userRole === 'super_admin') {
    navigateToPage('sa-overview');
    return;
  }
  openRoleFlowPage('sc-group-detail', userRole, activeFlowNav);
}

function showGroupOverview() {
  if (userRole === 'super_admin') {
    navigateToPage('sa-overview');
    return;
  }
  navigateToPage('sc-group-detail');
}

function showGroupDetailPage() {
  if (userRole === 'super_admin') {
    navigateToPage('sa-group-detail');
    return;
  }
  navigateToPage('sc-group-detail');
}

function navigateToPage(id) {
  const effectiveId = (id === 'sa-invite' ? 'sc-invite' : (id === 'sa-tracking' ? 'sc-tracking' : id));
  PAGES.forEach(p => document.getElementById('page-' + p).style.display = p === effectiveId ? '' : 'none');
  document.querySelectorAll('#nav-flow1 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow2 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow3 button').forEach(b => b.classList.remove('active-btn'));
  document.querySelectorAll('#nav-flow4 button').forEach(b => b.classList.remove('active-btn'));
  if (id === 'sc-login' && activeFlowNav === 'flow1') {
    document.querySelectorAll('#nav-flow1 button')[0].classList.add('active-btn');
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
  if (id === 'sa-super-admins') renderSuperAdmins();
  if (id === 'sa-invite' || id === 'sc-invite') renderInviteLanding(id === 'sa-invite' ? 'super_admin' : userRole);
  if (id === 'sc-group-detail') renderScGroupDetail();
  if (id === 'sc-tracking')     renderTrackingViewShared(userRole);
  if (id === 'p-email')         renderParticipantEmail();
}

function resetDemoData() {
  localStorage.removeItem('sb_groups');
  localStorage.removeItem('sb_surveys');
  localStorage.removeItem('sb_deployed');
  localStorage.removeItem('sb_superadmins');
  localStorage.removeItem('sb_seeded_v7');
  seedData();
  openSharedLogin('super_admin', 'flow1');
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
  const groups = getGroups();
  const allDeployed = getDeployed();
  const deployed = allDeployed.filter(d => !d.closed);
  const surveys = getSurveys();
  const container = document.getElementById('overview-container');

  const sorted = [...deployed].sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));
  const deploymentRows = sorted.map(d => {
    const group = groups[d.groupIndex];
    const groupName = group ? group.name : 'Unknown group';
    return `
      <tr>
        <td><a onclick="openGroup(${d.groupIndex})" style="cursor:pointer;color:blue">${groupName}</a></td>
        <td>${d.name}</td>
        <td>${timeAgo(d.deployedAt)}</td>
        <td>${d.closed ? 'Closed' : 'Live'}</td>
        <td>${d.invited}</td>
        <td>${d.submitted}</td>
      </tr>`;
  }).join('');

  const groupRows = groups.map((g, gi) => {
    const surveyCount = surveys.filter(s => s.groupIndex === gi).length;
    const deploymentCount = allDeployed.filter(d => d.groupIndex === gi).length;
    const userCount = (g.users || []).length;
    const magicLinkCount = allDeployed
      .filter(d => d.groupIndex === gi)
      .reduce((acc, d) => acc + ((d.invites || []).length), 0);
    return `
      <tr>
        <td><a onclick="openGroup(${gi})" style="cursor:pointer;color:blue">${g.name}</a></td>
        <td>${surveyCount}</td>
        <td>${deploymentCount}</td>
        <td>${userCount}</td>
        <td>${magicLinkCount}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="5">No groups yet</td></tr>';

  container.innerHTML = `
    <h3>Live deployments</h3>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Group</th><th>Survey</th><th>Age</th><th>Status</th><th>Invited</th><th>Submitted</th></tr></thead>
      <tbody>${deploymentRows || '<tr><td colspan="6">No live deployments yet</td></tr>'}</tbody>
    </table>
    <br>
    <h3>Groups summary <button onclick="navigateToPage('sa-add-group')">+ Add group</button></h3>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Group</th><th>Surveys</th><th>Deployments</th><th>Users</th><th>Magic links created</th></tr></thead>
      <tbody>${groupRows}</tbody>
    </table>`;
}

function openGroup(i) {
  currentGroupIndex = i;
  navigateToPage('sa-group-detail');
}

function addGroup() {
  const name = document.getElementById('sa-co-name').value.trim();
  if (!name) return;
  const groups = getGroups();
  groups.push({ name, users: [] });
  saveGroups(groups);
  document.getElementById('sa-co-name').value = '';
  navigateToPage('sa-overview');
}

// ── F1: Group detail ──
function renderSaGroupDetail() {
  const groups = getGroups();
  const group = groups[currentGroupIndex];
  document.getElementById('sa-group-crumb').textContent = group.name;
  document.getElementById('sa-group-title').textContent = group.name;
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
  const groups = getGroups();
  const group = groups[currentGroupIndex];
  const crumbs = document.getElementById('group-admins-breadcrumbs');
  if (userRole === 'super_admin') {
    crumbs.innerHTML = `
      <span>Admin</span> /
      <a onclick="showGroupOverview()">Overview</a> /
      <a onclick="showGroupDetailPage()">${group.name}</a> /
      <span>group admins</span>
    `;
  } else {
    crumbs.innerHTML = `
      <span>${group.name}</span> /
      <a onclick="showGroupOverview()">Dashboard</a> /
      <span>group admins</span>
    `;
  }
  document.getElementById('sa-add-user-title').textContent = 'Add user — ' + group.name;
  document.getElementById('sa-group-users-body').innerHTML = group.users.length
    ? group.users.map((u, i) => `
        <tr>
          <td>${u.email}</td>
          <td>${u.role}</td>
          <td><button onclick="removeGroupUser(${i})">Remove</button></td>
        </tr>`).join('')
    : '<tr><td colspan="3">No users yet</td></tr>';
}

function addGroupUser() {
  const email = document.getElementById('sa-cu-email').value.trim();
  const role  = document.getElementById('sa-cu-role').value;
  if (!email) return;
  const groups = getGroups();
  groups[currentGroupIndex].users.push({ email, role });
  saveGroups(groups);
  document.getElementById('sa-cu-email').value = '';
  navigateToPage('sa-group-admins');
}
function removeGroupUser(i) {
  const groups = getGroups();
  groups[currentGroupIndex].users.splice(i, 1);
  saveGroups(groups);
  renderSaGroupAdmins();
}

// ── F1: Super admins ──
function addSuperAdmin() {
  const email = document.getElementById('new-sa-email').value.trim();
  if (!email) return;
  const list = getSuperAdmins();
  list.push({ email });
  saveSuperAdmins(list);
  document.getElementById('new-sa-email').value = '';
  renderSuperAdmins();
}
function removeSuperAdmin(i) {
  const list = getSuperAdmins();
  list.splice(i, 1);
  saveSuperAdmins(list);
  renderSuperAdmins();
}
function renderSuperAdmins() {
  document.getElementById('superadmins-body').innerHTML = getSuperAdmins().map((u, i) => `
    <tr><td>${u.email}</td><td><button onclick="removeSuperAdmin(${i})">Remove</button></td></tr>`).join('');
}

// ── F2: Group detail (creator) ──
function renderScGroupDetail() {
  const groups = getGroups();
  const group = groups[currentGroupIndex];
  const isSurveyRunner = userRole === 'survey_runner';
  document.getElementById('sc-group-title').textContent = group ? group.name : 'Unknown group';
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
  return getDeployed()
    .map((d, i) => ({ ...d, globalIndex: i }))
    .filter(d => d.groupIndex === currentGroupIndex)
    .sort((a, b) => {
      if (!!a.closed !== !!b.closed) return a.closed ? 1 : -1;
      return new Date(b.deployedAt) - new Date(a.deployedAt);
    });
}

function renderGroupDetailTables(config) {
  const showEditButton = config.showEditButton !== false;
  const surveys = getSurveys().filter(s => s.groupIndex === currentGroupIndex);
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
  surveys.push({ id: newId, name, groupIndex: currentGroupIndex });
  saveSurveys(surveys);
}

function deploySurveyForCurrentGroup(id) {
  const survey = getSurveys().find(s => s.id === id);
  if (!survey) return;
  const deployed = getDeployed();
  deployed.push({ name: survey.name, groupIndex: currentGroupIndex, deployedAt: new Date().toISOString(), invited: 0, submitted: 0 });
  saveDeployed(deployed);
}

function toggleSurveyClosed(globalIndex) {
  const deployed = getDeployed();
  deployed[globalIndex].closed = !deployed[globalIndex].closed;
  saveDeployed(deployed);
}

function openTracking(globalIndex) {
  userRole = userRole || 'survey_creator';
  currentTrackingDeploymentIndex = globalIndex;
  navigateToPage('sc-tracking');
}

function openTrackingAdmin(globalIndex) {
  userRole = 'super_admin';
  currentTrackingDeploymentIndex = globalIndex;
  navigateToPage('sa-tracking');
}

function renderTrackingViewShared(role) {
  const deployed = getDeployed();
  let d = deployed[currentTrackingDeploymentIndex];
  let usedFallback = false;
  if (!d) {
    const fallbackIndex = deployed.findIndex(item =>
      item.groupIndex === currentGroupIndex &&
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
    document.getElementById('tracking-emails-body').innerHTML = '<tr><td colspan="5">No invites yet</td></tr>';
    return;
  }
  document.getElementById('sc-tracking-demo-note').style.display = usedFallback ? '' : 'none';

  const group = getGroups()[d.groupIndex];
  const groupName = group ? group.name : 'Unknown group';
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
      return `<tr><td>${i.email || 'removed'}</td><td>${i.link || ''}</td><td>${i.otp || ''}</td><td>${i.status}</td><td>${activityAt ? timeAgo(activityAt) : ''}</td></tr>`;
    }).join('')
    : '<tr><td colspan="5">No invites yet</td></tr>';
}

function deleteTrackedEmails() {
  if (currentTrackingDeploymentIndex === null) return;
  const deployed = getDeployed();
  const d = deployed[currentTrackingDeploymentIndex];
  if (!d) return;
  d.invites = (d.invites || []).map(i => ({ ...i, email: '' }));
  d.tracked = 'deleted';
  saveDeployed(deployed);
  renderTrackingViewShared(userRole);
}

function getDeploymentContext(globalIndex) {
  const deployed = getDeployed();
  const d = deployed[globalIndex];
  const group = d ? getGroups()[d.groupIndex] : null;
  const groupName = group ? group.name : 'Unknown group';
  const surveyName = d ? d.name : 'Unknown survey';
  let deployedAtText = d && d.deployedAt ? new Date(d.deployedAt).toLocaleString() : 'Unknown';
  if (d) {
    const siblings = deployed
      .map((item, idx) => ({ ...item, globalIndex: idx }))
      .filter(item => item.groupIndex === d.groupIndex && item.name === d.name)
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
    .filter(item => item.groupIndex === d.groupIndex && item.name === d.name)
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
  return emails.map(email => {
    const uid = Math.random().toString(36).slice(2, 10);
    return {
      email,
      link: 'https://surveys.app/s/' + uid,
      otp: useOtp ? Math.random().toString(36).slice(2, 7).toUpperCase() : '',
      status: 'Pending',
      lastActivityAt: nowIso
    };
  });
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

function markInvitesSent(globalIndex) {
  const deployed = getDeployed();
  if (globalIndex === null || !deployed[globalIndex] || !deployed[globalIndex].invites) return;
  const nowIso = new Date().toISOString();
  deployed[globalIndex].invites = deployed[globalIndex].invites.map(i => ({ ...i, status: 'Sent', lastActivityAt: nowIso }));
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
  const group = getGroups()[currentGroupIndex];
  const groupName = group ? group.name : 'Unknown group';
  renderInviteBreadcrumbs(role, groupName, '', '');
  document.getElementById('sc-invite-deployed-at').textContent = '';
  document.getElementById('invite-context-text').textContent = '';
}

function openInviteShared(globalIndex, role) {
  userRole = role;
  currentInviteDeploymentIndex = globalIndex;
  const { groupName, surveyName, deployedAtText } = getDeploymentContext(globalIndex);
  renderInviteBreadcrumbs(role, groupName, surveyName, getDeploymentNumber(globalIndex));
  const { deployedAtLine, deploymentLabel } = getInviteDeploymentMeta(deployedAtText);
  document.getElementById('invite-context-text').textContent = `${surveyName}${deploymentLabel}`;
  document.getElementById('sc-invite-deployed-at').textContent = `Deployed at: ${deployedAtLine}`;
  navigateToPage(role === 'super_admin' ? 'sa-invite' : 'sc-invite');
}

function openInvite(globalIndex) {
  openInviteShared(globalIndex, userRole);
}

function openInviteAdmin(globalIndex) {
  openInviteShared(globalIndex, 'super_admin');
}

function generateLinks() {
  const raw = document.getElementById('invite-emails').value.trim();
  if (!raw) return;
  const emails = raw.split('\n').map(e => e.trim()).filter(Boolean);
  const useOtp = document.getElementById('opt-otp').checked;
  const saveEmail = document.getElementById('opt-save-email').checked;
  const generatedInvites = buildGeneratedInvites(emails, useOtp);
  document.getElementById('invite-links-body').innerHTML = generatedInvites.map(i =>
    `<tr><td>${i.email}</td><td>${i.link}</td><td>${i.otp}</td><td>${i.status}</td></tr>`
  ).join('');
  persistInvites(currentInviteDeploymentIndex, generatedInvites, saveEmail);
  document.getElementById('send-btn').textContent = 'Send ' + emails.length + ' email' + (emails.length !== 1 ? 's' : '') + ' now';
  document.getElementById('send-btn').disabled = false;
  document.getElementById('links-section').style.display = '';
  document.getElementById('send-btn').style.display = '';
  document.getElementById('invite-results').style.display = '';
}

function sendEmails() {
  document.querySelectorAll('#invite-links-body tr').forEach(row => { row.cells[3].textContent = 'Sent'; });
  markInvitesSent(currentInviteDeploymentIndex);
  document.getElementById('send-btn').disabled = true;
  document.getElementById('send-btn').textContent = 'Sent';
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
openSharedLogin('super_admin', 'flow1');
