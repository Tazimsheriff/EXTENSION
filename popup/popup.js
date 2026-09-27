/**
 * HackFill popup. Works in Chrome and Firefox (MV3).
 * Team model: you are slot 0. team.slots[i] is the person forms call "Teammate (i+1)" and "Member (i+2)".
 */

const ext = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
const MAX_TEAM = 6;

const Storage = {
  async get(keys) {
    if (ext && ext.storage && ext.storage.local) return ext.storage.local.get(keys);
    const res = {};
    (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
      const raw = localStorage.getItem('hackfill_' + k);
      if (raw) {
        try { res[k] = JSON.parse(raw); } catch (e) { res[k] = raw; }
      }
    });
    return res;
  },
  async set(data) {
    if (ext && ext.storage && ext.storage.local) return ext.storage.local.set(data);
    Object.entries(data).forEach(([k, v]) => localStorage.setItem('hackfill_' + k, JSON.stringify(v)));
  }
};

const DEMO_DATA = {
  profile: {
    fullName: 'Alex Rivera',
    email: 'alex.rivera@cs.edu',
    phone: '+1 (415) 890-3412',
    location: 'San Francisco, CA',
    github: 'https://github.com/alexrivera-dev',
    linkedin: 'https://linkedin.com/in/alex-rivera-tech',
    portfolio: 'https://alexrivera.dev',
    resume: 'https://drive.google.com/file/d/1demo-alex-rivera-resume/view',
    discord: 'arivera',
    devfolio: 'https://devfolio.co/@alexrivera',
    college: 'University of California, Berkeley',
    degree: 'B.S. Electrical Engineering & Computer Science',
    gradYear: '2026',
    secId: '21CS104',
    customVariables: [
      { id: 'cv_demo_1', name: 'HackerRank ID', value: 'alex_hack26' },
      { id: 'cv_demo_2', name: 'Telegram', value: '@alexrivera_dev' }
    ],
    tshirt: 'L',
    diet: 'Vegetarian',
    emergency: 'Maria Rivera (+1 415-555-0199)'
  },
  teammates: [
    {
      id: 'tm_demo_1', name: 'Sophia Chen', email: 'sophia.chen@mit.edu', phone: '+1 (617) 555-0144',
      college: 'MIT', degree: 'B.S. Computer Science', gradYear: '2026', secId: '21CS205', location: 'Cambridge, MA',
      github: 'https://github.com/sophiachen-ai', linkedin: 'https://linkedin.com/in/sophiachen-ai',
      portfolio: 'https://sophiachen.dev', resume: 'https://drive.google.com/file/d/1demo-sophia-resume/view',
      discord: 'sophia', tshirt: 'M', diet: 'None',
      customVariables: [{ id: 'cv_s1', name: 'HackerRank ID', value: 'sophia_chen' }]
    },
    {
      id: 'tm_demo_2', name: 'Marcus Vance', email: 'marcus.vance@stanford.edu', phone: '+1 (650) 555-0182',
      college: 'Stanford University', degree: 'B.S. Computer Science', gradYear: '2027', secId: '21CS208', location: 'Palo Alto, CA',
      github: 'https://github.com/marcusvance', linkedin: 'https://linkedin.com/in/marcus-vance',
      resume: 'https://drive.google.com/file/d/1demo-marcus-resume/view', discord: 'mvance', tshirt: 'XL', diet: 'Halal',
      customVariables: []
    },
    {
      id: 'tm_demo_3', name: 'Ananya Patel', email: 'ananya.patel@georgiatech.edu', phone: '+1 (404) 555-0163',
      college: 'Georgia Tech', degree: 'B.S. Computer Science', gradYear: '2026', secId: '21CS301', location: 'Atlanta, GA',
      github: 'https://github.com/ananyapatel', linkedin: 'https://linkedin.com/in/ananya-patel',
      resume: 'https://drive.google.com/file/d/1demo-ananya-resume/view', discord: 'ananya', tshirt: 'S', diet: 'Vegan',
      customVariables: []
    }
  ],
  team: { size: 4, slots: ['tm_demo_1', 'tm_demo_2', 'tm_demo_3'] },
  snippets: [
    { id: 'snip_1', title: 'Tell us about a project you are proud of', category: 'Pitch', content: 'Built an offline audio transcription tool that runs in the browser with WebAssembly and ONNX. It won the accessibility track at a 36-hour hackathon.' },
    { id: 'snip_2', title: 'Why do you want to participate in this hackathon?', category: 'Motivation', content: 'I want a weekend with builders who ship. My team is aiming for a working product, not a slide deck, and this event is the right room for that.' },
    { id: 'snip_3', title: 'Personal bio', category: 'Bio', content: 'Student developer focused on interfaces, distributed systems, and hackathons. I like small teams, clear problems, and code that still works on Sunday night.' }
  ],
  tracker: [
    { id: 'app_1', eventName: 'TreeHacks 2026', eventUrl: 'https://treehacks.com', appliedDate: '2026-01-15', status: 'Accepted', squad: 'Alex Rivera, Sophia Chen, Marcus Vance', notes: 'AI track. Team code TH26-88' }
  ]
};

