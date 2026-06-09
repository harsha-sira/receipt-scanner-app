# Bill Capture PWA

A mobile Progressive Web App that photographs bills and uploads them directly to Google Drive — no camera roll, no App Store.

## Quick start

1. Read **SETUP.md** for the one-time Google Cloud / OAuth setup.
2. Copy `pwa/config.example.js` → `pwa/config.js` and fill in your credentials.
3. Serve the `pwa/` folder over HTTPS and open it in Safari on iOS.
4. Tap **Share → Add to Home Screen** to install.

## Categories

| Label | Drive folder |
|---|---|
| Personal (Harsha) | your folder ID |
| Personal Hesh | your folder ID |
| Coblera | your folder ID |
| Moxilo | your folder ID |
| Other | your folder ID |

## Deployment

Deployed automatically to **GitHub Pages** via `.github/workflows/deploy-pwa.yml` on every push to `main`. Credentials are stored as GitHub repository secrets — never in the code.

See SETUP.md for full setup and deployment instructions.
