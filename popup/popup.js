/**
 * HackFill - Extension Popup Script
 * Cross-browser compatible: Chrome + Firefox
 */

// ── Browser API shim ───────────────────────────────────────────────────────────────────────────
// Firefox exposes `browser.*` (Promise-based); Chrome exposes `chrome.*` (callback-based).
// We normalise to a single `ext` object so the rest of this file works on both.
const ext = (typeof browser !== 'undefined') ? browser : chrome;

// Storage Abstraction (ext.storage.local or fallback to localStorage)
const Storage = {
  async get(keys) {
    if (typeof ext !== 'undefined' && ext.storage && ext.storage.local) {
      return ext.storage.local.get(keys);
    }
    const res = {};
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach(k => {
      const val = localStorage.getItem('hackfill_' + k);
      if (val) {
        try { res[k] = JSON.parse(val); } catch (e) { res[k] = val; }
      }
    });
    return res;
  },

  async set(data) {
    if (typeof ext !== 'undefined' && ext.storage && ext.storage.local) {
      return ext.storage.local.set(data);
    }
    Object.entries(data).forEach(([k, v]) => {
      localStorage.setItem('hackfill_' + k, JSON.stringify(v));
    });
  }
};

// Demo Data
const DEMO_DATA = {
  profile: {
    fullName: "Alex Rivera",
    email: "alex.rivera@cs.edu",
    phone: "+1 (415) 890-3412",
    location: "San Francisco, CA",
    github: "https://github.com/alexrivera-dev",
    linkedin: "https://linkedin.com/in/alex-rivera-tech",
    portfolio: "https://alexrivera.dev",
    resume: "https://drive.google.com/file/d/1demo-alex-rivera-resume/view",
    discord: "arivera#4092",
    devfolio: "https://devfolio.co/@alexrivera",
    college: "University of California, Berkeley",
    degree: "B.S. in Electrical Engineering & Computer Science",
    gradYear: "2026",
    secId: "21CS104",
    customVariables: [
      { id: "cv_demo_1", name: "SEC ID", value: "21CS104" },
      { id: "cv_demo_2", name: "HackerRank ID", value: "alex_hack26" },
      { id: "cv_demo_3", name: "Telegram", value: "@alexrivera_dev" }
    ],
    tshirt: "L",
    diet: "Vegetarian",
    emergency: "Maria Rivera (+1 415-555-0199)"
  },
  teammates: [
    {
      id: "tm_" + Date.now() + "_1",
      name: "Sophia Chen",
      email: "sophia.chen@mit.edu",
      phone: "+1 (617) 555-0144",
      college: "MIT",
      secId: "21CS205",
      github: "https://github.com/sophiachen-ai",
      linkedin: "https://linkedin.com/in/sophiachen-ai",
      resume: "https://drive.google.com/file/d/1demo-sophia-resume/view",
      discord: "sophia#1337",
      tshirt: "M",
      diet: "None",
      squadPos: 1
    },
    {
      id: "tm_" + Date.now() + "_2",
      name: "Marcus Vance",
      email: "marcus.vance@stanford.edu",
      phone: "+1 (650) 555-0182",
      college: "Stanford University",
      secId: "21CS208",
      github: "https://github.com/marcusvance",
      linkedin: "https://linkedin.com/in/marcus-vance",
      resume: "https://drive.google.com/file/d/1demo-marcus-resume/view",
      discord: "mvance#9811",
      tshirt: "XL",
      diet: "Halal",
      squadPos: 2
    },
    {
      id: "tm_" + Date.now() + "_3",
      name: "Ananya Patel",
      email: "ananya.patel@georgiatech.edu",
      phone: "+1 (404) 555-0163",
      college: "Georgia Tech",
      github: "https://github.com/ananyapatel",
      linkedin: "https://linkedin.com/in/ananya-patel",
      resume: "https://drive.google.com/file/d/1demo-ananya-resume/view",
      discord: "ananya_p#5512",
      tshirt: "S",
      diet: "Vegan",
      squadPos: 3
    }
  ],
  snippets: [
    {
      id: "snip_1",
      title: "Tell us about a project you are proud of",
      category: "Pitch",
      content: "Built an edge-AI audio transcription system using WebAssembly and ONNX Runtime in the browser. It processes 60 FPS streaming audio completely offline with zero latency, winning 1st place in the accessibility track."
    },
    {
      id: "snip_2",
      title: "Why do you want to participate in this hackathon?",
      category: "Motivation",
      content: "I thrive in fast-paced 36-hour hackathons where interdisciplinary builders converge. My team wants to push the boundaries of browser-based agent workflows, leverage modern APIs, and ship a functional product that solves real pain points."
    },
    {
      id: "snip_3",
      title: "Personal Bio (100 words)",
      category: "Bio",
      content: "Full-stack developer and junior at UC Berkeley passionate about human-computer interaction, distributed systems, and modern web tooling. Active open-source contributor and hackathon veteran with 6+ podium finishes."
    }
  ],
  tracker: [
    {
      id: "app_1",
      eventName: "TreeHacks 2026",
      eventUrl: "https://treehacks.com",
      appliedDate: "2026-01-15",
      status: "Accepted",
      squad: "Sophia Chen, Marcus Vance",
      notes: "Selected for AI & Healthcare track! Team code #TH26-88"
    },
    {
      id: "app_2",
      eventName: "HackMIT 2026",
      eventUrl: "https://hackmit.org",
      appliedDate: "2026-02-01",
      status: "Applied",
      squad: "Alex, Sophia, Marcus, Ananya",
      notes: "Confirmation email received. Decisions out in 2 weeks."
    }
  ]
};