const appState = { profile: {}, teammates: [], snippets: [], tracker: [], team: { size: 1, slots: [] } };

const $ = (id) => document.getElementById(id);
const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  teammateCount: $('teammateCount'),
  trackerCount: $('trackerCount'),
  popoutBtn: $('popoutBtn'),
  quickAutofillBtn: $('quickAutofillBtn'),
  quickLogBtn: $('quickLogBtn'),
  pageDetectBadge: $('pageDetectBadge'),
  profileForm: $('profileForm'),
  customVarsContainer: $('customVarsContainer'),
  addCustomVarBtn: $('addCustomVarBtn'),
  autoSaveStatus: $('autoSaveStatus'),
  autoSaveText: $('autoSaveText'),
  teammatesList: $('teammatesList'),
  teammateSearch: $('teammateSearch'),
  addTeammateBtn: $('addTeammateBtn'),
  teamSizeBar: $('teamSizeBar'),
  lineup: $('lineup'),
  teammateModal: $('teammateModal'),
  teammateForm: $('teammateForm'),
  closeTeammateModal: $('closeTeammateModal'),
  cancelTeammateBtn: $('cancelTeammateBtn'),
  teammateModalTitle: $('teammateModalTitle'),
  tmSaveState: $('tmSaveState'),
  snippetsList: $('snippetsList'),
  addSnippetBtn: $('addSnippetBtn'),
  snippetModal: $('snippetModal'),
  snippetForm: $('snippetForm'),
  closeSnippetModal: $('closeSnippetModal'),
  cancelSnippetBtn: $('cancelSnippetBtn'),
  snippetModalTitle: $('snippetModalTitle'),
  trackerList: $('trackerList'),
  statusFilter: $('statusFilter'),
  addAppBtn: $('addAppBtn'),
  trackerModal: $('trackerModal'),
  trackerForm: $('trackerForm'),
  closeTrackerModal: $('closeTrackerModal'),
  cancelTrackerBtn: $('cancelTrackerBtn'),
  trackerModalTitle: $('trackerModalTitle'),
  exportDataBtn: $('exportDataBtn'),
  importDataInput: $('importDataInput'),
  loadDemoBtn: $('loadDemoBtn'),
  clearDataBtn: $('clearDataBtn'),
  toast: $('toast')
};

let teammateSnapshot = null;
let teammateCreatedId = null;
let teammateSaveTimer = null;
let profileSaveTimer = null;
let profileBound = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initNavigation();
  initProfile();
  initSquad();
  initSnippets();
  initTracker();
  initSettings();
  checkCurrentPageForms();
  window.addEventListener('pagehide', () => {
    saveProfileImmediate(false);
    if (!elements.teammateModal.classList.contains('hidden')) persistTeammateFromForm();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopModal();
  });
});

function clampSize(n) {
  const size = Number(n);
  if (!Number.isFinite(size)) return 1;
  return Math.max(1, Math.min(MAX_TEAM, Math.round(size)));
}

function normalizeTeam(team, teammates) {
  const ids = new Set((teammates || []).map((t) => t.id));
  if (team && Array.isArray(team.slots)) {
    const size = clampSize(team.size || team.slots.length + 1);
    const slots = [];
    for (let i = 0; i < size - 1; i++) {
      const id = team.slots[i];
      slots.push(id && ids.has(id) ? id : null);
    }
    return { size, slots };
  }
  const sparse = [];
  (teammates || []).forEach((t) => {
    const pos = Number(t.squadPos);
    if (pos >= 1 && pos <= MAX_TEAM - 1) sparse[pos - 1] = t.id;
  });
  const last = sparse.length ? sparse.length : 0;
  const slots = [];
  for (let i = 0; i < last; i++) slots.push(sparse[i] && ids.has(sparse[i]) ? sparse[i] : null);
  const size = slots.length ? slots.length + 1 : 1;
  return { size: clampSize(size), slots };
}

function syncSquadPos() {
  const slotOf = new Map();
  appState.team.slots.forEach((id, i) => { if (id) slotOf.set(id, i + 1); });
  appState.teammates.forEach((t) => { t.squadPos = slotOf.get(t.id) || null; });
}

async function loadState() {
  const data = await Storage.get(['profile', 'teammates', 'snippets', 'tracker', 'team']);
  appState.profile = data.profile || {};
  appState.teammates = Array.isArray(data.teammates) ? data.teammates : [];
  appState.snippets = Array.isArray(data.snippets) ? data.snippets : [];
  appState.tracker = Array.isArray(data.tracker) ? data.tracker : [];
  appState.team = normalizeTeam(data.team, appState.teammates);
  if (!data.team) {
    syncSquadPos();
    await Storage.set({ team: appState.team, teammates: appState.teammates });
  }
  updateBadgeCounts();
}

