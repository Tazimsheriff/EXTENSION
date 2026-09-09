/**
 * HackFill - Content Script
 * Intelligent Form Analyzer, AutoFill Engine, Teammate Mapper & Floating Buddy
 */

(() => {
  // Prevent duplicate injection
  if (window.__HACKFILL_INJECTED__) return;
  window.__HACKFILL_INJECTED__ = true;

  // ── Browser API shim ──────────────────────────────────────────────────────
  // Firefox exposes `browser`; Chrome exposes `chrome`. Normalise to `ext`.
  const ext = (typeof browser !== 'undefined') ? browser : chrome;

  let cachedData = {
    profile: {},
    teammates: [],
    snippets: []
  };

  // Load user data from extension Storage
  async function loadUserData() {
    if (typeof ext !== 'undefined' && ext.storage && ext.storage.local) {
      try {
        const res = await ext.storage.local.get(['profile', 'teammates', 'snippets']);
        cachedData.profile = res.profile || {};
        cachedData.teammates = res.teammates || [];
        cachedData.snippets = res.snippets || [];
      } catch (e) {
        console.warn('[HackFill] Error loading storage:', e);
      }
    }
  }

  // Find all form fields on page
  function getFormElements() {
    return Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
    )).filter(el => {
      // Must be somewhat visible
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }

  // Extract all surrounding context for an element
  function getFieldContext(el) {
    const parts = [];

    if (el.id) parts.push(el.id);
    if (el.name) parts.push(el.name);
    if (el.placeholder) parts.push(el.placeholder);
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    if (el.getAttribute('aria-labelledby')) {
      const labelEl = document.getElementById(el.getAttribute('aria-labelledby'));
      if (labelEl) parts.push(labelEl.innerText);
    }
    if (el.getAttribute('autocomplete')) parts.push(el.getAttribute('autocomplete'));

    // Associated label
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) parts.push(label.innerText);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) parts.push(parentLabel.innerText);

    // Closest form group, question block, or container
    const container = el.closest(
      '.form-group, .form-row, .field, .input-group, [role="listitem"], .Qr7Oae, [data-field], .js-form-item'
    );
    if (container) {
      // Grab text inside container excluding the input's current value
      const heading = container.querySelector('label, h1, h2, h3, h4, [role="heading"], .title, .label');
      if (heading) {
        parts.push(heading.innerText);
      } else {
        parts.push(container.innerText);
      }
    } else {
      // Fallback: Check previous sibling element
      let prev = el.previousElementSibling;
      let depth = 0;
      while (prev && depth < 2) {
        parts.push(prev.innerText || '');
        prev = prev.previousElementSibling;
        depth++;
      }
    }

    return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Check if context text targets a specific teammate (e.g. Teammate 2, Member 3, etc.)
  function detectTeammateIndex(context) {
    // Check for "Teammate 2", "Member 3", "Participant 2", etc.
    const m1 = context.match(/(?:team\s*mate|member|participant|partner|hacker|person|friend)\s*#?\s*([1-4])/i);
    if (m1) return parseInt(m1[1], 10);

    if (/(?:2nd|second)\s*(?:team\s*mate|member|participant|partner)/i.test(context)) return 2;
    if (/(?:3rd|third)\s*(?:team\s*mate|member|participant|partner)/i.test(context)) return 3;
    if (/(?:4th|fourth)\s*(?:team\s*mate|member|participant|partner)/i.test(context)) return 4;
    if (/(?:1st|first)\s*(?:team\s*mate|member|participant|partner)/i.test(context)) return 1;

    return null;
  }

  // Get teammate object for an index (1-based)
  function getTeammateForIndex(index, teammates) {
    if (!teammates || teammates.length === 0) return null;
    // First try explicitly assigned squadPos
    const squadMember = teammates.find(t => t.squadPos === index);
    if (squadMember) return squadMember;

    // Fallback: index - 1 in list
    if (teammates[index - 1]) return teammates[index - 1];
    return null;
  }

  // Smart matching of field to profile/teammate value
  function matchFieldValue(context, profile, teammate = null) {
    const target = teammate || profile;
    if (!target) return null;

    // 1. GitHub
    if (/github|gh[\s_\-]|github\.com/i.test(context)) {
      return target.github || null;
    }

    // 2. LinkedIn
    if (/linkedin|li[\s_\-]|linkedin\.com/i.test(context)) {
      return target.linkedin || null;
    }

    // 3. Resume / CV
    if (/resume|curriculum|cv\b|google\s*drive.*resume/i.test(context)) {
      return target.resume || null;
    }

    // 4. Portfolio / Website
    if (/portfolio|personal\s*website|website|personal\s*site|web\s*url|homepage/i.test(context)) {
      return target.portfolio || null;
    }

    // 5. Discord
    if (/discord/i.test(context)) {
      return target.discord || null;
    }

    // 6. Devpost / Devfolio
    if (/devpost|devfolio/i.test(context)) {
      return target.devfolio || null;
    }

    // 7. Email
    if (/\bemail\b|e-mail|\bmail\b/i.test(context)) {
      return target.email || null;
    }

    // 8. Phone / WhatsApp
    if (/phone|mobile|cell|whatsapp|contact\s*no|tel\b/i.test(context)) {
      return target.phone || null;
    }

    // 9. College / University
    if (/college|university|school|institution|institute|campus/i.test(context)) {
      return target.college || null;
    }

    // 10. Degree / Major
    if (/degree|major|field\s*of\s*study|course|department/i.test(context)) {
      return target.degree || null;
    }

    // 11. Graduation Year
    if (/grad\w*\s*year|passing\s*year|batch|graduation/i.test(context)) {
      return target.gradYear || null;
    }

    // 12. T-Shirt Size
    if (/t-?shirt|shirt\s*size|swag\s*size/i.test(context)) {
      return target.tshirt || null;
    }

    // 13. Dietary Restrictions
    if (/diet|dietary|food\s*pref|meal/i.test(context)) {
      return target.diet || null;
    }

    // 14. Emergency Contact
    if (/emergency/i.test(context)) {
      return target.emergency || null;
    }

    // 15. College / Student ID / SEC ID / Roll No / Registration No
    if (/sec[\s_\-]*id|college[\s_\-]*id|student[\s_\-]*id|roll[\s_\-]*(?:no|num|number)|registration[\s_\-]*(?:no|num|number|id)|reg[\s_\-]*no|hall[\s_\-]*ticket|admission[\s_\-]*no|campus[\s_\-]*id|university[\s_\-]*id/i.test(context)) {
      return target.secId || null;
    }

    // 16. Custom Variables defined by user (dynamic matching)
    if (target.customVariables && Array.isArray(target.customVariables)) {
      for (const cv of target.customVariables) {
        if (cv && cv.name && cv.value) {
          const varName = cv.name.trim().toLowerCase();
          if (varName.length >= 2) {
            const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'i');
            if (regex.test(context)) {
              return cv.value;
            }
          }
        }
      }
    }

    // 17. City / Location
    if (/location|city|residence|country/i.test(context)) {
      return target.location || null;
    }

    // 18. Name matching
    if (/(?:full\s*name|applicant\s*name|your\s*name|legal\s*name|^name$|member\s*name)/i.test(context)) {
      return target.fullName || target.name || null;
    }
    if (/first\s*name|given\s*name/i.test(context)) {
      const full = target.fullName || target.name || '';
      return full.split(' ')[0] || null;
    }
    if (/last\s*name|surname|family\s*name/i.test(context)) {
      const full = target.fullName || target.name || '';
      const parts = full.split(' ');
      return parts.length > 1 ? parts.slice(1).join(' ') : null;
    }

    return null;
  }

  // Safely assign value to an input/textarea/select with event dispatching
  function fillElement(el, value) {
    if (!value || el.value === value) return false;

    if (el.tagName === 'SELECT') {
      let matched = false;
      const valLower = value.toString().toLowerCase();
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        const optText = opt.text.toLowerCase();
        const optVal = opt.value.toLowerCase();
        if (optVal === valLower || optText === valLower || optText.startsWith(valLower)) {
          el.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    } else {
      // Input or textarea
      // Use prototype setter to bypass React 16+ input masking
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, value);
      } else {
        el.value = value;
      }
    }

    // Trigger reactive listeners
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    // Highlight flash
    el.classList.add('hackfill-flash-highlight');
    setTimeout(() => el.classList.remove('hackfill-flash-highlight'), 1200);

    return true;
  }

  // Main Autofill Operation
  async function performAutofill(customProfile = null, customTeammates = null) {
    await loadUserData();
    const profile = customProfile || cachedData.profile;
    const teammates = customTeammates || cachedData.teammates;

    const elements = getFormElements();
    let filledCount = 0;

    elements.forEach(el => {
      const context = getFieldContext(el);
      const tmIndex = detectTeammateIndex(context);

      let matchedVal = null;

      if (tmIndex !== null) {
        // Form field is specifically for a teammate (e.g. Teammate 2)
        const tm = getTeammateForIndex(tmIndex, teammates);
        if (tm) {
          matchedVal = matchFieldValue(context, null, tm);
        }
      } else {
        // Form field is for primary applicant
        matchedVal = matchFieldValue(context, profile, null);
      }

      if (matchedVal) {
        const success = fillElement(el, matchedVal);
        if (success) filledCount++;
      }
    });

    return filledCount;
  }

  // Show In-Page Mini Toast
  function showInPageToast(message) {
    let toast = document.getElementById('hackfill-inpage-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hackfill-inpage-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2000);
  }

  // Copy text helper
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showInPageToast(`📋 Copied ${label}!`);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showInPageToast(`📋 Copied ${label}!`);
    }
  }

  // Guard flag: prevents async race where MutationObserver fires
  // while injectFloatingHUD is still awaiting loadUserData
  let _hudInjecting = false;

  // Inject Floating HUD / Quick Buddy Drawer
  async function injectFloatingHUD() {
    if (document.getElementById('hackfill-hud-root')) return;
    if (_hudInjecting) return;
    _hudInjecting = true;

    try {
      await loadUserData();

      // Re-check after await (another call may have succeeded while we awaited)
      if (document.getElementById('hackfill-hud-root')) return;

      const root = document.createElement('div');
      root.id = 'hackfill-hud-root';

      // HTML Structure of Drawer & Trigger
      root.innerHTML = `
        <div id="hackfill-drawer" class="hackfill-hidden">
          <div class="hackfill-d-header">
            <div class="hackfill-d-title">
              <span>⚡</span> HackFill Quick Buddy
            </div>
            <div class="hackfill-d-header-actions">
              <button class="hackfill-d-settings" id="hackfill-d-settings-btn" title="Open Full Dashboard & Settings">⚙️ Settings</button>
              <button class="hackfill-d-close" id="hackfill-d-close-btn" title="Close">&times;</button>
            </div>
          </div>
          <div class="hackfill-d-body">
            <button class="hackfill-btn-primary" id="hackfill-action-autofill">
              <span>⚡</span> AutoFill Entire Form
            </button>

            <!-- Quick Personal Links -->
            <div>
              <div class="hackfill-section-heading">
                <span>My Links (Click to copy)</span>
              </div>
              <div class="hackfill-chips-grid" id="hackfill-my-chips">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <!-- Squad Teammates -->
            <div id="hackfill-squad-section">
              <div class="hackfill-section-heading">
                <span>👥 Squad Teammates</span>
              </div>
              <div id="hackfill-squad-list">
                <!-- Rendered dynamically -->
              </div>
            </div>

            <!-- Log Event Button -->
            <button class="hackfill-btn-secondary" id="hackfill-action-log">
              <span>📌</span> Log This Hackathon as Applied
            </button>

            <!-- Open Full Settings Button -->
            <button class="hackfill-btn-settings" id="hackfill-action-settings">
              <span>⚙️</span> Edit Profile, Team & Custom Vars
            </button>
          </div>
        </div>

        <button id="hackfill-trigger-btn" title="Open HackFill Quick Drawer">
          <span class="hackfill-pulse-dot"></span>
          <span>⚡ HackFill</span>
        </button>
      `;

      document.body.appendChild(root);

      // ── Bind events using root.querySelector to avoid SPA ID conflicts ──
      const triggerBtn  = root.querySelector('#hackfill-trigger-btn');
      const drawer      = root.querySelector('#hackfill-drawer');
      const closeBtn    = root.querySelector('#hackfill-d-close-btn');
      const autofillBtn = root.querySelector('#hackfill-action-autofill');
      const logBtn      = root.querySelector('#hackfill-action-log');

      // ── Drag & Smart Positioning Logic ──────────────────────────────────────────
      let isDragging = false;
      let dragMoved  = false;
      let startPointerX = 0;
      let startPointerY = 0;
      let startElemX = 0;
      let startElemY = 0;
      let currentX = null;
      let currentY = null;
      const DRAG_THRESHOLD = 4; // px

      triggerBtn.style.touchAction = 'none';

      function setRootPosition(x, y) {
        const btnWidth = triggerBtn.offsetWidth || 120;
        const btnHeight = triggerBtn.offsetHeight || 42;
        const maxX = Math.max(10, window.innerWidth - btnWidth - 10);
        const maxY = Math.max(10, window.innerHeight - btnHeight - 10);
        currentX = Math.max(10, Math.min(maxX, x));
        currentY = Math.max(10, Math.min(maxY, y));

        root.style.setProperty('left', currentX + 'px', 'important');
        root.style.setProperty('top', currentY + 'px', 'important');
        root.style.setProperty('right', 'auto', 'important');
        root.style.setProperty('bottom', 'auto', 'important');
      }

      function updateDrawerPosition() {
        const btnRect = triggerBtn.getBoundingClientRect();
        const drawerWidth = 340;

        // Determine horizontal placement
        let left = btnRect.right - drawerWidth;
        if (left < 10) {
          left = btnRect.left;
        }
        left = Math.max(10, Math.min(window.innerWidth - drawerWidth - 10, left));
        drawer.style.setProperty('left', left + 'px', 'important');
        drawer.style.setProperty('right', 'auto', 'important');

        // Determine vertical placement: pop upwards if in bottom half or >= 380px space above
        const spaceAbove = btnRect.top;
        const spaceBelow = window.innerHeight - btnRect.bottom;
        if (spaceAbove >= 380 || spaceAbove > spaceBelow) {
          const bottom = window.innerHeight - btnRect.top + 8;
          drawer.style.setProperty('bottom', bottom + 'px', 'important');
          drawer.style.setProperty('top', 'auto', 'important');
          drawer.style.transformOrigin = (left === btnRect.left) ? 'bottom left' : 'bottom right';
        } else {
          const top = btnRect.bottom + 8;
          drawer.style.setProperty('top', top + 'px', 'important');
          drawer.style.setProperty('bottom', 'auto', 'important');
          drawer.style.transformOrigin = (left === btnRect.left) ? 'top left' : 'top right';
        }
      }

      // Initialize position (restore from storage or default to bottom-right)
      try {
        const saved = localStorage.getItem('__hackfill_pos__');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            currentX = parsed.x;
            currentY = parsed.y;
          }
        }
      } catch (_) {}

      if (currentX === null || currentY === null || isNaN(currentX) || isNaN(currentY)) {
        currentX = Math.max(10, window.innerWidth - 150);
        currentY = Math.max(10, window.innerHeight - 70);
      }
      setRootPosition(currentX, currentY);

      function onPointerDown(e) {
        if (e.button !== 0) return; // Only primary mouse button
        isDragging = true;
        dragMoved  = false;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        startElemX = currentX;
        startElemY = currentY;

        try {
          triggerBtn.setPointerCapture(e.pointerId);
        } catch (_) {}

        triggerBtn.style.cursor = 'grabbing';
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startPointerX;
        const dy = e.clientY - startPointerY;

        if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          dragMoved = true;
          drawer.classList.add('hackfill-hidden');
        }

        if (dragMoved) {
          setRootPosition(startElemX + dx, startElemY + dy);
        }
      }

      function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        triggerBtn.style.cursor = '';

        try {
          if (e && e.pointerId && triggerBtn.hasPointerCapture(e.pointerId)) {
            triggerBtn.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        if (dragMoved) {
          try {
            localStorage.setItem('__hackfill_pos__', JSON.stringify({
              x: currentX,
              y: currentY
            }));
          } catch (_) {}
        }
      }

      triggerBtn.addEventListener('pointerdown',   onPointerDown);
      triggerBtn.addEventListener('pointermove',   onPointerMove);
      triggerBtn.addEventListener('pointerup',     onPointerUp);
      triggerBtn.addEventListener('pointercancel', onPointerUp);

      // Document-level fallback if pointer capture gets interrupted
      document.addEventListener('pointermove', (e) => {
        if (isDragging && dragMoved) onPointerMove(e);
      });
      document.addEventListener('pointerup', (e) => {
        if (isDragging) onPointerUp(e);
      });

      window.addEventListener('resize', () => {
        if (currentX !== null && currentY !== null) {
          setRootPosition(currentX, currentY);
        }
        if (!drawer.classList.contains('hackfill-hidden')) {
          updateDrawerPosition();
        }
      }, { passive: true });

      document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) {
          drawer.classList.add('hackfill-hidden');
        }
      });
      // ─────────────────────────────────────────────────────────────────────────────

      triggerBtn.addEventListener('click', async () => {
        // Ignore click if it was actually the end of a drag
        if (dragMoved) { dragMoved = false; return; }
        try {
          await loadUserData();
          renderHUDChips(root);
          const isOpening = drawer.classList.contains('hackfill-hidden');
          if (isOpening) {
            updateDrawerPosition();
            drawer.classList.remove('hackfill-hidden');
          } else {
            drawer.classList.add('hackfill-hidden');
          }
        } catch (e) {
          console.error('[HackFill] trigger click error:', e);
        }
      });

      closeBtn.addEventListener('click', () => {
        drawer.classList.add('hackfill-hidden');
      });

      const openSettings = () => {
        if (typeof ext !== 'undefined' && ext.runtime && ext.runtime.sendMessage) {
          ext.runtime.sendMessage({ action: 'OPEN_SETTINGS' });
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          window.open(chrome.runtime.getURL('popup/popup.html'), '_blank');
        }
      };

      const settingsBtnHeader = root.querySelector('#hackfill-d-settings-btn');
      const settingsBtnBody   = root.querySelector('#hackfill-action-settings');
      if (settingsBtnHeader) settingsBtnHeader.addEventListener('click', openSettings);
      if (settingsBtnBody)   settingsBtnBody.addEventListener('click', openSettings);

      autofillBtn.addEventListener('click', async () => {
        try {
          const count = await performAutofill();
          showInPageToast(count > 0 ? `⚡ AutoFilled ${count} fields!` : 'No matching fields found');
          drawer.classList.add('hackfill-hidden');
        } catch (e) {
          console.error('[HackFill] autofill error:', e);
        }
      });

      logBtn.addEventListener('click', async () => {
        try {
          const title = document.title.split(' - ')[0].split(' | ')[0].trim() || 'Hackathon Application';
          const url = window.location.href;

          const res = await ext.storage.local.get(['tracker', 'profile', 'teammates']);
          const tracker  = res.tracker   || [];
          const profile  = res.profile   || {};
          const teammates = res.teammates || [];

          const squadNames = teammates
            .filter(t => t.squadPos)
            .sort((a, b) => a.squadPos - b.squadPos)
            .map(t => t.name)
            .join(', ');

          const newEntry = {
            id: 'app_' + Date.now(),
            eventName: title,
            eventUrl: url,
            appliedDate: new Date().toISOString().split('T')[0],
            status: 'Applied',
            squad: squadNames
              ? (profile.fullName ? `${profile.fullName}, ${squadNames}` : squadNames)
              : (profile.fullName || 'Solo'),
            notes: 'Logged via HackFill In-Page Buddy'
          };

          tracker.unshift(newEntry);
          await ext.storage.local.set({ tracker });
          showInPageToast(`📌 Logged "${title}" to Tracker!`);
          drawer.classList.add('hackfill-hidden');
        } catch (e) {
          console.error('[HackFill] log error:', e);
        }
      });

      renderHUDChips(root);
    } finally {
      _hudInjecting = false;
    }
  }

  // Populate HUD chips from cachedData
  function renderHUDChips(root) {
    // Query inside root if provided (avoids SPA ID conflicts), else fallback to document
    const scope = root || document.getElementById('hackfill-hud-root') || document;
    const chipsContainer = scope.querySelector('#hackfill-my-chips');
    const squadContainer = scope.querySelector('#hackfill-squad-list');
    if (!chipsContainer || !squadContainer) return;

    const p = cachedData.profile || {};
    const myItems = [
      { label: 'GitHub', val: p.github },
      { label: 'LinkedIn', val: p.linkedin },
      { label: 'Resume', val: p.resume },
      { label: 'Portfolio', val: p.portfolio },
      { label: 'SEC ID', val: p.secId },
      { label: 'Email', val: p.email },
      { label: 'Discord', val: p.discord },
      { label: 'Phone', val: p.phone }
    ].filter(item => Boolean(item.val));

    // Append custom variables to HUD chips
    if (p.customVariables && Array.isArray(p.customVariables)) {
      p.customVariables.forEach(cv => {
        if (cv.name && cv.value) {
          myItems.push({ label: cv.name, val: cv.value });
        }
      });
    }

    if (myItems.length === 0) {
      chipsContainer.innerHTML = '<span style="font-size:11px;color:#64748b;">No profile links saved. Open extension popup to add.</span>';
    } else {
      chipsContainer.innerHTML = myItems.map(item => `
        <button class="hackfill-chip" data-copy="${escapeHTML(item.val)}" title="${escapeHTML(item.val)}">
          ${escapeHTML(item.label)}
        </button>
      `).join('');

      chipsContainer.querySelectorAll('.hackfill-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          copyText(btn.dataset.copy, btn.textContent.trim());
        });
      });
    }

    // Squad teammates
    const tmList = cachedData.teammates || [];
    if (tmList.length === 0) {
      squadContainer.innerHTML = '<span style="font-size:11px;color:#64748b;">No teammates in vault.</span>';
    } else {
      squadContainer.innerHTML = tmList.map(tm => `
        <div class="hackfill-tm-item">
          <div class="hackfill-tm-header">
            <span>${escapeHTML(tm.name)} ${tm.squadPos ? `<small style="color:#818cf8;">(#${tm.squadPos})</small>` : ''}</span>
          </div>
          <div class="hackfill-tm-chips">
            ${tm.secId ? `<button class="hackfill-chip" data-copy="${escapeHTML(tm.secId)}">🆔 SEC ID</button>` : ''}
            ${tm.github ? `<button class="hackfill-chip" data-copy="${escapeHTML(tm.github)}">🐙 GH</button>` : ''}
            ${tm.linkedin ? `<button class="hackfill-chip" data-copy="${escapeHTML(tm.linkedin)}">💼 LI</button>` : ''}
            ${tm.resume ? `<button class="hackfill-chip" data-copy="${escapeHTML(tm.resume)}">📄 CV</button>` : ''}
            ${tm.email ? `<button class="hackfill-chip" data-copy="${escapeHTML(tm.email)}">✉️ Email</button>` : ''}
            ${(tm.customVariables && tm.customVariables.length > 0)
              ? tm.customVariables.filter(cv => cv.name && cv.value)
                  .map(cv => `<button class="hackfill-chip" data-copy="${escapeHTML(cv.value)}" title="${escapeHTML(cv.name)}">🔖 ${escapeHTML(cv.name)}</button>`)
                  .join('')
              : ''}
          </div>
        </div>
      `).join('');

      squadContainer.querySelectorAll('.hackfill-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          copyText(btn.dataset.copy, btn.textContent.trim());
        });
      });
    }
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

  // Listen for messages from popup or background service worker
  if (typeof ext !== 'undefined' && ext.runtime && ext.runtime.onMessage) {
    ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'AUTOFILL_PAGE') {
        performAutofill(request.payload?.profile, request.payload?.teammates)
          .then(filledCount => {
            sendResponse({ status: 'ok', filledCount });
          })
          .catch(err => {
            sendResponse({ status: 'error', error: err.toString() });
          });
        return true; // async
      }

      if (request.action === 'CHECK_FORMS') {
        const inputs = getFormElements();
        sendResponse({
          hasForm: inputs.length > 0,
          inputCount: inputs.length
        });
        return true;
      }

      if (request.action === 'INSERT_SNIPPET') {
        // Insert snippet text into active element
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          fillElement(active, request.text);
          showInPageToast('Inserted snippet!');
          sendResponse({ success: true });
        } else {
          copyText(request.text, 'Snippet');
          sendResponse({ success: true, copied: true });
        }
        return true;
      }
    });
  }

  // Initialize on page
  function init() {
    const inputs = getFormElements();
    if (inputs.length > 0) {
      injectFloatingHUD();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also observe dynamic forms (SPAs, React, Google Forms dynamic loading)
  const observer = new MutationObserver(() => {
    const root = document.getElementById('hackfill-hud-root');
    if (!root) {
      const inputs = getFormElements();
      if (inputs.length > 0) {
        injectFloatingHUD();
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
})();