// State
let appState = {
  profile: {},
  teammates: [],
  snippets: [],
  tracker: []
};

// DOM Elements
const elements = {
  // Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  teammateCount: document.getElementById('teammateCount'),
  trackerCount: document.getElementById('trackerCount'),
  
  // Header / Quick actions
  popoutBtn: document.getElementById('popoutBtn'),
  quickAutofillBtn: document.getElementById('quickAutofillBtn'),
  quickLogBtn: document.getElementById('quickLogBtn'),
  pageDetectBadge: document.getElementById('pageDetectBadge'),
  
  // Profile
  profileForm: document.getElementById('profileForm'),
  customVarsContainer: document.getElementById('customVarsContainer'),
  addCustomVarBtn: document.getElementById('addCustomVarBtn'),
  autoSaveStatus: document.getElementById('autoSaveStatus'),
  autoSaveText: document.getElementById('autoSaveText'),
  
  // Teammates
  teammatesList: document.getElementById('teammatesList'),
  teammateSearch: document.getElementById('teammateSearch'),
  addTeammateBtn: document.getElementById('addTeammateBtn'),
  teammateModal: document.getElementById('teammateModal'),
  teammateForm: document.getElementById('teammateForm'),
  closeTeammateModal: document.getElementById('closeTeammateModal'),
  cancelTeammateBtn: document.getElementById('cancelTeammateBtn'),
  teammateModalTitle: document.getElementById('teammateModalTitle'),
  
  // Snippets
  snippetsList: document.getElementById('snippetsList'),
  addSnippetBtn: document.getElementById('addSnippetBtn'),
  snippetModal: document.getElementById('snippetModal'),
  snippetForm: document.getElementById('snippetForm'),
  closeSnippetModal: document.getElementById('closeSnippetModal'),
  cancelSnippetBtn: document.getElementById('cancelSnippetBtn'),
  snippetModalTitle: document.getElementById('snippetModalTitle'),
  
  // Tracker
  trackerList: document.getElementById('trackerList'),
  statusFilter: document.getElementById('statusFilter'),
  addAppBtn: document.getElementById('addAppBtn'),
  trackerModal: document.getElementById('trackerModal'),
  trackerForm: document.getElementById('trackerForm'),
  closeTrackerModal: document.getElementById('closeTrackerModal'),
  cancelTrackerBtn: document.getElementById('cancelTrackerBtn'),
  trackerModalTitle: document.getElementById('trackerModalTitle'),
  
  // Settings
  exportDataBtn: document.getElementById('exportDataBtn'),
  importDataInput: document.getElementById('importDataInput'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  
  // Toast
  toast: document.getElementById('toast')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initNavigation();
  initProfile();
  initTeammates();
  initSnippets();
  initTracker();
  initSettings();
  checkCurrentPageForms();
});

// Load state from Chrome Storage
async function loadState() {
  const data = await Storage.get(['profile', 'teammates', 'snippets', 'tracker']);
  appState.profile = data.profile || {};
  appState.teammates = data.teammates || [];
  appState.snippets = data.snippets || [];
  appState.tracker = data.tracker || [];

  updateBadgeCounts();
}

function updateBadgeCounts() {
  elements.teammateCount.textContent = appState.teammates.length;
  elements.trackerCount.textContent = appState.tracker.length;
}

// Toast notification
function showToast(message, icon = '✅') {
  elements.toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  elements.toast.classList.remove('hidden');
  clearTimeout(elements.toast._timer);
  elements.toast._timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2200);
}

// Clipboard copy helper
async function copyToClipboard(text, label = 'Copied') {
  if (!text) {
    showToast('Field is empty', '⚠️');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, '📋');
  } catch (err) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`${label} copied!`, '📋');
  }
}

// Navigation Tabs
function initNavigation() {
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      elements.navTabs.forEach(t => t.classList.remove('active'));
      elements.tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });

  // Header quick autofill
  elements.quickAutofillBtn.addEventListener('click', triggerPageAutofill);

  // Quick log event from current tab
  elements.quickLogBtn.addEventListener('click', async () => {
    openTrackerModalForCurrentTab();
  });

  // Pop out into persistent window
  if (elements.popoutBtn) {
    if (window.location.search.includes('standalone=true')) {
      elements.popoutBtn.style.display = 'none';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
    } else {
      elements.popoutBtn.addEventListener('click', () => {
        if (typeof ext !== 'undefined' && ext.windows && ext.windows.create) {
          ext.windows.create({
            url: ext.runtime.getURL('popup/popup.html?standalone=true'),
            type: 'popup',
            width: 500,
            height: 640,
            top: 100,
            left: Math.max(0, screen.availWidth - 520)
          });
          window.close();
        } else {
          window.open('popup.html?standalone=true', 'HackFillDashboard', 'width=500,height=640');
        }
      });
    }
  }
}

// Profile Tab
let autoSaveTimer = null;

