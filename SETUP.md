# Bill Capture PWA — Setup Guide

Complete setup from zero to installed on your iPhone.

---

## Part A — Google Cloud (one-time, ~15 minutes)

### A1 — Get your five Drive folder IDs

For each category, open the folder in Google Drive and copy the ID from the URL:

```
https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        this is the folder ID
```

Create a note with all five:

| Category | Folder ID |
|---|---|
| Personal (Harsha) | |
| Personal Hesh | |
| Coblera | |
| Moxilo | |
| Other | |

---

### A2 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project picker (top-left) → **New Project**
3. Name it `Bill Capture` → **Create**
4. Make sure the new project is selected before continuing

---

### A3 — Enable the Google Drive API

1. Go to **APIs & Services → Library**
2. Search **Google Drive API** → click it → **Enable**

---

### A4 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - App name: `Bill Capture`
   - User support email: your email
   - Developer contact email: your email
4. **Save and Continue**
5. On the Scopes step → **Add or Remove Scopes** → search for `drive.file` → tick `https://www.googleapis.com/auth/drive.file` → **Update**
6. **Save and Continue**
7. On Test Users → **Add Users** → add your Google email
8. **Save and Continue** → **Back to Dashboard**

> Leave Publishing status as **Testing**. This means only you can sign in — no one else can use the app even if they find the URL.

---

### A5 — Create OAuth credentials

1. Go to **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Bill Capture PWA`
5. Under **Authorised JavaScript origins** → **Add URI**:
   - `https://YOUR-GITHUB-USERNAME.github.io` (for production)
   - `http://localhost:8080` (for local testing, optional)
6. **Create**
7. Copy the **Client ID** (looks like `123456789-abc.apps.googleusercontent.com`)

---

## Part B — Configure the app

### Local use (running on your own machine)

1. In the repo, copy the template:
   ```bash
   cp pwa/config.example.js pwa/config.js
   ```
2. Open `pwa/config.js` and fill in your values:
   ```js
   window.BILL_CONFIG = {
     CLIENT_ID: '123456789-abc.apps.googleusercontent.com',
     FOLDERS: [
       { name: 'Personal (Harsha)', id: 'your-folder-id-1' },
       { name: 'Personal Hesh',     id: 'your-folder-id-2' },
       { name: 'Coblera',           id: 'your-folder-id-3' },
       { name: 'Moxilo',            id: 'your-folder-id-4' },
       { name: 'Other',             id: 'your-folder-id-5' },
     ],
   };
   ```
3. `config.js` is gitignored — it will never be committed.

---

## Part C — Deploy to GitHub Pages

### C1 — Add secrets to GitHub

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets one by one:

| Secret name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | your OAuth Client ID |
| `FOLDER_ID_PERSONAL_HARSHA` | Drive folder ID for Personal (Harsha) |
| `FOLDER_ID_PERSONAL_HESH` | Drive folder ID for Personal Hesh |
| `FOLDER_ID_COBLERA` | Drive folder ID for Coblera |
| `FOLDER_ID_MOXILO` | Drive folder ID for Moxilo |
| `FOLDER_ID_OTHER` | Drive folder ID for Other |

### C2 — Enable GitHub Pages

1. Go to repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### C3 — Trigger the first deploy

Push any change to `main` that touches the `pwa/` folder, or re-run the workflow manually:

1. Go to repo → **Actions → Deploy PWA to GitHub Pages**
2. Click **Run workflow** → **Run workflow**

Your app will be live at:
```
https://YOUR-GITHUB-USERNAME.github.io/receipt-scanner-app/
```

---

## Part D — Install on iPhone

1. Open the live URL in **Safari** (must be Safari — Chrome on iOS can't install PWAs)
2. Tap the **Share button** (square with arrow pointing up, bottom of screen)
3. Scroll down → tap **Add to Home Screen**
4. Confirm the name → tap **Add**

The Bill Capture icon appears on your home screen. It opens fullscreen like a native app.

---

## Part E — Using the app

1. **Tap the icon** on your home screen
2. First time: tap **Sign in with Google** → pick your account → tap **Allow**
3. From then on the camera opens automatically (no sign-in needed)
4. **Pick a category** using the chips above the capture button
5. **Tap the white circle** to capture the bill
6. On the preview, you can change the category or tap **Retake**
7. Tap **Upload to Drive** — done

Files are named: `personal-harsha_2024-03-15_14-30-05_a3f2.jpg`

---

## Removing Vercel (if it was connected)

If the repo was previously connected to Vercel:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Find the project → **Settings → General** → scroll to bottom → **Delete Project**
3. In the repo, check for and delete any `vercel.json` file (there is none in this repo)
4. In `.gitignore`, the `.vercel` line can stay — it's harmless

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Access blocked: you're not a test user" | Add your email under OAuth consent screen → Test Users |
| "This app isn't verified" warning | Click **Advanced → Go to Bill Capture (unsafe)** — expected during testing |
| Camera doesn't start | Must be HTTPS. On iOS: Settings → Safari → Camera → Allow |
| `invalid_client` error | Check CLIENT_ID in config.js and confirm your domain is in Authorised JavaScript origins |
| Upload returns 403 | Check the folder ID is correct and you're signed in as a test user |
| Sign-in button shows every time | Normal on first use. After that it signs in silently. If it keeps showing, your Google session may have expired — one tap fixes it |
| "Add to Home Screen" not visible | Must use Safari. Not available in Chrome/Firefox on iOS |
