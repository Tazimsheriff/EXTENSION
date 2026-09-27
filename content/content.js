/**
 * HackFill content script.
 * You are roster[0]. Participant N and Teammate N are roster[N].
 * Member N and Operative N are roster[N - 1], so Operative 02 is the first teammate.
 */
(() => {
  if (window.__HACKFILL_INJECTED__) return;
  window.__HACKFILL_INJECTED__ = true;

  const ext = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  const SCRIPT_BASE = (() => {
    try {
      if (document.currentScript && document.currentScript.src) {
        return document.currentScript.src.replace(/[^/]+$/, '');
      }
    } catch (err) { /* extension injection has no currentScript */ }
    return '';
  })();

  if (location.protocol === 'chrome-extension:' || location.protocol === 'moz-extension:') return;

  const cached = { profile: {}, teammates: [], snippets: [], team: null };

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (!ext || !ext.storage || !ext.storage.local) { resolve({}); return; }
      const ret = ext.storage.local.get(keys, (res) => resolve(res || {}));
      if (ret && typeof ret.then === 'function') ret.then((res) => resolve(res || {}), () => resolve({}));
    });
  }

  function storageSet(data) {
    return new Promise((resolve) => {
      if (!ext || !ext.storage || !ext.storage.local) { resolve(); return; }
      const ret = ext.storage.local.set(data, () => resolve());
      if (ret && typeof ret.then === 'function') ret.then(() => resolve(), () => resolve());
    });
  }

  async function loadUserData() {
    const res = await storageGet(['profile', 'teammates', 'snippets', 'team']);
    cached.profile = res.profile || {};
    cached.teammates = res.teammates || [];
    cached.snippets = res.snippets || [];
    cached.team = res.team || null;
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function deriveTeam(teammates, team) {
    const list = teammates || [];
    const ids = new Set(list.map((t) => t.id));
    let slots = [];
    if (team && Array.isArray(team.slots)) {
      const size = Math.max(1, Math.min(6, Number(team.size) || team.slots.length + 1));
      for (let i = 0; i < size - 1; i++) {
        const id = team.slots[i];
        slots.push(id && ids.has(id) ? id : null);
      }
    } else {
      const sparse = [];
      list.forEach((t) => {
        const pos = Number(t.squadPos);
        if (pos >= 1 && pos <= 5) sparse[pos - 1] = t.id;
      });
      for (let i = 0; i < sparse.length; i++) slots.push(sparse[i] || null);
    }
    // Saved people with nobody placed in the lineup still fill Participant 1, Operative 02, and so on.
    if (!slots.some(Boolean) && list.length) {
      slots = list.slice(0, 5).map((t) => t.id);
    }
    return { size: Math.max(1, slots.length + 1), slots };
  }

  function asPerson(entity, isProfile) {
    if (!entity) return null;
    const name = isProfile ? (entity.fullName || '') : (entity.name || entity.fullName || '');
    return {
      fullName: name,
      name,
      email: entity.email || '',
      phone: entity.phone || '',
      location: entity.location || '',
      github: entity.github || '',
      linkedin: entity.linkedin || '',
      portfolio: entity.portfolio || '',
      resume: entity.resume || '',
      discord: entity.discord || '',
      devfolio: entity.devfolio || '',
      college: entity.college || '',
      degree: entity.degree || '',
      gradYear: entity.gradYear || '',
      secId: entity.secId || '',
      tshirt: entity.tshirt || '',
      diet: entity.diet || '',
      emergency: entity.emergency || '',
      customVariables: Array.isArray(entity.customVariables) ? entity.customVariables : []
    };
  }

  function buildRoster(profile, teammates, team) {
    const lineup = deriveTeam(teammates, team);
    const byId = new Map((teammates || []).map((t) => [t.id, t]));
    const people = [asPerson(profile, true)];
    lineup.slots.forEach((id) => {
      people.push(id && byId.get(id) ? asPerson(byId.get(id), false) : null);
    });
    return people;
  }

  function parseRole(raw) {
    const text = norm(raw);
    if (!text) return null;
    // "Participant name 1" / "Participant mail 1" is the first person under you, not you.
    let match = text.match(/\b(?:participants?|teammates?|team\s*mates?|partners?)\b(?:\s+[a-z]+){0,4}\s+0*([1-8])\b/);
    if (match) return { kind: 'friend', n: Number(match[1]) };
    // "Squad member 2" and "Operative 02" count the leader as 1.
    match = text.match(/\b(?:squad\s*)?(?:team\s*)?members?\b(?:\s+[a-z]+){0,4}\s+0*([1-8])\b/);
    if (match) return { kind: 'member', n: Number(match[1]) };
    match = text.match(/\boperatives?\s+0*([1-8])\b/);
    if (match) return { kind: 'member', n: Number(match[1]) };
    match = text.match(/\b(?:tm|teammate|partner|participant)\s*0*([1-8])\b/);
    if (match) return { kind: 'friend', n: Number(match[1]) };
    match = text.match(/\bmember\s*0*([1-8])\b/);
    if (match) return { kind: 'member', n: Number(match[1]) };

    const ordinals = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6 };
    match = text.match(/\b(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th)\s+(participant|teammate|partner|member|operative)s?\b/);
    if (match) {
      const n = ordinals[match[1]];
      return /participant|teammate|partner/.test(match[2]) ? { kind: 'friend', n } : { kind: 'member', n };
    }
    if (/\bteam\s*lead/.test(text) || /\bprimary\s*contact\b/.test(text) || /\bprimary\s*applicant\b/.test(text) || /\boperative\s+0*1\b/.test(text) || /\byour\s+(details|information|info|profile)\b/.test(text)) {
      return { kind: 'lead' };
    }
    return null;
  }

  function personForRole(role, roster) {
    if (!role || role.kind === 'lead') return roster[0] || null;
    if (role.kind === 'friend') return role.n >= 1 && role.n < roster.length ? roster[role.n] : null;
    if (role.kind === 'member') {
      const index = role.n - 1;
      return index >= 0 && index < roster.length ? roster[index] : null;
    }
    return roster[0] || null;
  }

  function visible(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.closest && el.closest('#hackfill-host')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'file', 'password', 'image', 'checkbox', 'radio'].includes(type)) return false;
    return true;
  }

  function getFormElements() {
    return Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"]')).filter((el) => {
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        if (el === document.body || el === document.documentElement) return false;
        if (el.closest('#hackfill-host')) return false;
        if (el.querySelector && el.querySelector('input, textarea, select')) return false;
        const role = el.getAttribute('role');
        if (role !== 'textbox' && !el.closest('form')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }
      return visible(el);
    });
  }

  function cleanLabel(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, script, style').forEach((n) => n.remove());
    return clone.innerText || clone.textContent || '';
  }

  function fieldText(el) {
    const parts = [];
    ['id', 'name', 'placeholder'].forEach((attr) => {
      if (el.getAttribute && el.getAttribute(attr)) parts.push(el.getAttribute(attr));
    });
    const labelledBy = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node = document.getElementById(id);
        if (node) parts.push(cleanLabel(node));
      });
    }
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) parts.push(aria);
    const auto = el.getAttribute && el.getAttribute('autocomplete');
    if (auto) parts.push(auto);
    if (el.id) {
      const safe = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id.replace(/"/g, '');
      const label = document.querySelector(`label[for="${safe}"]`);
      if (label) parts.push(cleanLabel(label));
    }
    const parentLabel = el.closest && el.closest('label');
    if (parentLabel) parts.push(cleanLabel(parentLabel));
    return norm(parts.join(' '));
  }

  function questionTitle(el) {
    const chunks = [];
    const listItem = el.closest && el.closest('[role="listitem"]');
    if (listItem) {
      listItem.querySelectorAll('[role="heading"], h1, h2, h3, h4').forEach((head) => {
        if (!head.contains(el)) chunks.push(head.innerText || '');
      });
    }
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 8) {
      let prev = node.previousElementSibling;
      let hops = 0;
      while (prev && hops < 5) {
        const tag = prev.tagName || '';
        const raw = (prev.innerText || '').trim();
        const firstLine = raw.split('\n')[0].replace(/\s+/g, ' ').trim();
        const heading = /^H[1-6]$/.test(tag) || prev.getAttribute('role') === 'heading' || tag === 'LEGEND';
        if (firstLine && (heading || firstLine.length < 80)) chunks.push(firstLine);
        prev = prev.previousElementSibling;
        hops += 1;
      }
      if (node.getAttribute && node.getAttribute('aria-label')) chunks.push(node.getAttribute('aria-label'));
      node = node.parentElement;
      depth += 1;
    }
    return chunks.find((text) => parseRole(text)) || chunks.find((text) => String(text || '').trim()) || '';
  }

  function nearestRole(el) {
    return parseRole(questionTitle(el));
  }

  function firstName(person) {
    return String(person.fullName || person.name || '').trim().split(/\s+/)[0] || '';
  }
  function lastName(person) {
    const parts = String(person.fullName || person.name || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  function matchFieldValue(raw, person) {
    if (!person) return null;
    const text = norm(raw);
    if (!text) return null;
    const hit = (re) => re.test(text);
    const take = (re, value) => (hit(re) ? (value || null) : undefined);

    const checks = [
      take(/\bgiven name\b|\bfirst name\b/, firstName(person)),
      take(/\bfamily name\b|\blast name\b|\bsurname\b/, lastName(person)),
      take(/\bgithub\b|\bgh\b/, person.github),
      take(/\blinkedin\b/, person.linkedin),
      take(/\bresume\b|\bcv\b|curriculum/, person.resume),
      take(/\b(portfolio|website|homepage|personal site)\b/, hit(/\b(project|team|company|event|school|github|linkedin)\b/) ? null : person.portfolio),
      take(/\bdiscord\b/, person.discord),
      take(/\bdevpost\b|\bdevfolio\b/, person.devfolio),
      take(/\bemergency\b/, person.emergency),
      take(/\be ?mail\b|\bmail\b/, person.email),
      take(/\b(phone|mobile|whatsapp|tel)\b|\bcontact\s*(number|no|num)\b|\b(leader|participant|member|phone|mobile|whatsapp)\s+no\b/, person.phone),
      take(/t ?shirt|shirt size|apparel size|swag size/, person.tshirt),
      take(/\bdiet\b|\bdietary\b|meal pref/, person.diet),
      take(/\b(sec|student|college|university|campus|registration|roll|admission)\b\s*(id|no|num|number|code)\b|\broll no\b|\breg(istration)? no\b/, person.secId)
    ];
    for (const value of checks) {
      if (value !== undefined) return value;
    }

    const vars = (person.customVariables || [])
      .filter((item) => item && item.name && item.value)
      .sort((a, b) => b.name.length - a.name.length);
    for (const item of vars) {
      const name = norm(item.name);
      if (name.length < 3 && !name.includes(' ')) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('(^|\\s)' + escaped + '(\\s|$)', 'i').test(text)) return item.value;
    }

    const broad = [
      take(/\b(degree|major|field of study)\b/, person.degree),
      take(/\b(graduat\w*|passing)\b.*\b(year|date)\b|\bgrad year\b|\bbatch year\b/, person.gradYear),
      take(/\b(college|university|school|institution|institute)\b(?!.*\b(id|email|code|number)\b)/, person.college),
      take(/\b(city|country|location|residence|district)\b/, person.location),
      take(/\b(full )?name\b/, (!hit(/\b(user name|file name|team name|event name|project name|display name|college name|university name|school name|company name)\b/) ? (person.fullName || person.name) : null))
    ];
    for (const value of broad) {
      if (value !== undefined) return value;
    }
    return null;
  }

  const STOP = new Set(['this', 'that', 'your', 'with', 'from', 'have', 'what', 'when', 'where', 'which', 'about', 'into', 'they', 'them', 'than', 'then', 'will', 'would', 'could', 'should', 'tell', 'does', 'please', 'write', 'describe']);

  function matchSnippet(raw, snippets) {
    const text = norm(raw);
    if (!text || !snippets || !snippets.length) return null;
    let best = null;
    let bestHits = 0;
    snippets.forEach((snip) => {
      const words = norm(snip.title).split(' ').filter((word) => word.length > 2 && !STOP.has(word));
      if (words.length < 2) return;
      const hits = words.filter((word) => text.includes(word)).length;
      if (hits >= 2 && hits / words.length >= 0.5 && hits > bestHits) {
        bestHits = hits;
        best = snip.content;
      }
    });
    return best;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function chooseOption(el, value) {
    const want = norm(value);
    if (!want) return false;
    let best = null;
    let bestScore = 0;
    Array.from(el.options || []).forEach((opt) => {
      const text = norm(opt.text);
      const val = norm(opt.value);
      let score = 0;
      if (val === want || text === want) score = 100;
      else if (text.startsWith(want) || val.startsWith(want)) score = 80;
      else if ((text + ' ' + val).split(' ').includes(want)) score = 70;
      else if (want.length >= 3 && (text.includes(want) || val.includes(want))) score = 60;
      if (score > bestScore) { bestScore = score; best = opt; }
    });
    if (!best || bestScore < 60) return false;
    el.value = best.value;
    el.selectedIndex = Array.from(el.options).indexOf(best);
    return true;
  }

  function flash(el) {
    el.classList.add('hackfill-flash-highlight');
    setTimeout(() => el.classList.remove('hackfill-flash-highlight'), 1200);
  }

  function fillElement(el, value) {
    if (value === undefined || value === null || value === '') return false;
    const next = String(value);
    if (el.isContentEditable) {
      if ((el.innerText || '').trim() === next) return false;
      el.focus();
      el.textContent = next;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: next }));
      flash(el);
      return true;
    }
    if (el.tagName === 'SELECT') {
      if (norm(el.value) === norm(next) || norm(el.options[el.selectedIndex] && el.options[el.selectedIndex].text) === norm(next)) return false;
      if (!chooseOption(el, next)) return false;
    } else if (el.value === next) {
      return false;
    } else {
      setNativeValue(el, next);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    flash(el);
    return true;
  }

  function fieldSignature(text) {
    if (/\bgithub\b/.test(text)) return 'github';
    if (/\blinkedin\b/.test(text)) return 'linkedin';
    if (/\b(resume|cv)\b|curriculum/.test(text)) return 'resume';
    if (/\bdiscord\b/.test(text)) return 'discord';
    if (/\be ?mail\b|\bmail\b/.test(text)) return 'email';
    if (/\b(phone|mobile|whatsapp)\b|\b(leader|participant|member)\s+no\b/.test(text)) return 'phone';
    if (/\b(full )?name\b/.test(text) && !/\b(user name|team name|event name|project name|college name|university name|school name)\b/.test(text)) return 'name';
    if (/\b(college|university|school)\b/.test(text) && !/\b(id|email)\b/.test(text)) return 'college';
    return null;
  }

  function repeatKey(text) {
    if (/confirm|verify|re enter|repeat/.test(text)) return null;
    return fieldSignature(text) ? text : null;
  }

  async function performAutofill(profileIn, teammatesIn, teamIn, snippetsIn) {
    if (!profileIn) await loadUserData();
    const profile = profileIn || cached.profile;
    const teammates = teammatesIn || cached.teammates;
    const team = teamIn || cached.team;
    const snippets = snippetsIn || cached.snippets;
    const roster = buildRoster(profile, teammates, team);
    const elements = getFormElements();
    const items = elements.map((el) => {
      const own = fieldText(el);
      const title = questionTitle(el);
      const role = parseRole(title) || parseRole(own) || nearestRole(el);
      const typeText = norm([own, title].filter(Boolean).join(' '));
      return { el, own: typeText, role, key: role ? null : repeatKey(typeText) };
    });
    const counts = {};
    items.forEach((item) => { if (item.key) counts[item.key] = (counts[item.key] || 0) + 1; });
    const seen = {};
    let filledCount = 0;
    const used = new Set();

    items.forEach((item) => {
      let role = item.role;
      if (!role && item.key && counts[item.key] >= 2) {
        const n = seen[item.key] || 0;
        seen[item.key] = n + 1;
        role = n === 0 ? { kind: 'lead' } : { kind: 'friend', n };
      }
      if (!role) role = { kind: 'lead' };
      const person = personForRole(role, roster);
      if (!person) return;
      let value = matchFieldValue(item.own, person);
      const long = item.el.tagName === 'TEXTAREA' || item.el.isContentEditable;
      if (!value && long) value = matchSnippet(item.own, snippets);
      if (value && fillElement(item.el, value)) {
        filledCount += 1;
        if (person.fullName || person.name) used.add(person.fullName || person.name);
      }
    });

    filledCount += fillRadios(roster);
    return { filledCount, names: Array.from(used) };
  }

  function optionText(el) {
    const label = el.closest('label');
    if (label) return norm(cleanLabel(label));
    if (el.id) {
      const safe = window.CSS && CSS.escape ? CSS.escape(el.id) : el.id;
      const node = document.querySelector(`label[for="${safe}"]`);
      if (node) return norm(cleanLabel(node));
    }
    return norm(el.value);
  }

  function fillRadios(roster) {
    const seen = new Set();
    let count = 0;
    document.querySelectorAll('input[type="radio"]').forEach((el) => {
      if (!el.name || seen.has(el.name) || el.closest('#hackfill-host')) return;
      seen.add(el.name);
      const group = Array.from(document.querySelectorAll('input[type="radio"]')).filter((node) => node.name === el.name);
      const question = fieldText(el) + ' ' + (nearestRole(el) ? '' : '');
      const fieldset = el.closest('fieldset');
      const legend = fieldset && fieldset.querySelector('legend') ? fieldset.querySelector('legend').innerText : '';
      const own = norm([el.name, legend, question].join(' '));
      const role = parseRole(own) || nearestRole(el) || { kind: 'lead' };
      const person = personForRole(role, roster);
      if (!person) return;
      const desired = matchFieldValue(own, person);
      if (!desired) return;
      const want = norm(desired);
      const match = group.find((radio) => {
        const opt = optionText(radio);
        return opt === want || opt.startsWith(want) || (want.length > 2 && opt.includes(want));
      });
      if (!match || match.checked) return;
      match.click();
      count += 1;
      flash(match);
    });
    return count;
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showInPageToast(message) {
    const host = document.getElementById('hackfill-host');
    const parent = (host && host.shadowRoot) || document.body;
    if (!parent) return;
    let toast = parent.querySelector('#hackfill-inpage-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hackfill-inpage-toast';
      toast.className = 'toast';
      parent.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 1800);
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showInPageToast('Copied ' + (label || 'value'));
  }

  let hudInjecting = false;
  let lastField = null;

  document.addEventListener('focusin', rememberField, true);
  document.addEventListener('pointerdown', rememberField, true);

  function rememberField(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (path.some((node) => node && (node.id === 'hackfill-host' || node.id === 'hackfill-qr'))) return;
    const t = path.find((node) => node && node.tagName && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable));
    if (!t || t === document.body || t === document.documentElement) return;
    const type = (t.getAttribute && t.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'password', 'reset', 'image'].includes(type)) return;
    lastField = t;
  }

  function cssHref() {
    try {
      if (ext && ext.runtime && ext.runtime.getURL) return ext.runtime.getURL('content/hud.css');
    } catch (err) { /* opened outside the extension */ }
    return SCRIPT_BASE ? SCRIPT_BASE + 'hud.css' : 'content/hud.css';
  }

  async function injectFloatingHUD() {
    if (document.getElementById('hackfill-host') || hudInjecting) return;
    hudInjecting = true;
    try {
      await loadUserData();
      if (document.getElementById('hackfill-host')) return;
      const host = document.createElement('div');
      host.id = 'hackfill-host';
      host.style.setProperty('position', 'fixed', 'important');
      host.style.setProperty('z-index', '2147483646', 'important');
      host.style.setProperty('margin', '0', 'important');
      host.style.setProperty('display', 'block', 'important');
      host.style.setProperty('width', 'max-content', 'important');
      host.style.setProperty('height', 'max-content', 'important');
      host.style.setProperty('pointer-events', 'auto', 'important');
      host.style.setProperty('right', 'auto', 'important');
      host.style.setProperty('bottom', 'auto', 'important');
      const shadow = host.attachShadow({ mode: 'open' });
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref();
      shadow.appendChild(link);
      const root = document.createElement('div');
      root.innerHTML = `
        <section class="drawer hidden" id="drawer">
          <div class="head">
            <div class="title">HACKFILL</div>
            <div class="head-actions">
              <button class="mini" id="open-settings" type="button">Edit</button>
              <button class="close" id="close-drawer" type="button" aria-label="Close">&times;</button>
            </div>
          </div>
          <div class="body">
            <button class="primary" id="do-fill" type="button">Fill this form</button>
            <div>
              <div class="label">Odd question</div>
              <p class="muted">Click the box on the form, then send a saved detail into it.</p>
              <select class="pick" id="fill-who"></select>
              <select class="pick" id="fill-what"></select>
              <button class="secondary" id="fill-focus" type="button">Fill that box</button>
            </div>
            <div>
              <div class="label">Your links</div>
              <div class="chips" id="my-chips"></div>
            </div>
            <div>
              <div class="label" id="squad-label">Lineup</div>
              <div id="squad-list"></div>
            </div>
            <button class="secondary" id="do-log" type="button">Log this event as applied</button>
          </div>
        </section>
        <button class="trigger" id="trigger" type="button" title="HackFill">
          <span class="eye"></span><span>HackFill</span>
        </button>`;
      shadow.appendChild(root);
      document.body.appendChild(host);

      const trigger = shadow.getElementById('trigger');
      const drawer = shadow.getElementById('drawer');
      let dragging = false;
      let moved = false;
      let startX = 0;
      let startY = 0;
      let originX = 0;
      let originY = 0;
      let currentX = null;
      let currentY = null;

      function place(x, y) {
        const rect = trigger.getBoundingClientRect();
        const w = rect.width > 20 && rect.width < 280 ? rect.width : 140;
        const h = rect.height > 16 && rect.height < 80 ? rect.height : 40;
        currentX = Math.max(8, Math.min(window.innerWidth - w - 8, x));
        currentY = Math.max(8, Math.min(window.innerHeight - h - 8, y));
        host.style.setProperty('left', currentX + 'px', 'important');
        host.style.setProperty('top', currentY + 'px', 'important');
      }

      function placeDrawer() {
        const rect = trigger.getBoundingClientRect();
        const width = 320;
        let left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
        drawer.style.left = left + 'px';
        const below = window.innerHeight - rect.bottom;
        if (rect.top > below) {
          drawer.style.top = 'auto';
          drawer.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        } else {
          drawer.style.bottom = 'auto';
          drawer.style.top = (rect.bottom + 8) + 'px';
        }
      }

      try {
        const saved = JSON.parse(localStorage.getItem('__hackfill_pos__') || 'null');
        if (saved && typeof saved.x === 'number') { currentX = saved.x; currentY = saved.y; }
      } catch (err) { /* ignore bad position */ }
      if (currentX === null) {
        currentX = Math.max(8, window.innerWidth - 150);
        currentY = Math.max(8, window.innerHeight - 72);
      }
      place(currentX, currentY);

      function onPointerMove(e) {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          moved = true;
          drawer.classList.add('hidden');
        }
        if (moved) {
          if (e.cancelable) e.preventDefault();
          place(originX + dx, originY + dy);
        }
      }
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onPointerMove, true);
        document.removeEventListener('mouseup', endDrag, true);
        if (moved) {
          try { localStorage.setItem('__hackfill_pos__', JSON.stringify({ x: currentX, y: currentY })); } catch (err) { /* private mode */ }
        }
      }
      function startDrag(e) {
        if (e.button !== 0 || dragging) return;
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        originX = currentX;
        originY = currentY;
        document.addEventListener('mousemove', onPointerMove, true);
        document.addEventListener('mouseup', endDrag, true);
      }
      trigger.addEventListener('mousedown', startDrag);

      trigger.addEventListener('click', async () => {
        if (moved) { moved = false; return; }
        await loadUserData();
        renderHUD(shadow);
        const opening = drawer.classList.contains('hidden');
        if (opening) {
          placeDrawer();
          drawer.classList.remove('hidden');
        } else drawer.classList.add('hidden');
      });
      shadow.getElementById('close-drawer').addEventListener('click', () => drawer.classList.add('hidden'));
      document.addEventListener('click', (e) => {
        if (e.composedPath && e.composedPath().includes(host)) return;
        drawer.classList.add('hidden');
      });
      window.addEventListener('resize', () => {
        if (currentX !== null) place(currentX, currentY);
        if (!drawer.classList.contains('hidden')) placeDrawer();
      });

      const openSettings = () => {
        if (ext && ext.runtime && ext.runtime.sendMessage) ext.runtime.sendMessage({ action: 'OPEN_SETTINGS' });
      };
      shadow.getElementById('open-settings').addEventListener('click', openSettings);
      shadow.getElementById('do-fill').addEventListener('click', async () => {
        const result = await performAutofill();
        showInPageToast(result.filledCount ? 'Filled ' + result.filledCount + ' fields' : 'No matching fields');
        drawer.classList.add('hidden');
      });
      shadow.getElementById('fill-who').addEventListener('change', () => renderHUD(shadow));
      shadow.getElementById('fill-focus').addEventListener('click', () => fillFocusedBox(shadow));
      shadow.getElementById('do-log').addEventListener('click', async () => {
        const res = await storageGet(['tracker', 'profile', 'teammates', 'team']);
        const tracker = res.tracker || [];
        const roster = buildRoster(res.profile || {}, res.teammates || [], res.team);
        const squad = roster.filter(Boolean).map((p) => p.name).filter(Boolean).join(', ');
        tracker.unshift({
          id: 'app_' + Date.now(),
          eventName: (document.title || 'Hackathon').split(' - ')[0].split(' | ')[0].trim(),
          eventUrl: location.href,
          appliedDate: new Date().toISOString().slice(0, 10),
          status: 'Applied',
          squad: squad || 'Solo',
          notes: 'Logged from the page'
        });
        await storageSet({ tracker });
        showInPageToast('Logged this event');
        drawer.classList.add('hidden');
      });
      renderHUD(shadow);
    } finally {
      hudInjecting = false;
    }
  }

  function renderHUD(shadow) {
    const chips = shadow.getElementById('my-chips');
    const squad = shadow.getElementById('squad-list');
    const label = shadow.getElementById('squad-label');
    if (!chips || !squad) return;
    const profile = asPerson(cached.profile, true) || {};
    const items = [
      ['GitHub', profile.github], ['LinkedIn', profile.linkedin], ['Resume', profile.resume],
      ['Portfolio', profile.portfolio], ['Email', profile.email], ['Phone', profile.phone],
      ['Discord', profile.discord], ['ID', profile.secId]
    ].filter((item) => item[1]);
    (profile.customVariables || []).forEach((cv) => { if (cv.name && cv.value) items.push([cv.name, cv.value]); });
    chips.innerHTML = items.length
      ? items.map((item) => `<button class="chip" type="button" data-copy="${escapeHTML(item[1])}">${escapeHTML(item[0])}</button>`).join('')
      : '<span class="muted">Add your links in HackFill.</span>';
    chips.querySelectorAll('.chip').forEach((btn) => btn.addEventListener('click', () => copyText(btn.dataset.copy, btn.textContent)));

    const roster = buildRoster(cached.profile, cached.teammates, cached.team);
    if (label) label.textContent = 'Lineup · ' + roster.length;
    const rows = roster.map((person, index) => {
      if (!person) {
        return `<div class="person"><b>${index === 0 ? 'You' : 'Teammate ' + index}</b><span class="muted">Empty slot</span></div>`;
      }
      const bits = [
        ['GitHub', person.github], ['LinkedIn', person.linkedin], ['Resume', person.resume],
        ['Email', person.email], ['ID', person.secId], ['Phone', person.phone]
      ].filter((item) => item[1]);
      (person.customVariables || []).forEach((cv) => { if (cv.name && cv.value) bits.push([cv.name, cv.value]); });
      const who = index === 0 ? 'You' : 'Teammate ' + index;
      return `<div class="person"><b>${escapeHTML(person.name || who)} · ${who}</b><div class="chips">${bits.map((item) => `<button class="chip" type="button" data-copy="${escapeHTML(item[1])}">${escapeHTML(item[0])}</button>`).join('')}</div></div>`;
    }).join('');
    squad.innerHTML = rows || '<span class="muted">No lineup yet.</span>';
    squad.querySelectorAll('.chip').forEach((btn) => btn.addEventListener('click', () => copyText(btn.dataset.copy, btn.textContent)));
    renderFillPicks(shadow, roster);
  }

  const FILL_FIELDS = [
    ['fullName', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['college', 'College'],
    ['degree', 'Degree'], ['gradYear', 'Grad year'], ['secId', 'College ID'], ['github', 'GitHub'],
    ['linkedin', 'LinkedIn'], ['portfolio', 'Portfolio'], ['resume', 'Resume'], ['discord', 'Discord'],
    ['location', 'City'], ['tshirt', 'T-shirt'], ['diet', 'Diet'], ['devfolio', 'Devfolio']
  ];

  function valueForKey(person, key) {
    if (!person || !key) return '';
    if (key.indexOf('cv:') === 0) {
      const name = norm(key.slice(3));
      const found = (person.customVariables || []).find((item) => norm(item.name) === name);
      return found ? found.value : '';
    }
    if (key === 'fullName') return person.fullName || person.name || '';
    return person[key] || '';
  }

  function renderFillPicks(shadow, roster) {
    const who = shadow.getElementById('fill-who');
    const what = shadow.getElementById('fill-what');
    if (!who || !what) return;
    const prevWho = who.value;
    const prevWhat = what.value;
    who.innerHTML = roster.map((person, index) => {
      const label = index === 0 ? 'You' : 'Teammate ' + index;
      const name = person && (person.fullName || person.name);
      return `<option value="${index}">${escapeHTML(name ? label + ' · ' + name : label + ' · empty')}</option>`;
    }).join('');
    if (prevWho && who.querySelector(`option[value="${prevWho}"]`)) who.value = prevWho;
    const person = roster[Number(who.value)] || roster[0] || {};
    const options = FILL_FIELDS.slice();
    (person.customVariables || []).forEach((item) => {
      if (item && item.name && item.value) options.push(['cv:' + item.name, item.name]);
    });
    what.innerHTML = options.map((item) => `<option value="${escapeHTML(item[0])}">${escapeHTML(item[1])}</option>`).join('');
    if (prevWhat && Array.from(what.options).some((opt) => opt.value === prevWhat)) what.value = prevWhat;
  }

  function fillFocusedBox(shadow) {
    const el = lastField;
    if (!el || !el.isConnected) {
      showInPageToast('Click the form box first');
      return;
    }
    const who = shadow.getElementById('fill-who');
    const what = shadow.getElementById('fill-what');
    const roster = buildRoster(cached.profile, cached.teammates, cached.team);
    const person = roster[Number(who && who.value)];
    const value = valueForKey(person, what && what.value);
    if (!value) {
      showInPageToast('That detail is empty');
      return;
    }
    try { el.focus(); } catch (err) { /* the box can still take a value */ }
    showInPageToast(fillElement(el, value) ? 'Filled' : 'Already filled');
  }

  if (ext && ext.runtime && ext.runtime.onMessage) {
    ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'AUTOFILL_PAGE') {
        const payload = request.payload || {};
        performAutofill(payload.profile, payload.teammates, payload.team, payload.snippets)
          .then((result) => sendResponse({ status: 'ok', filledCount: result.filledCount, names: result.names }))
          .catch((err) => sendResponse({ status: 'error', error: String(err) }));
        return true;
      }
      if (request.action === 'CHECK_FORMS') {
        const inputs = getFormElements();
        sendResponse({ hasForm: inputs.length > 0, inputCount: inputs.length });
        return true;
      }
      if (request.action === 'INSERT_SNIPPET') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
          fillElement(active, request.text);
          showInPageToast('Pasted');
        } else {
          copyText(request.text, 'value');
        }
        sendResponse({ success: true });
        return true;
      }
      return undefined;
    });
  }

  function init() {
    if (getFormElements().length > 0) injectFloatingHUD();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  let observeTimer = null;
  const observer = new MutationObserver(() => {
    if (document.getElementById('hackfill-host')) {
      observer.disconnect();
      return;
    }
    clearTimeout(observeTimer);
    observeTimer = setTimeout(() => {
      if (document.getElementById('hackfill-host')) {
        observer.disconnect();
        return;
      }
      if (getFormElements().length > 0) injectFloatingHUD();
    }, 350);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });
})();