function triggerAutoSave() {
  if (elements.autoSaveStatus) {
    elements.autoSaveStatus.className = 'autosave-status saving';
    elements.autoSaveText.textContent = 'Saving...';
  }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    await saveProfileImmediate(false);
  }, 250);
}

async function saveProfileImmediate(showNotification = true) {
  clearTimeout(autoSaveTimer);
  const formData = new FormData(elements.profileForm);
  const profile = { ...appState.profile };
  for (let [key, val] of formData.entries()) {
    if (key !== 'customVarName' && key !== 'customVarValue') {
      profile[key] = val.trim();
    }
  }

  // Collect custom variables ONLY from the Profile's customVarsContainer
  const customVars = [];
  const container = elements.customVarsContainer;
  if (container) {
    container.querySelectorAll('.custom-var-row').forEach(row => {
      const nameInput = row.querySelector('.custom-var-name');
      const valInput = row.querySelector('.custom-var-val');
      if (nameInput && nameInput.value.trim()) {
        customVars.push({
          id: row.dataset.id || ('cv_' + Date.now() + Math.random().toString(36).substring(2, 6)),
          name: nameInput.value.trim(),
          value: valInput ? valInput.value.trim() : ''
        });
      }
    });
  }
  profile.customVariables = customVars;
  appState.profile = profile;

  await Storage.set({ profile });

  if (elements.autoSaveStatus) {
    elements.autoSaveStatus.className = 'autosave-status saved';
    elements.autoSaveText.textContent = 'All changes saved';
  }
  if (showNotification) {
    showToast('Profile saved successfully!');
  }
}

function renderCustomVariables() {
  const container = elements.customVarsContainer;
  if (!container) return;
  const list = appState.profile.customVariables || [];

  if (list.length === 0) {
    container.innerHTML = `
      <div style="font-size:11px; color:#64748b; font-style:italic; padding:4px 0;">
        No custom variables yet. Click "+ Add Variable" to add SEC ID, HackerRank, etc.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(cv => `
    <div class="custom-var-row" data-id="${escapeHTML(cv.id)}">
      <input type="text" class="custom-var-name" value="${escapeHTML(cv.name)}" placeholder="Field Name (e.g. SEC ID)">
      <span class="custom-var-colon">:</span>
      <input type="text" class="custom-var-val" value="${escapeHTML(cv.value)}" placeholder="Value">
      <button type="button" class="btn-icon btn-copy-var" title="Copy value">📋</button>
      <button type="button" class="btn-icon btn-icon-danger btn-del-var" title="Delete">🗑️</button>
    </div>
  `).join('');

  // Attach event listeners
  container.querySelectorAll('.custom-var-name, .custom-var-val').forEach(input => {
    input.addEventListener('input', triggerAutoSave);
  });

  container.querySelectorAll('.btn-copy-var').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.custom-var-row');
      const valInput = row.querySelector('.custom-var-val');
      const nameInput = row.querySelector('.custom-var-name');
      if (valInput && valInput.value) {
        copyToClipboard(valInput.value, nameInput.value || 'Variable');
      }
    });
  });

  container.querySelectorAll('.btn-del-var').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      clearTimeout(autoSaveTimer);
      const row = btn.closest('.custom-var-row');
      const rowId = row.dataset.id;
      row.remove();
      // Directly filter out the deleted ID from appState
      if (appState.profile && appState.profile.customVariables) {
        appState.profile.customVariables = appState.profile.customVariables.filter(cv => cv.id !== rowId);
      }
      await saveProfileImmediate(false);
      renderCustomVariables();
      showToast('Variable removed');
    });
  });
}

function initProfile() {
  // Populate form
  Object.keys(appState.profile).forEach(key => {
    const input = elements.profileForm.elements[key];
    if (input) {
      input.value = appState.profile[key] || '';
    }
  });

  // Render custom variables
  renderCustomVariables();

  // Add custom variable button
  if (elements.addCustomVarBtn) {
    elements.addCustomVarBtn.addEventListener('click', () => {
      if (!appState.profile.customVariables) appState.profile.customVariables = [];
      appState.profile.customVariables.push({
        id: 'cv_' + Date.now(),
        name: '',
        value: ''
      });
      renderCustomVariables();
      // Focus on the newly added name input
      const rows = elements.customVarsContainer.querySelectorAll('.custom-var-row');
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const nameInput = lastRow.querySelector('.custom-var-name');
        if (nameInput) nameInput.focus();
      }
    });
  }

  // Real-time Auto-Save: on any input or change event
  elements.profileForm.addEventListener('input', triggerAutoSave);
  elements.profileForm.addEventListener('change', triggerAutoSave);

  // Guarantee auto-save on popup close / unload
  window.addEventListener('beforeunload', () => saveProfileImmediate(false));
  window.addEventListener('pagehide', () => saveProfileImmediate(false));

  // Explicit form submit
  elements.profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProfileImmediate(true);
  });

  // Individual field copy buttons
  document.querySelectorAll('.btn-copy-field').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input && input.value) {
        copyToClipboard(input.value, targetId.toUpperCase());
      } else {
        showToast(`Please enter your ${targetId} first`, '⚠️');
      }
    });
  });
}

// Teammates Tab

/**
 * Merges profile custom variable NAMES into a teammate's existing custom vars.
 * - Variables already on the teammate are kept as-is (value preserved).
 * - Variables defined in profile but missing from teammate are added with empty value.
 * - This means: define once in your profile, all teammates inherit the field names.
 */
function syncProfileCustomVarsToTeammate(existingTmVars) {
  const profileVars = appState.profile.customVariables || [];
  const merged = [...(existingTmVars || [])];

  profileVars.forEach(pv => {
    if (!pv.name || !pv.name.trim()) return;
    const alreadyExists = merged.some(
      tv => tv.name.trim().toLowerCase() === pv.name.trim().toLowerCase()
    );
    if (!alreadyExists) {
      merged.push({
        id: 'cv_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        name: pv.name.trim(),
        value: '' // teammate fills their own value
      });
    }
  });

  return merged;
}

// Render custom variable rows inside the teammate modal
function renderTmCustomVars(list) {
  const container = document.getElementById('tmCustomVarsContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `<div style="font-size:10px;color:#64748b;font-style:italic;">No custom variables. Click "+ Add" to add Reg No, HackerRank ID, etc.</div>`;
    return;
  }

  container.innerHTML = list.map(cv => `
    <div class="custom-var-row" data-id="${escapeHTML(cv.id)}">
      <input type="text" class="custom-var-name" value="${escapeHTML(cv.name)}" placeholder="Field Name (e.g. Reg No)">
      <span class="custom-var-colon">:</span>
      <input type="text" class="custom-var-val" value="${escapeHTML(cv.value)}" placeholder="Value">
      <button type="button" class="btn-icon btn-icon-danger btn-del-tm-var" title="Delete">🗑️</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-del-tm-var').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.custom-var-row').remove();
      if (container.querySelectorAll('.custom-var-row').length === 0) {
        container.innerHTML = `<div style="font-size:10px;color:#64748b;font-style:italic;">No custom variables. Click "+ Add" to add Reg No, HackerRank ID, etc.</div>`;
      }
    });
  });
}