function updateBadgeCounts() {
  elements.teammateCount.textContent = appState.teammates.length ? String(appState.teammates.length) : '';
  elements.trackerCount.textContent = appState.tracker.length ? String(appState.tracker.length) : '';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  clearTimeout(elements.toast._timer);
  elements.toast._timer = setTimeout(() => elements.toast.classList.add('hidden'), 2200);
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function copyToClipboard(text, label) {
  if (!text) { showToast('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(label ? 'Copied ' + label : 'Copied');
}

function sendTab(tabId, message) {
  return new Promise((resolve, reject) => {
    if (!ext || !ext.tabs || !ext.tabs.sendMessage) {
      reject(new Error('No tab API'));
      return;
    }
    let done = false;
    const finish = (err, res) => {
      if (done) return;
      done = true;
      if (err) reject(err);
      else resolve(res);
    };
    try {
      const ret = ext.tabs.sendMessage(tabId, message, (res) => {
        const err = ext.runtime && ext.runtime.lastError;
        finish(err ? new Error(err.message) : null, res);
      });
      if (ret && typeof ret.then === 'function') ret.then((res) => finish(null, res), (err) => finish(err));
    } catch (err) {
      finish(err);
    }
  });
}

function switchTab(name) {
  elements.navTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  elements.tabPanes.forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
}

function initNavigation() {
  elements.navTabs.forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  elements.quickAutofillBtn.addEventListener('click', triggerPageAutofill);
  elements.quickLogBtn.addEventListener('click', openTrackerModalForCurrentTab);
  if (elements.popoutBtn && !location.search.includes('standalone=true')) {
    elements.popoutBtn.addEventListener('click', () => {
      const url = ext && ext.runtime ? ext.runtime.getURL('popup/popup.html?standalone=true') : 'popup.html?standalone=true';
      if (ext && ext.windows && ext.windows.create) {
        ext.windows.create({ url, type: 'popup', width: 480, height: 760 });
        window.close();
      } else {
        window.open(url, 'HackFill', 'width=480,height=760');
      }
    });
  }
}

function setSaveStatus(mode) {
  elements.autoSaveStatus.className = 'save-state ' + mode;
  elements.autoSaveText.textContent = mode === 'saving' ? 'Saving' : 'Saved';
}

function triggerAutoSave() {
  setSaveStatus('saving');
  clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => saveProfileImmediate(false), 200);
}

async function saveProfileImmediate(notify) {
  clearTimeout(profileSaveTimer);
  const profile = { ...appState.profile };
  const data = new FormData(elements.profileForm);
  for (const [key, val] of data.entries()) {
    if (key !== 'customVarName' && key !== 'customVarValue') profile[key] = String(val).trim();
  }
  const customVars = [];
  elements.customVarsContainer.querySelectorAll('.var-row').forEach((row) => {
    const name = row.querySelector('.custom-var-name').value.trim();
    const value = row.querySelector('.custom-var-val').value.trim();
    if (!name) return;
    customVars.push({ id: row.dataset.id || ('cv_' + Date.now()), name, value });
  });
  profile.customVariables = customVars;
  appState.profile = profile;
  await Storage.set({ profile });
  setSaveStatus('saved');
  if (notify) showToast('Profile saved');
  renderLineup();
}

function renderCustomVariables() {
  const list = appState.profile.customVariables || [];
  if (!list.length) {
    elements.customVarsContainer.innerHTML = '<p class="hint">No extra fields yet.</p>';
    return;
  }
  elements.customVarsContainer.innerHTML = list.map((cv) => `
    <div class="var-row" data-id="${escapeHTML(cv.id)}">
      <input class="custom-var-name" type="text" value="${escapeHTML(cv.name)}" placeholder="Field name">
      <input class="custom-var-val" type="text" value="${escapeHTML(cv.value)}" placeholder="Value">
      <button class="icon-btn copy-var" type="button" title="Copy">Copy</button>
      <button class="icon-btn danger del-var" type="button" title="Remove">Del</button>
    </div>
  `).join('');
}

function fillProfileForm() {
  ['fullName', 'email', 'phone', 'location', 'github', 'linkedin', 'portfolio', 'resume', 'discord', 'devfolio', 'college', 'degree', 'gradYear', 'secId', 'tshirt', 'diet', 'emergency'].forEach((key) => {
    const input = $(key);
    if (input) input.value = appState.profile[key] || (key === 'diet' ? 'None' : '');
  });
  renderCustomVariables();
}

function initProfile() {
  fillProfileForm();
  if (profileBound) return;
  profileBound = true;
  elements.profileForm.addEventListener('input', triggerAutoSave);
  elements.profileForm.addEventListener('change', triggerAutoSave);
  elements.profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProfileImmediate(true);
  });
  elements.addCustomVarBtn.addEventListener('click', () => {
    if (!appState.profile.customVariables) appState.profile.customVariables = [];
    appState.profile.customVariables.push({ id: 'cv_' + Date.now(), name: '', value: '' });
    renderCustomVariables();
    const rows = elements.customVarsContainer.querySelectorAll('.var-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('.custom-var-name').focus();
  });
  elements.customVarsContainer.addEventListener('click', async (e) => {
    const row = e.target.closest('.var-row');
    if (!row) return;
    if (e.target.closest('.copy-var')) {
      copyToClipboard(row.querySelector('.custom-var-val').value, row.querySelector('.custom-var-name').value);
    }
    if (e.target.closest('.del-var')) {
      row.remove();
      await saveProfileImmediate(false);
      renderCustomVariables();
    }
  });
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      copyToClipboard(input && input.value, btn.dataset.target);
    });
  });
}

