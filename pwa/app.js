'use strict';

// ─── Configuration ───────────────────────────────────────────────────────────
// Fill these in after completing SETUP.md
const CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',
  FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID',
};

// ─── State ────────────────────────────────────────────────────────────────────
let tokenClient  = null;
let accessToken  = null;
let tokenExpiry  = 0;
let videoStream  = null;
let capturedBlob = null;
let pendingUpload = false; // retry upload after token refresh

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
  if (isIOS && !isStandalone) {
    $('install-banner').hidden = false;
  }
})();

// ─── GIS initialisation ───────────────────────────────────────────────────────
function onGISLoad() {
  if (CONFIG.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
    showStatus('Open app.js and set CLIENT_ID + FOLDER_ID before use.', 'error');
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: handleToken,
  });
}

function handleToken(response) {
  if (response.error) {
    showStatus('Sign-in failed: ' + response.error, 'error');
    showScreen('auth');
    pendingUpload = false;
    return;
  }

  accessToken = response.access_token;
  // expires_in is in seconds; subtract 60s buffer
  tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;

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
    showStatus('Google Sign-In not ready — check CLIENT_ID in app.js.', 'error');
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
  hideStatus();
  const video = $('video');
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    video.srcObject = videoStream;
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
    const url = URL.createObjectURL(blob);
    $('preview').src = url;
    stopCamera();
    showScreen('preview');
  }, 'image/jpeg', 0.92);
}

// ─── Upload ───────────────────────────────────────────────────────────────────
function uploadToDrive() {
  if (!capturedBlob) return;

  if (!accessToken || Date.now() >= tokenExpiry) {
    pendingUpload = true;
    tokenClient.requestAccessToken({ prompt: '' });
    return;
  }

  _doUpload();
}

async function _doUpload() {
  showScreen('uploading');

  const filename = 'bill_' + formatTimestamp(new Date()) + '.jpg';
  const metadata = {
    name: filename,
    mimeType: 'image/jpeg',
    parents: [CONFIG.FOLDER_ID],
  };

  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', capturedBlob, filename);

  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body,
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    showScreen('success');
    $('success-filename').textContent = data.name;
    const link = $('success-link');
    link.href = data.webViewLink || '#';
    link.hidden = !data.webViewLink;

    // Release the object URL to free memory
    URL.revokeObjectURL($('preview').src);
    capturedBlob = null;

  } catch (err) {
    showScreen('preview');
    showStatus('Upload failed: ' + err.message, 'error');
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function retake() {
  showScreen('camera');
  startCamera();
}

function captureAnother() {
  showScreen('camera');
  startCamera();
}

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
  el.className = 'status ' + (type || '');
  el.hidden = false;
  clearTimeout(_statusTimer);
  // Auto-hide non-error toasts after 4 s
  if (type !== 'error') {
    _statusTimer = setTimeout(hideStatus, 4000);
  }
}

function hideStatus() {
  clearTimeout(_statusTimer);
  $('status').hidden = true;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatTimestamp(d) {
  // Produces e.g. 2024-03-15_14-30-05
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