function initTeammates() {
  renderTeammates();

  elements.teammateSearch.addEventListener('input', () => {
    renderTeammates(elements.teammateSearch.value);
  });

  elements.addTeammateBtn.addEventListener('click', () => {
    elements.teammateForm.reset();
    document.getElementById('teammateId').value = '';
    elements.teammateModalTitle.textContent = 'Add Teammate';
    // Sync profile custom var names so they appear ready to fill for the new teammate
    renderTmCustomVars(syncProfileCustomVarsToTeammate([]));
    elements.teammateModal.classList.remove('hidden');
  });

  elements.closeTeammateModal.addEventListener('click', () => {
    elements.teammateModal.classList.add('hidden');
  });

  elements.cancelTeammateBtn.addEventListener('click', () => {
    elements.teammateModal.classList.add('hidden');
  });

  // Sync profile custom vars manually inside teammate modal
  const syncBtn = document.getElementById('syncTmCustomVarsBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      const container = document.getElementById('tmCustomVarsContainer');
      const currentVars = [];
      container.querySelectorAll('.custom-var-row').forEach(row => {
        const nameInput = row.querySelector('.custom-var-name');
        const valInput  = row.querySelector('.custom-var-val');
        if (nameInput && nameInput.value.trim()) {
          currentVars.push({
            id: row.dataset.id || ('cv_' + Date.now()),
            name: nameInput.value.trim(),
            value: valInput ? valInput.value.trim() : ''
          });
        }
      });
      renderTmCustomVars(syncProfileCustomVarsToTeammate(currentVars));
      showToast('Profile variable names synced!');
    });
  }

  // Wire the + Add button for teammate custom vars
  document.getElementById('addTmCustomVarBtn').addEventListener('click', () => {
    const container = document.getElementById('tmCustomVarsContainer');
    // Remove the placeholder text if present
    const placeholder = container.querySelector('div[style]');
    if (placeholder) placeholder.remove();

    const row = document.createElement('div');
    row.className = 'custom-var-row';
    row.dataset.id = 'cv_' + Date.now();
    row.innerHTML = `
      <input type="text" class="custom-var-name" placeholder="Field Name (e.g. Reg No)">
      <span class="custom-var-colon">:</span>
      <input type="text" class="custom-var-val" placeholder="Value">
      <button type="button" class="btn-icon btn-icon-danger btn-del-tm-var" title="Delete">🗑️</button>
    `;
    row.querySelector('.btn-del-tm-var').addEventListener('click', () => {
      row.remove();
      if (container.querySelectorAll('.custom-var-row').length === 0) {
        container.innerHTML = `<div style="font-size:10px;color:#64748b;font-style:italic;">No custom variables. Click "+ Add" to add Reg No, HackerRank ID, etc.</div>`;
      }
    });
    container.appendChild(row);
    row.querySelector('.custom-var-name').focus();
  });

  elements.teammateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(elements.teammateForm);
    const id = formData.get('id') || ('tm_' + Date.now());
    const teammate = { id };
    for (let [key, val] of formData.entries()) {
      if (key !== 'id') teammate[key] = val.trim();
    }

    // Collect custom variables from the modal
    const tmCustomVars = [];
    document.querySelectorAll('#tmCustomVarsContainer .custom-var-row').forEach(row => {
      const nameInput = row.querySelector('.custom-var-name');
      const valInput  = row.querySelector('.custom-var-val');
      if (nameInput && valInput && nameInput.value.trim()) {
        tmCustomVars.push({
          id: row.dataset.id || ('cv_' + Date.now() + Math.random().toString(36).substring(2, 6)),
          name: nameInput.value.trim(),
          value: valInput.value.trim()
        });
      }
    });
    teammate.customVariables = tmCustomVars;

    const existingIndex = appState.teammates.findIndex(t => t.id === id);
    if (existingIndex >= 0) {
      teammate.squadPos = appState.teammates[existingIndex].squadPos;
      appState.teammates[existingIndex] = teammate;
    } else {
      teammate.squadPos = null;
      appState.teammates.push(teammate);
    }

    await Storage.set({ teammates: appState.teammates });
    updateBadgeCounts();
    renderTeammates();
    elements.teammateModal.classList.add('hidden');
    showToast('Teammate saved!');
  });
}

