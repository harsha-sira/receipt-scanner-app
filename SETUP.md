# Bill Capture PWA — Setup Guide

A 5-step guide to wire up Google OAuth and deploy the PWA.

---

## What you need before starting

- A Google account
- The URL where you'll host the app (or `http://localhost:8080` for local testing)

---

## Step 1 — Get your Google Drive folder ID

1. Open [Google Drive](https://drive.google.com) in a browser.
2. Navigate to (or create) the folder where bills should land.
3. Look at the URL — the folder ID is the string after the last `/`:
   ```
   https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           this is your FOLDER_ID
   ```
4. Copy and save it.

---

## Step 2 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Click the **project picker** (top-left, next to "Google Cloud") → **New Project**.
3. Name it (e.g. `Bill Capture PWA`) and click **Create**.
4. Make sure the new project is selected in the picker before continuing.

---

## Step 3 — Enable the Google Drive API

1. In the Cloud Console, open **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click the result and press **Enable**.

---

## Step 4 — Create OAuth 2.0 credentials

### 4a — Configure the consent screen (one-time)

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in:
   - **App name**: Bill Capture
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue**.
5. On the **Scopes** step, click **Add or Remove Scopes**, search for  
   `https://www.googleapis.com/auth/drive.file`, tick it, and click **Update**.
6. Click **Save and Continue**.
7. On the **Test users** step, click **Add Users** and add your Google email.
8. Click **Save and Continue**, then **Back to Dashboard**.

### 4b — Create the OAuth client

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Name it `Bill Capture PWA`.
5. Under **Authorised JavaScript origins**, click **Add URI** and enter your app's URL:
   - For local testing: `http://localhost:8080`
   - For production: `https://yourdomain.com`
   > Add both if you want to test locally and deploy.
6. Leave **Authorised redirect URIs** empty (not needed for this flow).
7. Click **Create**.
8. A popup shows your **Client ID** — copy it (looks like `123456789-abc…xyz.apps.googleusercontent.com`).

---

## Step 5 — Configure the app

Open `pwa/app.js` and update the `CONFIG` block at the top of the file:

```js
const CONFIG = {
  CLIENT_ID: '123456789-abc...xyz.apps.googleusercontent.com',  // ← from Step 4
  FOLDER_ID: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',             // ← from Step 1
};
```

Save the file.

---

## Step 6 — Serve the app

The `pwa/` directory is a self-contained static site. Serve it from any HTTP server.

### Local testing

```bash
# Option A — Node (npx, no install needed)
npx serve pwa/

# Option B — Python
python3 -m http.server 8080 --directory pwa/
```

Open `http://localhost:8080` in your browser.

### Production deployment options

| Host | Command / method |
|------|-----------------|
| **GitHub Pages** | Push repo → Settings → Pages → deploy from `main`, set source to `/pwa` folder |
| **Netlify** | Drag-and-drop the `pwa/` folder at [netlify.com/drop](https://www.netlify.com/drop) |
| **Vercel** | `cd pwa && npx vercel` |
| **Any web server** | Copy `pwa/` contents to the document root |

> **HTTPS is required** for camera access in production. All the hosts above provide it automatically. `localhost` is exempt.

---

## Step 7 — Install on iPhone / iPad

1. Open the app URL in **Safari** (not Chrome — iOS only supports PWA install from Safari).
2. Tap the **Share button** (square with an arrow pointing up).
3. Scroll down the share sheet and tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.

The icon appears on your home screen. Tap it — the app opens without any browser chrome, exactly like a native app.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **"This app isn't verified"** warning on sign-in | Expected during development. Click **Advanced → Go to Bill Capture (unsafe)**. Disappears after Google verifies your app (optional for personal use). |
| Camera doesn't start | Ensure you're on HTTPS. On iOS go to **Settings → Safari → Camera** and allow access. |
| `invalid_client` error | Double-check `CLIENT_ID` in `app.js` and confirm your URL is in **Authorised JavaScript origins**. |
| Upload returns 403 | Confirm `FOLDER_ID` is correct and you're signed in as a test user on the consent screen. |
| Token expired mid-session | Access tokens last 1 hour. Tap **Sign in with Google** again — re-auth is instant (no consent prompt) if you've already approved. |
| "Add to Home Screen" missing | Must use Safari on iOS. In Chrome on iOS the option is not available. |

---

## How the upload works (brief)

1. **OAuth** — Google Identity Services (GIS) runs an implicit grant flow entirely in the browser. No server, no refresh token storage.
2. **Capture** — `getUserMedia` streams the rear camera into a `<video>` element. A tap draws the current frame onto a hidden `<canvas>` and extracts a JPEG `Blob`.
3. **Upload** — A single `multipart/form-data` POST to `https://www.googleapis.com/upload/drive/v3/files` attaches both the file metadata (name, parent folder) and the JPEG blob. The file lands in your Drive folder instantly.
4. **No camera roll** — The JPEG never touches the device's photo library; it exists only in memory until uploaded.