function slotLabel(index) {
  return 'Teammate ' + (index + 1);
}

function personById(id) {
  return appState.teammates.find((t) => t.id === id) || null;
}

async function commitTeam() {
  appState.team = normalizeTeam(appState.team, appState.teammates);
  syncSquadPos();
  await Storage.set({ team: appState.team, teammates: appState.teammates });
  renderSquad(elements.teammateSearch.value);
}

function renderSizeBar() {
  let html = '';
  for (let size = 1; size <= MAX_TEAM; size++) {
    html += `<button type="button" class="size-btn${appState.team.size === size ? ' active' : ''}" data-size="${size}">${size}</button>`;
  }
  elements.teamSizeBar.innerHTML = html;
}

function renderLineup() {
  const you = appState.profile.fullName || 'Your profile';
  let html = `
    <div class="slot you">
      <div class="slot-no">01</div>
      <div>
        <div class="slot-label">You · Member 1 · Lead</div>
        <strong>${escapeHTML(you)}</strong>
      </div>
    </div>`;
  appState.team.slots.forEach((id, index) => {
    const options = ['<option value="">Empty slot</option>'].concat(appState.teammates.map((t) => {
      const taken = appState.team.slots.some((slotId, i) => slotId === t.id && i !== index);
      const note = taken ? ' (in another slot)' : '';
      return `<option value="${escapeHTML(t.id)}"${t.id === id ? ' selected' : ''}>${escapeHTML(t.name || 'Unnamed')}${note}</option>`;
    }));
    html += `
      <div class="slot">
        <div class="slot-no">${String(index + 2).padStart(2, '0')}</div>
        <div>
          <div class="slot-label">${slotLabel(index)} · Member ${index + 2}</div>
          <select data-slot="${index}">${options.join('')}</select>
        </div>
      </div>`;
  });
  elements.lineup.innerHTML = html;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function renderVault(filter) {
  const query = String(filter || '').trim().toLowerCase();
  const list = appState.teammates.filter((t) => {
    if (!query) return true;
    return [t.name, t.email, t.college, t.github, t.discord, t.secId].some((v) => String(v || '').toLowerCase().includes(query));
  });
  if (!appState.teammates.length) {
    elements.teammatesList.innerHTML = '<div class="empty"><strong>No one saved yet</strong>Add the people you actually apply with. Then drop them into the lineup.</div>';
    return;
  }
  if (!list.length) {
    elements.teammatesList.innerHTML = '<div class="empty"><strong>No matches</strong>Try another name, college, or email.</div>';
    return;
  }
  elements.teammatesList.innerHTML = list.map((tm) => {
    const slot = appState.team.slots.indexOf(tm.id);
    const chips = [
      ['ID', tm.secId], ['GitHub', tm.github], ['LinkedIn', tm.linkedin], ['Resume', tm.resume],
      ['Email', tm.email], ['Phone', tm.phone], ['Discord', tm.discord]
    ].filter((pair) => pair[1]);
    (tm.customVariables || []).forEach((cv) => { if (cv.name && cv.value) chips.push([cv.name, cv.value]); });
    return `
      <article class="card" data-id="${escapeHTML(tm.id)}">
        <div class="card-top">
          <div class="who">
            <div class="avatar">${escapeHTML(initials(tm.name))}</div>
            <div>
              <div class="card-title">${escapeHTML(tm.name || 'Unnamed')}${slot >= 0 ? `<span class="slot-tag">${slotLabel(slot)}</span>` : ''}</div>
              <div class="card-meta">${escapeHTML(tm.college || tm.email || 'No college yet')}</div>
            </div>
          </div>
          <div>
            <button class="icon-btn edit-tm" type="button" title="Edit">Edit</button>
            <button class="icon-btn danger delete-tm" type="button" title="Delete">Del</button>
          </div>
        </div>
        <div class="chips">${chips.map(([label, value]) => `<button type="button" class="chip" data-copy="${escapeHTML(value)}">${escapeHTML(label)}</button>`).join('')}</div>
      </article>`;
  }).join('');
}

function renderSquad(filter) {
  renderSizeBar();
  renderLineup();
  renderVault(filter);
}

function readCustomVarRows(container) {
  const vars = [];
  container.querySelectorAll('.var-row').forEach((row) => {
    const name = row.querySelector('.custom-var-name').value.trim();
    const value = row.querySelector('.custom-var-val').value.trim();
    if (!name) return;
    vars.push({ id: row.dataset.id || ('cv_' + Date.now()), name, value });
  });
  return vars;
}

function renderTmCustomVars(list) {
  const container = $('tmCustomVarsContainer');
  if (!list || !list.length) {
    container.innerHTML = '<p class="hint">No extra fields for this person.</p>';
    return;
  }
  container.innerHTML = list.map((cv) => `
    <div class="var-row" data-id="${escapeHTML(cv.id)}">
      <input class="custom-var-name" type="text" value="${escapeHTML(cv.name)}" placeholder="Field name">
      <input class="custom-var-val" type="text" value="${escapeHTML(cv.value)}" placeholder="Their value">
      <span></span>
      <button class="icon-btn danger del-tm-var" type="button">Del</button>
    </div>
  `).join('');
}

function syncNamesOnto(existing) {
  const merged = (existing || []).map((v) => ({ ...v }));
  (appState.profile.customVariables || []).forEach((pv) => {
    const name = String(pv.name || '').trim();
    if (!name) return;
    const has = merged.some((tv) => tv.name.trim().toLowerCase() === name.toLowerCase());
    if (!has) merged.push({ id: 'cv_' + Date.now() + Math.random().toString(36).slice(2, 5), name, value: '' });
  });
  return merged;
}

function readTeammateForm() {
  const data = new FormData(elements.teammateForm);
  const teammate = { id: data.get('id') || '' };
  for (const [key, val] of data.entries()) {
    if (key !== 'id') teammate[key] = String(val).trim();
  }
  teammate.customVariables = readCustomVarRows($('tmCustomVarsContainer'));
  const prev = personById(teammate.id);
  teammate.squadPos = prev ? prev.squadPos : null;
  return teammate;
}

async function persistTeammateFromForm() {
  const teammate = readTeammateForm();
  if (!teammate.name) return false;
  if (!teammate.id) {
    teammate.id = 'tm_' + Date.now();
    $('teammateId').value = teammate.id;
    teammateCreatedId = teammate.id;
    appState.teammates.push(teammate);
  } else {
    const index = appState.teammates.findIndex((t) => t.id === teammate.id);
    if (index >= 0) appState.teammates[index] = teammate;
    else appState.teammates.push(teammate);
  }
  syncSquadPos();
  await Storage.set({ teammates: appState.teammates, team: appState.team });
  updateBadgeCounts();
  renderSquad(elements.teammateSearch.value);
  if (elements.tmSaveState) elements.tmSaveState.textContent = 'Saved';
  return true;
}

function scheduleTeammateSave() {
  if (elements.tmSaveState) elements.tmSaveState.textContent = 'Saving';
  clearTimeout(teammateSaveTimer);
  teammateSaveTimer = setTimeout(() => persistTeammateFromForm(), 180);
}

function openTeammateModal(tm) {
  teammateCreatedId = null;
  teammateSnapshot = tm ? JSON.parse(JSON.stringify(tm)) : null;
  elements.teammateForm.reset();
  $('teammateId').value = tm ? tm.id : '';
  const fields = {
    tmName: 'name', tmEmail: 'email', tmPhone: 'phone', tmLocation: 'location', tmCollege: 'college',
    tmDegree: 'degree', tmGradYear: 'gradYear', tmSecId: 'secId', tmGithub: 'github', tmLinkedin: 'linkedin',
    tmPortfolio: 'portfolio', tmResume: 'resume', tmDiscord: 'discord', tmTshirt: 'tshirt', tmDiet: 'diet'
  };
  Object.entries(fields).forEach(([id, key]) => {
    const input = $(id);
    if (!input) return;
    input.value = tm && tm[key] ? tm[key] : (key === 'diet' ? 'None' : '');
  });
  const vars = tm && Array.isArray(tm.customVariables) ? tm.customVariables : syncNamesOnto([]);
  renderTmCustomVars(vars);
  elements.teammateModalTitle.textContent = tm ? 'Edit teammate' : 'Add teammate';
  if (elements.tmSaveState) elements.tmSaveState.textContent = 'Saves as you type';
  elements.teammateModal.classList.remove('hidden');
  $('tmName').focus();
}

async function discardTeammateModal() {
  clearTimeout(teammateSaveTimer);
  if (teammateSnapshot) {
    const index = appState.teammates.findIndex((t) => t.id === teammateSnapshot.id);
    if (index >= 0) appState.teammates[index] = teammateSnapshot;
    else appState.teammates.push(teammateSnapshot);
  } else if (teammateCreatedId) {
    appState.teammates = appState.teammates.filter((t) => t.id !== teammateCreatedId);
    appState.team.slots = appState.team.slots.map((id) => id === teammateCreatedId ? null : id);
  }
  syncSquadPos();
  await Storage.set({ teammates: appState.teammates, team: appState.team });
  updateBadgeCounts();
  renderSquad(elements.teammateSearch.value);
  elements.teammateModal.classList.add('hidden');
}

function initSquad() {
  renderSquad();
  elements.teamSizeBar.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn) return;
    const size = clampSize(btn.dataset.size);
    const slots = [];
    for (let i = 0; i < size - 1; i++) slots.push(appState.team.slots[i] || null);
    appState.team = { size, slots };
    await commitTeam();
    showToast(size === 1 ? 'Solo. Only your details will fill.' : 'Team size is ' + size);
  });
  elements.lineup.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-slot]');
    if (!sel) return;
    const index = Number(sel.dataset.slot);
    const id = sel.value || null;
    const slots = appState.team.slots.slice();
    if (id) {
      slots.forEach((slotId, i) => { if (i !== index && slotId === id) slots[i] = null; });
    }
    slots[index] = id;
    appState.team.slots = slots;
    await commitTeam();
    showToast(id ? 'Lineup updated' : 'Slot cleared');
  });
  elements.teammateSearch.addEventListener('input', () => renderVault(elements.teammateSearch.value));
  elements.addTeammateBtn.addEventListener('click', () => openTeammateModal(null));
  elements.closeTeammateModal.addEventListener('click', () => {
    persistTeammateFromForm();
    elements.teammateModal.classList.add('hidden');
  });
  elements.cancelTeammateBtn.addEventListener('click', discardTeammateModal);
  elements.teammateForm.addEventListener('input', scheduleTeammateSave);
  elements.teammateForm.addEventListener('change', scheduleTeammateSave);
  elements.teammateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await persistTeammateFromForm();
    if (!ok) { showToast('Add a name first'); return; }
    elements.teammateModal.classList.add('hidden');
    showToast('Teammate saved');
  });
  $('syncTmCustomVarsBtn').addEventListener('click', () => {
    renderTmCustomVars(syncNamesOnto(readCustomVarRows($('tmCustomVarsContainer'))));
    scheduleTeammateSave();
  });
  $('addTmCustomVarBtn').addEventListener('click', () => {
    const current = readCustomVarRows($('tmCustomVarsContainer'));
    current.push({ id: 'cv_' + Date.now(), name: '', value: '' });
    renderTmCustomVars(current);
    const rows = $('tmCustomVarsContainer').querySelectorAll('.var-row');
    rows[rows.length - 1].querySelector('.custom-var-name').focus();
  });
  $('tmCustomVarsContainer').addEventListener('click', (e) => {
    if (!e.target.closest('.del-tm-var')) return;
    e.target.closest('.var-row').remove();
    if (!$('tmCustomVarsContainer').querySelector('.var-row')) {
      $('tmCustomVarsContainer').innerHTML = '<p class="hint">No extra fields for this person.</p>';
    }
    scheduleTeammateSave();
  });
  elements.teammatesList.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.chip')) {
      copyToClipboard(e.target.closest('.chip').dataset.copy, e.target.closest('.chip').textContent);
      return;
    }
    if (e.target.closest('.edit-tm')) {
      const tm = personById(id);
      if (tm) openTeammateModal(tm);
      return;
    }
    if (e.target.closest('.delete-tm')) {
      const tm = personById(id);
      if (!tm || !confirm('Remove ' + (tm.name || 'this teammate') + '?')) return;
      appState.teammates = appState.teammates.filter((t) => t.id !== id);
      appState.team.slots = appState.team.slots.map((slotId) => slotId === id ? null : slotId);
      await commitTeam();
      updateBadgeCounts();
      showToast('Teammate removed');
    }
  });
}