function renderTeammates(filter = '') {
  const query = filter.toLowerCase().trim();
  const list = appState.teammates.filter(t => {
    if (!query) return true;
    return (
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.email && t.email.toLowerCase().includes(query)) ||
      (t.college && t.college.toLowerCase().includes(query)) ||
      (t.github && t.github.toLowerCase().includes(query))
    );
  });

  if (list.length === 0) {
    elements.teammatesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>No teammates added yet.</p>
        <p style="font-size:11px; margin-top:4px;">Add your hackathon buddies to store their GitHub, LinkedIn, and resume links for instant filling!</p>
      </div>
    `;
    return;
  }

  elements.teammatesList.innerHTML = list.map(tm => {
    const initials = tm.name ? tm.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    const squadBadge = tm.squadPos ? `<span class="badge" style="background:#3730a3;color:#c7d2fe;">Squad #${tm.squadPos}</span>` : '';

    // Custom variable chips for this teammate
    const customVarChips = (tm.customVariables && tm.customVariables.length > 0)
      ? tm.customVariables.filter(cv => cv.name && cv.value).map(cv =>
          `<button class="copy-chip" data-copy="${escapeHTML(cv.value)}" title="${escapeHTML(cv.name)}: ${escapeHTML(cv.value)}">🔖 ${escapeHTML(cv.name)}</button>`
        ).join('')
      : '';

    return `
      <div class="card teammate-card" data-id="${tm.id}">
        <div class="card-top">
          <div class="card-title-group">
            <div class="card-avatar">${initials}</div>
            <div>
              <div class="card-title">${escapeHTML(tm.name)} ${squadBadge}</div>
              <div class="card-meta">${escapeHTML(tm.college || tm.email || '')}</div>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn-icon btn-edit-tm" data-id="${tm.id}" title="Edit">✏️</button>
            <button class="btn-icon btn-delete-tm" data-id="${tm.id}" title="Delete">🗑️</button>
          </div>
        </div>

        <div class="card-chips">
          ${tm.secId ? `<button class="copy-chip" data-copy="${escapeHTML(tm.secId)}" title="College / SEC ID">🆔 ${escapeHTML(tm.secId)}</button>` : ''}
          ${tm.github ? `<button class="copy-chip" data-copy="${escapeHTML(tm.github)}" title="${escapeHTML(tm.github)}">🐙 GitHub</button>` : ''}
          ${tm.linkedin ? `<button class="copy-chip" data-copy="${escapeHTML(tm.linkedin)}" title="${escapeHTML(tm.linkedin)}">💼 LinkedIn</button>` : ''}
          ${tm.resume ? `<button class="copy-chip" data-copy="${escapeHTML(tm.resume)}" title="${escapeHTML(tm.resume)}">📄 Resume</button>` : ''}
          ${tm.email ? `<button class="copy-chip" data-copy="${escapeHTML(tm.email)}" title="${escapeHTML(tm.email)}">✉️ Email</button>` : ''}
          ${tm.phone ? `<button class="copy-chip" data-copy="${escapeHTML(tm.phone)}" title="${escapeHTML(tm.phone)}">📱 Phone</button>` : ''}
          ${tm.discord ? `<button class="copy-chip" data-copy="${escapeHTML(tm.discord)}" title="${escapeHTML(tm.discord)}">💬 Discord</button>` : ''}
          ${customVarChips}
        </div>

        <div class="squad-selector">
          <span>Assign to Form:</span>
          <button class="squad-btn ${!tm.squadPos ? 'active' : ''}" data-squad="0" data-id="${tm.id}">None</button>
          <button class="squad-btn ${tm.squadPos === 1 ? 'active' : ''}" data-squad="1" data-id="${tm.id}">Teammate 1</button>
          <button class="squad-btn ${tm.squadPos === 2 ? 'active' : ''}" data-squad="2" data-id="${tm.id}">Teammate 2</button>
          <button class="squad-btn ${tm.squadPos === 3 ? 'active' : ''}" data-squad="3" data-id="${tm.id}">Teammate 3</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners to chips & buttons
  elements.teammatesList.querySelectorAll('.copy-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      copyToClipboard(chip.dataset.copy, chip.textContent.trim());
    });
  });

  elements.teammatesList.querySelectorAll('.btn-edit-tm').forEach(btn => {
    btn.addEventListener('click', () => {
      const tm = appState.teammates.find(t => t.id === btn.dataset.id);
      if (tm) openEditTeammateModal(tm);
    });
  });

  elements.teammatesList.querySelectorAll('.btn-delete-tm').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this teammate?')) {
        appState.teammates = appState.teammates.filter(t => t.id !== btn.dataset.id);
        await Storage.set({ teammates: appState.teammates });
        updateBadgeCounts();
        renderTeammates(elements.teammateSearch.value);
        showToast('Teammate removed');
      }
    });
  });

  elements.teammatesList.querySelectorAll('.squad-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const squadNum = parseInt(btn.dataset.squad, 10);

      // If assigning a position (1, 2, 3), unassign anyone else who had that pos
      if (squadNum > 0) {
        appState.teammates.forEach(t => {
          if (t.squadPos === squadNum) t.squadPos = null;
        });
      }

      const target = appState.teammates.find(t => t.id === id);
      if (target) {
        target.squadPos = squadNum === 0 ? null : squadNum;
      }

      await Storage.set({ teammates: appState.teammates });
      renderTeammates(elements.teammateSearch.value);
      showToast(squadNum > 0 ? `Assigned as Teammate #${squadNum}` : 'Unassigned from squad');
    });
  });
}

