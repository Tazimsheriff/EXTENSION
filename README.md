# HackFill

Chrome and Firefox extension for hackathon and event forms. Your details stay in browser storage on this machine.

## Install

1. Chrome, Edge, or Brave: open `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on Developer mode and choose **Load unpacked**. Select this folder.
3. Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and pick `manifest.json`. Firefox 128 or newer. Reload that add-on after an update. Firefox runs the background script as an event page, so the manifest lists both `scripts` and `service_worker`.

Pin HackFill. Use **Dock** if you want the window to stay open while you move between form fields.

## Fill a form

1. Open **You** and enter the details you reuse. Changes save on their own.
2. Open **Squad**. Set the team size. Slot 1 is you. Put saved people in the slots under you.
3. On the registration page, choose **Fill page**, the on-page HackFill button, or `Alt+Shift+F`.

How names on the form map to the lineup:

- Team lead and Member 1 use your profile.
- Participant 1, Teammate 1, and Operative 02 / Squad member 2 are the first person under you.
- If the lineup slots are empty, saved people are used in the order you added them.
- A box labeled only "Team name" is left blank.
- Essay boxes match saved answers when the question and the answer title share words.
- If a question still stays empty, click that box and use **Fill that box** on the page.

## QR codes

Hackathon posters often show a Google Form as a QR code. Rest the pointer on that code, or on the poster it sits inside. HackFill reads it in the browser and shows where it goes. Click the code, or the chip, to open it. You can also right-click the image and choose **Open link in this QR**. Only `http` and `https` links are opened.

The sample page is `test/test_form.html`. Use **More → Load demo lineup**, then fill that page. Member 4 should receive the third demo teammate. If you open that file from disk, turn on **Allow access to file URLs** for HackFill in the browser's extension settings.

## What is stored

Profile, teammates, lineup, answers, and the event log live in `storage.local`. Reloading the extension does not wipe them. Export JSON from **More** if you want a backup. Nothing is sent to a server.