function renderSnippets() {
  if (!appState.snippets.length) {
    elements.snippetsList.innerHTML = '<div class="empty"><strong>No answers yet</strong>Save the paragraphs you paste into every application.</div>';
    return;
  }
  elements.snippetsList.innerHTML = appState.snippets.map((s) => `
    <article class="card snippet-card" data-id="${escapeHTML(s.id)}">
      <div class="card-top">
        <div>
          <div class="cat">${escapeHTML(s.category || 'Custom')}</div>
          <div class="card-title">${escapeHTML(s.title)}</div>
        </div>
        <div>
          <button class="icon-btn edit-snip" type="button">Edit</button>
          <button class="icon-btn danger delete-snip" type="button">Del</button>
        </div>
      </div>
      <div class="snippet-body">${escapeHTML(s.content)}</div>
    </article>
  `).join('');
}

function openSnippetModal(snip) {
  elements.snippetForm.reset();
  $('snippetId').value = snip ? snip.id : '';
  $('snipTitle').value = snip ? snip.title : '';
  $('snipCategory').value = snip ? (snip.category || 'Custom') : 'Bio';
  $('snipContent').value = snip ? snip.content : '';
  elements.snippetModalTitle.textContent = snip ? 'Edit answer' : 'New answer';
  elements.snippetModal.classList.remove('hidden');
  $('snipTitle').focus();
}