function openEditTeammateModal(tm) {
  document.getElementById('teammateId').value = tm.id;
  document.getElementById('tmName').value = tm.name || '';
  document.getElementById('tmEmail').value = tm.email || '';
  document.getElementById('tmPhone').value = tm.phone || '';
  document.getElementById('tmCollege').value = tm.college || '';
  document.getElementById('tmSecId').value = tm.secId || '';
  document.getElementById('tmGithub').value = tm.github || '';
  document.getElementById('tmLinkedin').value = tm.linkedin || '';
  document.getElementById('tmResume').value = tm.resume || '';
  document.getElementById('tmDiscord').value = tm.discord || '';
  document.getElementById('tmTshirt').value = tm.tshirt || '';
  document.getElementById('tmDiet').value = tm.diet || 'None';

  // Load teammate's saved custom variables (respects their list and any deletions)
  // Only auto-merge from profile if tm.customVariables was completely undefined
  const varsToRender = Array.isArray(tm.customVariables)
    ? tm.customVariables
    : syncProfileCustomVarsToTeammate([]);
  renderTmCustomVars(varsToRender);

  elements.teammateModalTitle.textContent = 'Edit Teammate';
  elements.teammateModal.classList.remove('hidden');
}

// Snippets Tab
function initSnippets() {
  renderSnippets();

  elements.addSnippetBtn.addEventListener('click', () => {
    elements.snippetForm.reset();
    document.getElementById('snippetId').value = '';
    elements.snippetModalTitle.textContent = 'Add Snippet';
    elements.snippetModal.classList.remove('hidden');
  });

  elements.closeSnippetModal.addEventListener('click', () => {
    elements.snippetModal.classList.add('hidden');
  });

  elements.cancelSnippetBtn.addEventListener('click', () => {
    elements.snippetModal.classList.add('hidden');
  });

  elements.snippetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(elements.snippetForm);
    const id = formData.get('id') || ('snip_' + Date.now());
    const snippet = {
      id,
      title: formData.get('title').trim(),
      category: formData.get('category'),
      content: formData.get('content').trim()
    };

    const existingIndex = appState.snippets.findIndex(s => s.id === id);
    if (existingIndex >= 0) {
      appState.snippets[existingIndex] = snippet;
    } else {
      appState.snippets.push(snippet);
    }

    await Storage.set({ snippets: appState.snippets });
    renderSnippets();
    elements.snippetModal.classList.add('hidden');
    showToast('Snippet saved!');
  });
}

