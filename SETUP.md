# Bill Capture PWA — Setup Guide

Complete setup from zero to installed on your iPhone, with persistent login.

---

## Overview

Two things need to be deployed:

| What | Where | Purpose |
|---|---|---|
| **Cloudflare Worker** | Cloudflare (free) | Holds your Google client secret, stores refresh token, keeps you logged in |
| **PWA** | GitHub Pages (free) | The actual app you use on your phone |

Do them in order: Worker first, then PWA.

---

## Part A — Google Cloud (one-time, ~15 min)

### A1 — Get your five Drive folder IDs

Open each folder in Google Drive and copy the ID from the URL:
```
https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

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
2. Project picker (top-left) → **New Project** → name it `Bill Capture` → **Create**
3. Make sure it's selected before continuing

---

### A3 — Enable the Google Drive API

1. **APIs & Services → Library**
2. Search **Google Drive API** → **Enable**

---

### A4 — Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen** → **External** → **Create**
2. Fill in: App name `Bill Capture`, your email for support + developer contact
3. **Save and Continue**
4. Scopes → **Add or Remove Scopes** → find `drive.file` → tick it → **Update**
5. **Save and Continue**
6. Test users → **Add Users** → add your Google email → **Save and Continue**

> Keep Publishing status as **Testing** — only your email can sign in.

---

### A5 — Create OAuth credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**, Name: `Bill Capture PWA`
3. Under **Authorised redirect URIs** → **Add URI**:
   ```
   https://bill-capture.YOUR_CF_SUBDOMAIN.workers.dev/callback
   ```
   *(You'll know this URL after completing Part B — come back and add it then)*
4. **Create** → copy the **Client ID** and **Client Secret** — you need both

---

## Part B — Cloudflare Worker (~10 min)

The Worker runs for free on Cloudflare's edge. It stores your Google refresh token so the app never has to ask you to log in again.

### B1 — Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
wrangler login    # opens a browser to authenticate with Cloudflare
```

---

### B2 — Create the KV namespace (session storage)

```bash
cd worker
wrangler kv namespace create SESSIONS
```

Copy the `id` it prints, then open `worker/wrangler.toml` and paste it:
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id      = "PASTE_YOUR_ID_HERE"   # ← replace this line
```

Also update the `PWA_URL` in `wrangler.toml`:
```toml
[vars]
PWA_URL = "https://YOUR_GITHUB_USERNAME.github.io/receipt-scanner-app/"
```

---

### B3 — Add secrets to the Worker

```bash
wrangler secret put GOOGLE_CLIENT_ID
# paste your Client ID when prompted

wrangler secret put GOOGLE_CLIENT_SECRET
# paste your Client Secret when prompted
```

---

### B4 — Deploy the Worker

```bash
wrangler deploy
```

It will print your Worker URL, something like:
```
https://bill-capture.johndoe.workers.dev
```

**Go back to Part A5** and add `https://bill-capture.johndoe.workers.dev/callback` as an Authorised redirect URI in your Google OAuth credential.

---

## Part C — Configure and deploy the PWA

### C1 — Local config.js

```bash
cp pwa/config.example.js pwa/config.js
```

Edit `pwa/config.js`:
```js
window.BILL_CONFIG = {
  CLIENT_ID:  '123456789-abc.apps.googleusercontent.com',
  WORKER_URL: 'https://bill-capture.johndoe.workers.dev',
  FOLDERS: [
    { name: 'Personal (Harsha)', id: 'folder-id-1' },
    { name: 'Personal Hesh',     id: 'folder-id-2' },
    { name: 'Coblera',           id: 'folder-id-3' },
    { name: 'Moxilo',            id: 'folder-id-4' },
    { name: 'Other',             id: 'folder-id-5' },
  ],
};
```

---

### C2 — Add GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | your Client ID |
| `WORKER_URL` | `https://bill-capture.johndoe.workers.dev` |
| `FOLDER_ID_PERSONAL_HARSHA` | Drive folder ID |
| `FOLDER_ID_PERSONAL_HESH` | Drive folder ID |
| `FOLDER_ID_COBLERA` | Drive folder ID |
| `FOLDER_ID_MOXILO` | Drive folder ID |
| `FOLDER_ID_OTHER` | Drive folder ID |

---

### C3 — Enable GitHub Pages

Repo → **Settings → Pages → Source: GitHub Actions** → Save

---

### C4 — Deploy

Push any change to `main` that touches `pwa/`, or manually trigger:
Repo → **Actions → Deploy PWA to GitHub Pages → Run workflow**

App goes live at:
```
https://YOUR_GITHUB_USERNAME.github.io/receipt-scanner-app/
```

---

## Part D — Install on iPhone

1. Open the live URL in **Safari**
2. Tap the **Share button** (bottom bar, square with arrow)
3. Tap **Add to Home Screen** → **Add**

---

## Part E — First sign-in

1. Tap the icon on your home screen
2. The app shows a spinner briefly (checking for a saved session)
3. First time: sign-in button appears → tap **Sign in with Google**
4. Google sign-in page opens → sign in → tap **Allow**
5. You're redirected back to the app → camera opens immediately
6. **Every open after this:** spinner → camera. No sign-in. Ever.

---

## Part F — Daily use

1. Pick a category chip
2. Tap the white circle to capture
3. Change category on preview if needed
4. Tap **Upload to Drive**

Files are named: `personal-harsha_2024-03-15_14-30-05_a3f2.jpg`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Spinner stays forever | Check WORKER_URL in config.js matches your deployed Worker |
| "Sign-in failed: no_refresh_token" | In Google Cloud Console, make sure credential type is Web application and redirect URI matches your Worker exactly |
| "Access blocked: not a test user" | Add your email under OAuth consent screen → Test Users |
| "This app isn't verified" | Click Advanced → Go to Bill Capture (unsafe) — expected in testing mode |
| Camera doesn't start | Must be HTTPS. iOS: Settings → Safari → Camera → Allow |
| Upload returns 403 | Check folder ID is correct |
| Worker returns 401 after months | Refresh token was revoked — sign in once to get a new one |