function initSnippets() {
  renderSnippets();
  elements.addSnippetBtn.addEventListener('click', () => openSnippetModal(null));
  elements.closeSnippetModal.addEventListener('click', () => elements.snippetModal.classList.add('hidden'));
  elements.cancelSnippetBtn.addEventListener('click', () => elements.snippetModal.classList.add('hidden'));
  elements.snippetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(elements.snippetForm);
    const snippet = {
      id: data.get('id') || ('snip_' + Date.now()),
      title: String(data.get('title') || '').trim(),
      category: data.get('category'),
      content: String(data.get('content') || '').trim()
    };
    if (!snippet.title || !snippet.content) return;
    const index = appState.snippets.findIndex((s) => s.id === snippet.id);
    if (index >= 0) appState.snippets[index] = snippet;
    else appState.snippets.push(snippet);
    await Storage.set({ snippets: appState.snippets });
    renderSnippets();
    elements.snippetModal.classList.add('hidden');
    showToast('Answer saved');
  });
  elements.snippetsList.addEventListener('click', async (e) => {
    const card = e.target.closest('.snippet-card');
    if (!card) return;
    const snip = appState.snippets.find((s) => s.id === card.dataset.id);
    if (!snip) return;
    if (e.target.closest('.delete-snip')) {
      e.stopPropagation();
      if (!confirm('Delete this answer?')) return;
      appState.snippets = appState.snippets.filter((s) => s.id !== snip.id);
      await Storage.set({ snippets: appState.snippets });
      renderSnippets();
      return;
    }
    if (e.target.closest('.edit-snip')) {
      openSnippetModal(snip);
      return;
    }
    copyToClipboard(snip.content, snip.title);
  });
}