function renderSnippets() {
  if (appState.snippets.length === 0) {
    elements.snippetsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No answers saved yet.</p>
        <p style="font-size:11px; margin-top:4px;">Save your standard hackathon essays, project pitches, and bios for 1-click copying!</p>
      </div>
    `;
    return;
  }

  elements.snippetsList.innerHTML = appState.snippets.map(s => {
    return `
      <div class="card snippet-card" data-id="${s.id}">
        <div class="card-top">
          <div>
            <span class="badge" style="background:#242f45;color:#94a3b8;margin-right:6px;">${escapeHTML(s.category)}</span>
            <strong class="card-title">${escapeHTML(s.title)}</strong>
          </div>
          <div class="card-actions">
            <button class="btn-icon btn-copy-snip" data-id="${s.id}" title="Copy Answer">📋</button>
            <button class="btn-icon btn-delete-snip" data-id="${s.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="card-text">${escapeHTML(s.content)}</div>
      </div>
    `;
  }).join('');

  elements.snippetsList.querySelectorAll('.btn-copy-snip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const snip = appState.snippets.find(s => s.id === btn.dataset.id);
      if (snip) copyToClipboard(snip.content, snip.title);
    });
  });

  elements.snippetsList.querySelectorAll('.snippet-card').forEach(card => {
    card.addEventListener('click', () => {
      const snip = appState.snippets.find(s => s.id === card.dataset.id);
      if (snip) copyToClipboard(snip.content, snip.title);
    });
  });

  elements.snippetsList.querySelectorAll('.btn-delete-snip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this snippet?')) {
        appState.snippets = appState.snippets.filter(s => s.id !== btn.dataset.id);
        await Storage.set({ snippets: appState.snippets });
        renderSnippets();
        showToast('Snippet deleted');
      }
    });
  });
}

// Application Tracker Tab
function initTracker() {
  renderTracker();

  elements.statusFilter.addEventListener('change', () => {
    renderTracker(elements.statusFilter.value);
  });

  elements.addAppBtn.addEventListener('click', () => {
    elements.trackerForm.reset();
    document.getElementById('appId').value = '';
    document.getElementById('appDate').value = new Date().toISOString().split('T')[0];
    elements.trackerModalTitle.textContent = 'Log Hackathon Application';
    elements.trackerModal.classList.remove('hidden');
  });

  elements.closeTrackerModal.addEventListener('click', () => {
    elements.trackerModal.classList.add('hidden');
  });

  elements.cancelTrackerBtn.addEventListener('click', () => {
    elements.trackerModal.classList.add('hidden');
  });

  elements.trackerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(elements.trackerForm);
    const id = formData.get('id') || ('app_' + Date.now());
    const entry = {
      id,
      eventName: formData.get('eventName').trim(),
      eventUrl: formData.get('eventUrl').trim(),
      appliedDate: formData.get('appliedDate'),
      status: formData.get('status'),
      squad: formData.get('squad').trim(),
      notes: formData.get('notes').trim()
    };

    const existingIndex = appState.tracker.findIndex(a => a.id === id);
    if (existingIndex >= 0) {
      appState.tracker[existingIndex] = entry;
    } else {
      appState.tracker.unshift(entry);
    }

    await Storage.set({ tracker: appState.tracker });
    updateBadgeCounts();
    renderTracker(elements.statusFilter.value);
    elements.trackerModal.classList.add('hidden');
    showToast('Application logged!');
  });
}

function renderTracker(filter = 'ALL') {
  const list = appState.tracker.filter(item => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  if (list.length === 0) {
    elements.trackerList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <p>No applications logged yet.</p>
        <p style="font-size:11px; margin-top:4px;">Click "Log Current Event" on any hackathon page to keep a permanent record!</p>
      </div>
    `;
    return;
  }

  elements.trackerList.innerHTML = list.map(item => {
    const statusClass = `status-${item.status.toLowerCase()}`;
    return `
      <div class="card" data-id="${item.id}">
        <div class="card-top">
          <div>
            <span class="status-badge ${statusClass}">${escapeHTML(item.status)}</span>
            <strong class="card-title" style="margin-left:6px;">${escapeHTML(item.eventName)}</strong>
          </div>
          <div class="card-actions">
            <button class="btn-icon btn-edit-app" data-id="${item.id}" title="Edit">✏️</button>
            <button class="btn-icon btn-delete-app" data-id="${item.id}" title="Delete">🗑️</button>
          </div>
        </div>

        <div style="font-size:11px; color:#94a3b8; display:flex; flex-direction:column; gap:3px; margin-top:4px;">
          ${item.appliedDate ? `<div>📅 Applied: <strong>${escapeHTML(item.appliedDate)}</strong></div>` : ''}
          ${item.squad ? `<div>👥 Squad: <strong>${escapeHTML(item.squad)}</strong></div>` : ''}
          ${item.eventUrl ? `<div>🔗 <a href="${escapeHTML(item.eventUrl)}" target="_blank" style="color:#818cf8;text-decoration:none;">${escapeHTML(item.eventUrl)}</a></div>` : ''}
          ${item.notes ? `<div style="background:#151d2c;padding:6px 8px;border-radius:4px;margin-top:4px;color:#cbd5e1;">${escapeHTML(item.notes)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  elements.trackerList.querySelectorAll('.btn-edit-app').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appState.tracker.find(a => a.id === btn.dataset.id);
      if (item) {
        document.getElementById('appId').value = item.id;
        document.getElementById('appEventName').value = item.eventName || '';
        document.getElementById('appEventUrl').value = item.eventUrl || '';
        document.getElementById('appDate').value = item.appliedDate || '';
        document.getElementById('appStatus').value = item.status || 'Applied';
        document.getElementById('appSquad').value = item.squad || '';
        document.getElementById('appNotes').value = item.notes || '';

        elements.trackerModalTitle.textContent = 'Edit Application Entry';
        elements.trackerModal.classList.remove('hidden');
      }
    });
  });

  elements.trackerList.querySelectorAll('.btn-delete-app').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this application entry?')) {
        appState.tracker = appState.tracker.filter(a => a.id !== btn.dataset.id);
        await Storage.set({ tracker: appState.tracker });
        updateBadgeCounts();
        renderTracker(elements.statusFilter.value);
        showToast('Entry deleted');
      }
    });
  });
}

// Quick Log Modal for active tab
async function openTrackerModalForCurrentTab() {
  let title = 'Hackathon Application';
  let url = '';

  if (typeof ext !== 'undefined' && ext.tabs && ext.tabs.query) {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      url = tabs[0].url || '';
      title = (tabs[0].title || 'Hackathon').split(' - ')[0].split(' | ')[0].trim();
    }
  }

  // Active squad names
  const activeSquadNames = appState.teammates
    .filter(t => t.squadPos)
    .sort((a, b) => a.squadPos - b.squadPos)
    .map(t => t.name)
    .join(', ');

  elements.trackerForm.reset();
  document.getElementById('appId').value = '';
  document.getElementById('appEventName').value = title;
  document.getElementById('appEventUrl').value = url;
  document.getElementById('appDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('appStatus').value = 'Applied';
  document.getElementById('appSquad').value = activeSquadNames ? (appState.profile.fullName ? `${appState.profile.fullName}, ${activeSquadNames}` : activeSquadNames) : (appState.profile.fullName || 'Solo');

  // Switch to tracker tab
  document.querySelector('[data-tab="tracker"]').click();
  elements.trackerModalTitle.textContent = 'Log Hackathon Application';
  elements.trackerModal.classList.remove('hidden');
}

