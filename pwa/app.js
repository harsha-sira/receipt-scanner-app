'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
// Values come from config.js (gitignored). See config.example.js for the template.
const CONFIG = window.BILL_CONFIG || { CLIENT_ID: '', FOLDER_ID: '' };

// ─── State ────────────────────────────────────────────────────────────────────
let tokenClient   = null;
let accessToken   = null;
let tokenExpiry   = 0;
let videoStream   = null;
let capturedBlob  = null;
let pendingUpload = false;

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ─── iOS install banner ───────────────────────────────────────────────────────
(function checkInstallable() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone) $('install-banner').hidden = false;
})();

// ─── GIS initialisation ───────────────────────────────────────────────────────
function onGISLoad() {
  if (!CONFIG.CLIENT_ID) {
    showStatus('Copy config.example.js → config.js and fill in your credentials.', 'error');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: handleToken,
    // error_callback fires when silent auth fails (e.g. first-ever use)
    error_callback: () => { /* silent — sign-in button is already shown */ },
  });

  // Attempt a silent (no-popup) token refresh on every page load.
  // If the user has signed in before in this browser, the camera opens
  // automatically with no interaction needed.
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleToken(response) {
  if (response.error) {
    // silent refresh failed — just leave the sign-in button visible
    if (response.error !== 'interaction_required' && response.error !== 'access_denied') {
      showStatus('Sign-in error: ' + response.error, 'error');
    }
    showScreen('auth');
    pendingUpload = false;
    return;
  }

  accessToken  = response.access_token;
  tokenExpiry  = Date.now() + (response.expires_in - 60) * 1000;

  if (pendingUpload) {
    pendingUpload = false;
    _doUpload();
  } else {
    showScreen('camera');
    startCamera();
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function signIn() {
  if (!tokenClient) {
    showStatus('Config not loaded — check that config.js exists.', 'error');
    return;
  }
  // 'consent' shows the Google picker + consent screen the first time.
  // After that first approval Google won't ask again for the same scope.
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
  hideStatus();
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    $('video').srcObject = videoStream;
  } catch (err) {
    showStatus('Camera unavailable: ' + err.message, 'error');
    showScreen('auth');
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
}

function capturePhoto() {
  const video  = $('video');
  const canvas = $('canvas');
  if (!video.videoWidth) {
    showStatus('Camera not ready yet — try again.', 'error');
    return;
  }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    if (!blob) { showStatus('Capture failed.', 'error'); return; }
    capturedBlob = blob;
    $('preview').src = URL.createObjectURL(blob);
    stopCamera();
    showScreen('preview');
  }, 'image/jpeg', 0.92);
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function uploadToDrive() {
  if (!capturedBlob) return;

  if (!accessToken || Date.now() >= tokenExpiry) {
    // Token expired — refresh silently (no popup expected since user already consented)
    pendingUpload = true;
    tokenClient.requestAccessToken({ prompt: '' });
    return;
  }

  _doUpload();
}

async function _doUpload() {
  showScreen('uploading');

  const filename = 'bill_' + formatTimestamp(new Date()) + '.jpg';
  const metadata = { name: filename, mimeType: 'image/jpeg', parents: [CONFIG.FOLDER_ID] };

  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', capturedBlob, filename);

  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

    $('success-filename').textContent = data.name;
    const link = $('success-link');
    link.href   = data.webViewLink || '#';
    link.hidden = !data.webViewLink;
    showScreen('success');

    URL.revokeObjectURL($('preview').src);
    capturedBlob = null;

  } catch (err) {
    showScreen('preview');
    showStatus('Upload failed: ' + err.message, 'error');
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function retake()        { showScreen('camera'); startCamera(); }
function captureAnother(){ showScreen('camera'); startCamera(); }

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  hideStatus();
}

let _statusTimer = null;

function showStatus(msg, type) {
  const el = $('status');
  el.textContent = msg;
  el.className   = 'status ' + (type || '');
  el.hidden      = false;
  clearTimeout(_statusTimer);
  if (type !== 'error') _statusTimer = setTimeout(hideStatus, 4000);
}

function hideStatus() {
  clearTimeout(_statusTimer);
  $('status').hidden = true;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