function renderTracker(filter) {
  const mode = filter || 'ALL';
  const list = appState.tracker.filter((item) => mode === 'ALL' || item.status === mode);
  if (!list.length) {
    elements.trackerList.innerHTML = '<div class="empty"><strong>Nothing logged</strong>Use Log this event while you are on the registration page.</div>';
    return;
  }
  elements.trackerList.innerHTML = list.map((item) => `
    <article class="card" data-id="${escapeHTML(item.id)}">
      <div class="card-top">
        <div>
          <span class="status status-${escapeHTML(String(item.status || 'applied').toLowerCase())}">${escapeHTML(item.status || 'Applied')}</span>
          <strong>${escapeHTML(item.eventName)}</strong>
        </div>
        <div>
          <button class="icon-btn edit-app" type="button">Edit</button>
          <button class="icon-btn danger delete-app" type="button">Del</button>
        </div>
      </div>
      <div class="note">
        ${item.appliedDate ? `<div>${escapeHTML(item.appliedDate)}</div>` : ''}
        ${item.squad ? `<div>${escapeHTML(item.squad)}</div>` : ''}
        ${item.eventUrl ? `<div><a href="${escapeHTML(item.eventUrl)}" target="_blank" rel="noreferrer">${escapeHTML(item.eventUrl)}</a></div>` : ''}
        ${item.notes ? `<div>${escapeHTML(item.notes)}</div>` : ''}
      </div>
    </article>
  `).join('');
}

function openTrackerEditor(item) {
  elements.trackerForm.reset();
  $('appId').value = item ? item.id : '';
  $('appEventName').value = item ? (item.eventName || '') : '';
  $('appEventUrl').value = item ? (item.eventUrl || '') : '';
  $('appDate').value = item ? (item.appliedDate || '') : new Date().toISOString().slice(0, 10);
  $('appStatus').value = item ? (item.status || 'Applied') : 'Applied';
  $('appSquad').value = item ? (item.squad || '') : lineupNames();
  $('appNotes').value = item ? (item.notes || '') : '';
  elements.trackerModalTitle.textContent = item ? 'Edit event' : 'Log event';
  elements.trackerModal.classList.remove('hidden');
}

function lineupNames() {
  const names = [];
  if (appState.profile.fullName) names.push(appState.profile.fullName);
  appState.team.slots.forEach((id) => {
    const person = personById(id);
    if (person && person.name) names.push(person.name);
  });
  return names.join(', ') || 'Solo';
}

function initTracker() {
  renderTracker('ALL');
  elements.statusFilter.addEventListener('change', () => renderTracker(elements.statusFilter.value));
  elements.addAppBtn.addEventListener('click', () => openTrackerEditor(null));
  elements.closeTrackerModal.addEventListener('click', () => elements.trackerModal.classList.add('hidden'));
  elements.cancelTrackerBtn.addEventListener('click', () => elements.trackerModal.classList.add('hidden'));
  elements.trackerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(elements.trackerForm);
    const entry = {
      id: data.get('id') || ('app_' + Date.now()),
      eventName: String(data.get('eventName') || '').trim(),
      eventUrl: String(data.get('eventUrl') || '').trim(),
      appliedDate: data.get('appliedDate'),
      status: data.get('status'),
      squad: String(data.get('squad') || '').trim(),
      notes: String(data.get('notes') || '').trim()
    };
    if (!entry.eventName) return;
    const index = appState.tracker.findIndex((a) => a.id === entry.id);
    if (index >= 0) appState.tracker[index] = entry;
    else appState.tracker.unshift(entry);
    await Storage.set({ tracker: appState.tracker });
    updateBadgeCounts();
    renderTracker(elements.statusFilter.value);
    elements.trackerModal.classList.add('hidden');
    showToast('Event logged');
  });
  elements.trackerList.addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const item = appState.tracker.find((a) => a.id === card.dataset.id);
    if (!item) return;
    if (e.target.closest('.edit-app')) { openTrackerEditor(item); return; }
    if (e.target.closest('.delete-app')) {
      if (!confirm('Delete this log?')) return;
      appState.tracker = appState.tracker.filter((a) => a.id !== item.id);
      await Storage.set({ tracker: appState.tracker });
      updateBadgeCounts();
      renderTracker(elements.statusFilter.value);
    }
  });
}