// Trigger Autofill in active page
async function triggerPageAutofill() {
  if (typeof ext !== 'undefined' && ext.tabs && ext.tabs.query) {
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || !tab.id) {
        showToast('No active tab found', '⚠️');
        return;
      }

      elements.pageDetectBadge.textContent = 'Autofilling...';
      elements.pageDetectBadge.className = 'badge badge-detecting';

      // Firefox browser.tabs.sendMessage returns a Promise; Chrome uses callbacks.
      // We wrap the callback style for Chrome and await the Promise for Firefox.
      const sendMsg = () => new Promise((resolve, reject) => {
        const isFirefox = typeof browser !== 'undefined';
        if (isFirefox) {
          ext.tabs.sendMessage(tab.id, {
            action: 'AUTOFILL_PAGE',
            payload: { profile: appState.profile, teammates: appState.teammates }
          }).then(resolve).catch(reject);
        } else {
          ext.tabs.sendMessage(tab.id, {
            action: 'AUTOFILL_PAGE',
            payload: { profile: appState.profile, teammates: appState.teammates }
          }, (response) => {
            if (ext.runtime.lastError) return reject(ext.runtime.lastError);
            resolve(response);
          });
        }
      });

      try {
        const response = await sendMsg();
        if (response && response.filledCount > 0) {
          showToast(`Filled ${response.filledCount} fields!`, '⚡');
          elements.pageDetectBadge.textContent = `⚡ Filled ${response.filledCount} fields`;
          elements.pageDetectBadge.className = 'badge badge-ready';
        } else {
          showToast('No matching form inputs found on this page', 'ℹ️');
          elements.pageDetectBadge.textContent = '0 matches';
          elements.pageDetectBadge.className = 'badge badge-detecting';
        }
      } catch {
        showToast('Could not autofill: Open a web form first', '⚠️');
        elements.pageDetectBadge.textContent = 'No form found';
        elements.pageDetectBadge.className = 'badge badge-detecting';
      }
    } catch (err) {
      showToast('Error communicating with tab', '❌');
    }
  } else {
    showToast('Autofill ready! (Load as unpacked extension to test on live forms)');
  }
}

// Check active tab for forms
async function checkCurrentPageForms() {
  if (typeof ext !== 'undefined' && ext.tabs && ext.tabs.query) {
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      // Skip internal browser pages
      if (!tab || !tab.id || !tab.url ||
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('about:') ||
          tab.url.startsWith('moz-extension://')) {
        elements.pageDetectBadge.textContent = 'Ready';
        return;
      }

      const isFirefox = typeof browser !== 'undefined';
      const sendCheck = () => new Promise((resolve, reject) => {
        if (isFirefox) {
          ext.tabs.sendMessage(tab.id, { action: 'CHECK_FORMS' }).then(resolve).catch(reject);
        } else {
          ext.tabs.sendMessage(tab.id, { action: 'CHECK_FORMS' }, (response) => {
            if (ext.runtime.lastError) return reject(ext.runtime.lastError);
            resolve(response);
          });
        }
      });

      try {
        const response = await sendCheck();
        if (response && response.hasForm) {
          elements.pageDetectBadge.textContent = `Form Ready (${response.inputCount} inputs)`;
          elements.pageDetectBadge.className = 'badge badge-ready';
        } else {
          elements.pageDetectBadge.textContent = 'No form detected';
        }
      } catch {
        elements.pageDetectBadge.textContent = 'Idle';
      }
    } catch (e) {}
  }
}

// Settings & Backup
function initSettings() {
  // Export
  elements.exportDataBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `hackfill_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchor.click();
    showToast('Data exported successfully!');
  });

  // Import
  elements.importDataInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported) {
          appState.profile = imported.profile || {};
          appState.teammates = imported.teammates || [];
          appState.snippets = imported.snippets || [];
          appState.tracker = imported.tracker || [];

          await Storage.set(appState);
          initProfile();
          renderTeammates();
          renderSnippets();
          renderTracker();
          updateBadgeCounts();
          showToast('Data imported successfully!');
        }
      } catch (err) {
        showToast('Invalid JSON file', '❌');
      }
    };
    reader.readAsText(file);
  });

  // Load Demo Data
  elements.loadDemoBtn.addEventListener('click', async () => {
    if (confirm('Load demo profile, teammates, and answers?')) {
      appState = JSON.parse(JSON.stringify(DEMO_DATA));
      await Storage.set(appState);
      initProfile();
      renderTeammates();
      renderSnippets();
      renderTracker();
      updateBadgeCounts();
      showToast('Demo data loaded! Try clicking Autofill', '✨');
    }
  });

  // Clear All
  elements.clearDataBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      appState = { profile: {}, teammates: [], snippets: [], tracker: [] };
      await Storage.set(appState);
      initProfile();
      renderTeammates();
      renderSnippets();
      renderTracker();
      updateBadgeCounts();
      showToast('All data cleared', '🗑️');
    }
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
