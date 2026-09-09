/**
 * HackFill - Background Service Worker (Manifest V3)
 * Cross-browser compatible: Chrome + Firefox
 */

// ── Browser API shim ──────────────────────────────────────────────────────────
// Firefox exposes `browser.*` (Promise-based); Chrome exposes `chrome.*` (callback-based).
// We normalise to a single `ext` object so the rest of this file works on both.
const ext = (typeof browser !== 'undefined') ? browser : chrome;

// Initial default data if storage is empty
const DEFAULT_DEMO_DATA = {
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
    college: "UC Berkeley",
    degree: "B.S. Computer Science",
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
      id: "tm_demo_1",
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
      id: "tm_demo_2",
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
    }
  ],
  snippets: [
    {
      id: "snip_demo_1",
      title: "Tell us about a project you are proud of",
      category: "Pitch",
      content: "Built an edge-AI audio transcription system using WebAssembly and ONNX Runtime in the browser. It processes 60 FPS streaming audio completely offline with zero latency, winning 1st place in the accessibility track."
    },
    {
      id: "snip_demo_2",
      title: "Why do you want to participate in this hackathon?",
      category: "Motivation",
      content: "I thrive in fast-paced 36-hour hackathons where interdisciplinary builders converge. My team wants to push the boundaries of browser-based agent workflows and ship a functional product that solves real pain points."
    }
  ],
  tracker: [
    {
      id: "app_demo_1",
      eventName: "TreeHacks 2026",
      eventUrl: "https://treehacks.com",
      appliedDate: "2026-01-15",
      status: "Accepted",
      squad: "Sophia Chen, Marcus Vance",
      notes: "Selected for AI track! Team code #TH26-88"
    }
  ]
};

// Extension installed or updated
ext.runtime.onInstalled.addListener(async (details) => {
  // ONLY seed initial demo data if the extension was just freshly installed AND storage is completely empty
  // On extension reloads (details.reason === 'update'), storage is 100% untouched!
  if (details.reason === 'install') {
    const current = await ext.storage.local.get(['profile', 'hasInitialized']);
    if (!current.hasInitialized && (!current.profile || Object.keys(current.profile).length === 0)) {
      await ext.storage.local.set({
        ...DEFAULT_DEMO_DATA,
        hasInitialized: true
      });
    }
  }

  // Create Context Menus
  createContextMenus();
});

// Setup Context Menus
function createContextMenus() {
  ext.contextMenus.removeAll(() => {
    // Parent Menu
    ext.contextMenus.create({
      id: 'hackfill_root',
      title: '⚡ HackFill Quick Paste',
      contexts: ['editable', 'page']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_autofill_page',
      title: '⚡ Autofill Entire Page',
      contexts: ['editable', 'page']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_sep1',
      type: 'separator',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_secid',
      title: '🆔 Insert SEC ID / College ID',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_github',
      title: '🐙 Insert My GitHub',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_linkedin',
      title: '💼 Insert My LinkedIn',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_resume',
      title: '📄 Insert My Resume Link',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_portfolio',
      title: '🌐 Insert My Portfolio',
      contexts: ['editable']
    });

    ext.contextMenus.create({
      parentId: 'hackfill_root',
      id: 'hackfill_my_email',
      title: '✉️ Insert My Email',
      contexts: ['editable']
    });
  });
}

// Handle Context Menu clicks
ext.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  const data = await ext.storage.local.get(['profile', 'teammates']);
  const profile = data.profile || {};

  if (info.menuItemId === 'hackfill_autofill_page') {
    ext.tabs.sendMessage(tab.id, {
      action: 'AUTOFILL_PAGE',
      payload: { profile, teammates: data.teammates || [] }
    });
    return;
  }

  let textToInsert = '';
  switch (info.menuItemId) {
    case 'hackfill_my_secid':
      textToInsert = profile.secId || '';
      break;
    case 'hackfill_my_github':
      textToInsert = profile.github || '';
      break;
    case 'hackfill_my_linkedin':
      textToInsert = profile.linkedin || '';
      break;
    case 'hackfill_my_resume':
      textToInsert = profile.resume || '';
      break;
    case 'hackfill_my_portfolio':
      textToInsert = profile.portfolio || '';
      break;
    case 'hackfill_my_email':
      textToInsert = profile.email || '';
      break;
  }

  if (textToInsert) {
    ext.tabs.sendMessage(tab.id, {
      action: 'INSERT_SNIPPET',
      text: textToInsert
    });
  }
});

// Handle Keyboard Shortcuts (e.g. Alt+Shift+F)
ext.commands.onCommand.addListener(async (command) => {
  if (command === 'autofill_form') {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.id) {
      const data = await ext.storage.local.get(['profile', 'teammates']);
      ext.tabs.sendMessage(tab.id, {
        action: 'AUTOFILL_PAGE',
        payload: {
          profile: data.profile || {},
          teammates: data.teammates || []
        }
      });
    }
  }
});

// Handle requests from content scripts (e.g. open full dashboard / settings)
ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_SETTINGS') {
    ext.tabs.create({ url: ext.runtime.getURL('popup/popup.html') });
    sendResponse({ success: true });
    return true;
  }
});