async function openTrackerModalForCurrentTab() {
  let title = 'Hackathon';
  let url = '';
  if (ext && ext.tabs && ext.tabs.query) {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      url = tabs[0].url || '';
      title = String(tabs[0].title || 'Hackathon').split(' - ')[0].split(' | ')[0].trim();
    }
  }
  switchTab('tracker');
  openTrackerEditor(null);
  $('appEventName').value = title;
  $('appEventUrl').value = url;
  $('appSquad').value = lineupNames();
  $('appDate').value = new Date().toISOString().slice(0, 10);
  $('appStatus').value = 'Applied';
}

async function triggerPageAutofill() {
  if (!ext || !ext.tabs) { showToast('Load the unpacked extension to fill live pages'); return; }
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) { showToast('No active tab'); return; }
    elements.pageDetectBadge.textContent = 'Filling';
    elements.pageDetectBadge.className = 'pill busy';
    const response = await sendTab(tab.id, {
      action: 'AUTOFILL_PAGE',
      payload: {
        profile: appState.profile,
        teammates: appState.teammates,
        team: appState.team,
        snippets: appState.snippets
      }
    });
    const count = response && response.filledCount ? response.filledCount : 0;
    if (count > 0) {
      const who = (response.names || []).filter(Boolean).join(', ');
      showToast('Filled ' + count + (who ? ' · ' + who : ''));
      elements.pageDetectBadge.textContent = 'Filled ' + count;
      elements.pageDetectBadge.className = 'pill live';
    } else {
      showToast('No matching fields on this page');
      elements.pageDetectBadge.textContent = 'No matches';
      elements.pageDetectBadge.className = 'pill';
    }
  } catch (err) {
    showToast('Open a normal web form first');
    elements.pageDetectBadge.textContent = 'No form';
    elements.pageDetectBadge.className = 'pill';
  }
}

async function checkCurrentPageForms() {
  if (!ext || !ext.tabs || !ext.tabs.query) return;
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || !tab.url || /^(chrome|edge|about|moz-extension|chrome-extension):/.test(tab.url)) {
      elements.pageDetectBadge.textContent = 'Ready';
      return;
    }
    const response = await sendTab(tab.id, { action: 'CHECK_FORMS' });
    if (response && response.hasForm) {
      elements.pageDetectBadge.textContent = response.inputCount + ' fields';
      elements.pageDetectBadge.className = 'pill live';
    } else {
      elements.pageDetectBadge.textContent = 'No form here';
    }
  } catch (err) {
    elements.pageDetectBadge.textContent = 'Ready';
  }
}

function applyImportedState() {
  fillProfileForm();
  renderSquad();
  renderSnippets();
  renderTracker(elements.statusFilter.value);
  updateBadgeCounts();
}

function initSettings() {
  elements.exportDataBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hackfill-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  });
  elements.importDataInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        appState.profile = imported.profile || {};
        appState.teammates = imported.teammates || [];
        appState.snippets = imported.snippets || [];
        appState.tracker = imported.tracker || [];
        appState.team = normalizeTeam(imported.team, appState.teammates);
        syncSquadPos();
        await Storage.set({
          profile: appState.profile,
          teammates: appState.teammates,
          snippets: appState.snippets,
          tracker: appState.tracker,
          team: appState.team
        });
        applyImportedState();
        showToast('Backup imported');
      } catch (err) {
        showToast('That file is not a HackFill backup');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  elements.loadDemoBtn.addEventListener('click', async () => {
    if (!confirm('Replace current data with the demo lineup?')) return;
    const demo = JSON.parse(JSON.stringify(DEMO_DATA));
    appState.profile = demo.profile;
    appState.teammates = demo.teammates;
    appState.snippets = demo.snippets;
    appState.tracker = demo.tracker;
    appState.team = demo.team;
    syncSquadPos();
    await Storage.set(appState);
    applyImportedState();
    showToast('Demo lineup loaded');
  });
  elements.clearDataBtn.addEventListener('click', async () => {
    if (!confirm('Clear your profile, squad, answers, and log?')) return;
    appState.profile = {};
    appState.teammates = [];
    appState.snippets = [];
    appState.tracker = [];
    appState.team = { size: 1, slots: [] };
    await Storage.set({
      profile: {},
      teammates: [],
      snippets: [],
      tracker: [],
      team: appState.team
    });
    applyImportedState();
    showToast('All data cleared');
  });
}

function closeTopModal() {
  if (elements.teammateModal && !elements.teammateModal.classList.contains('hidden')) {
    clearTimeout(teammateSaveTimer);
    persistTeammateFromForm();
    elements.teammateModal.classList.add('hidden');
    return;
  }
  [elements.snippetModal, elements.trackerModal].forEach((modal) => {
    if (modal && !modal.classList.contains('hidden')) modal.classList.add('hidden');
  });
}
