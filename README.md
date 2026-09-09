# ⚡ HackFill - Hackathon & Event AutoFill Browser Extension

**HackFill** is a Chrome & Chromium browser extension (Manifest V3) purpose-built for hackathon participants, competitive programmers, and event applicants. It completely eliminates repetitive form-filling for personal links, custom pitch questions, and teammates' credentials, while providing an integrated application tracker.

---

## 🚀 Key Features

1. **👤 Comprehensive Hacker Profile & SEC ID**
   - Stores your GitHub URL, LinkedIn, Portfolio, Resume (Drive/DocSend), Discord tag, Devpost/Devfolio, Email, Phone, University, Major, Grad Year, **College / SEC ID**, T-Shirt size, and Dietary preferences.
   - Quick-copy buttons next to every individual field for instant clipboard access.

2. **⚡ Custom Variables & Hackathon-Specific Fields**
   - Define custom key-value variables on the fly (e.g., `SEC ID`, `HackerRank ID`, `LeetCode`, `Telegram`, `UIDAI / National ID`).
   - The autofill engine intelligently detects questions asking for these variables and populates your values automatically!
   - Every custom variable appears as a 1-click copy chip in your floating drawer and popup.

3. **💾 Real-Time Auto-Save (Accidental Close Protection)**
   - Never lose what you typed! Every keystroke and dropdown change automatically saves to browser storage in real time.
   - Even if you accidentally click outside the popup and close it, your changes are 100% preserved.

4. **👥 Friends & Teammates Vault**
   - Save unlimited teammates with their full links, SEC IDs, and contact credentials.
   - Search teammates by name, email, or university.
   - **Squad Position Assignment**: Mark friends as **Teammate 1**, **Teammate 2**, or **Teammate 3** to automatically fill sequential team sections in hackathon forms!
   - 1-click copy chips for SEC ID, GitHub, LinkedIn, Resume, Email, Phone, and Discord on every teammate card.

5. **⚡ Smart In-Page AutoFill Engine**
   - Automatically detects form fields across Google Forms, Devfolio, Typeform, Tally, Devpost, Lu.ma, Unstop, and custom web portals using fuzzy semantic matching.
   - Automatically maps "Teammate 2 GitHub", "Member 2 SEC ID", "Teammate 1 Email", etc., to your assigned squad teammates.
   - Simulates native user input events so reactive frameworks (React, Vue, Google Forms) pick up values properly.

6. **✨ Floating In-Page Buddy (HUD)**
   - A non-intrusive floating button appears in the bottom-right corner of web forms.
   - Expand the drawer to:
     - ⚡ Click **"AutoFill Entire Form"**
     - 📋 Access **1-Click Copy Chips** for your links, SEC ID, custom variables, and your teammates' links without switching tabs
     - 📌 Click **"Log This Hackathon as Applied"** to record the event instantly

7. **🏆 Application Tracker**
   - Keep a permanent log of all applied hackathons and events.
   - Auto-captures event title and URL from your active browser tab.
   - Track statuses: `Applied`, `Accepted`, `Waitlisted`, `Rejected` with filter options and notes.

8. **🔒 100% Safe Reload & Data Portability**
   - Reloading the extension in `chrome://extensions` will **NEVER** delete or overwrite your data.
   - All data remains strictly local in `chrome.storage.local`.
   - One-click **JSON Export & Import** for backups or machine migrations.

---

## 🛠️ How to Install in Chrome / Edge / Brave

1. Open your browser and navigate to the Extensions page:
   - **Google Chrome**: `chrome://extensions/`
   - **Microsoft Edge**: `edge://extensions/`
   - **Brave Browser**: `brave://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click the **"Load unpacked"** button.
4. Select this directory:
   ```
   T:\EXTENSION
   ```
5. **HackFill** is now installed! Pin it to your browser toolbar for quick access.

---

## 🎯 How to Use

### 1. Set Up Your Profile
- Click the **HackFill** icon in your browser toolbar.
- Go to the **My Profile** tab, fill in your details (or click the **⚙️** tab and tap **✨ Load Hackathon Demo Data** to try sample data).
- Click **Save Profile**.

### 2. Add Teammates
- Go to the **👥 Teammates** tab.
- Click **+ Add Teammate** and enter your friend's GitHub, LinkedIn, Resume, etc.
- In their card, tap **Teammate 1** or **Teammate 2** to assign them to your active squad.

### 3. AutoFill Any Form
- Open any hackathon registration form (or open [`test/test_form.html`](test/test_form.html) in your browser).
- You can autofill via any of the following methods:
  - **Option A**: Click the **⚡ HackFill** floating button on the bottom right and tap **⚡ AutoFill Entire Form**.
  - **Option B**: Open the extension popup and click **⚡ AutoFill Page**.
  - **Option C**: Press the keyboard shortcut: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd>.
  - **Option D**: Right-click on any field -> `⚡ HackFill Quick Paste` -> select the link you want to insert.

### 4. Track Your Submissions
- When you are on a hackathon registration page, click the popup and tap **📌 Log Current Event** (or click it inside the floating drawer).
- Review the prefilled title and team, then click **Save Entry**.
- Filter your applications anytime in the **🏆 Tracker** tab!

---

## 🧪 Testing with the Included Form

Open `test/test_form.html` in your browser to verify:
- Primary applicant fields (Name, Email, Phone, College, GitHub, LinkedIn, Portfolio, Resume, Discord, T-Shirt, Diet).
- Teammate 1 fields (Name, Email, GitHub, LinkedIn).
- Teammate 2 fields (Name, Email, GitHub, Resume).

---

## 📁 Project Structure

```
T:\EXTENSION/
├── manifest.json            # Chrome Manifest V3 configuration
├── README.md                # Documentation and setup guide
├── icons/                   # Generated icons (16px, 32px, 48px, 128px)
├── popup/
│   ├── popup.html           # Main dashboard UI (Profiles, Teammates, Tracker, Snippets)
│   ├── popup.css            # Dark glassmorphic styling & animations
│   └── popup.js             # State management, storage handling, tab navigation
├── content/
│   ├── content.js           # Semantic form analyzer, teammate mapper & floating HUD
│   └── content.css          # In-page drawer & trigger button styles
├── background/
│   └── background.js        # Background service worker (context menus & shortcuts)
├── test/
│   └── test_form.html       # Realistic hackathon registration form for testing
└── scripts/
    └── generate_icons.js    # Node.js icon generator script
```
