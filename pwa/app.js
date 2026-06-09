'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
// Values come from config.js (gitignored). See config.example.js for the template.
const CONFIG = window.BILL_CONFIG || { CLIENT_ID: '', FOLDERS: [] };

// ─── State ────────────────────────────────────────────────────────────────────
let tokenClient   = null;
let accessToken   = null;
let tokenExpiry   = 0;
let videoStream   = null;
let capturedBlob  = null;
let pendingUpload = false;

// Persist the last-used folder index across sessions
let selectedFolderIdx = Math.min(
  parseInt(localStorage.getItem('lastFolder') || '0', 10),
  Math.max(0, (CONFIG.FOLDERS?.length || 1) - 1)
);

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
  if (!CONFIG.CLIENT_ID || !CONFIG.FOLDERS?.length) {
    showStatus('Copy config.example.js → config.js and fill in your credentials.', 'error');
    return;
  }

  renderFolderChips();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: handleToken,
    error_callback: () => { /* silent — sign-in button stays visible */ },
  });

  // Attempt a silent (no-popup) token refresh on every load.
  // Succeeds when the user has already signed in before in this browser.
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleToken(response) {
  if (response.error) {
    if (response.error !== 'interaction_required' && response.error !== 'access_denied') {
      showStatus('Sign-in error: ' + response.error, 'error');
    }
    showScreen('auth');
    pendingUpload = false;
    return;
  }

  accessToken = response.access_token;
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
    showStatus('Config not loaded — check that config.js exists.', 'error');
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ─── Folder picker ────────────────────────────────────────────────────────────
function renderFolderChips() {
  // Renders chips into every .folder-chips container (camera screen + preview screen)
  document.querySelectorAll('.folder-chips').forEach(container => {
    container.innerHTML = '';
    CONFIG.FOLDERS.forEach((folder, idx) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (idx === selectedFolderIdx ? ' active' : '');
      btn.textContent = folder.name;
      btn.setAttribute('aria-pressed', idx === selectedFolderIdx);
      btn.onclick = () => selectFolder(idx);
      container.appendChild(btn);
    });
  });
}

function selectFolder(idx) {
  selectedFolderIdx = idx;
  localStorage.setItem('lastFolder', idx);
  // Keep all chip sets in sync (camera + preview both have chips)
  document.querySelectorAll('.folder-chips .chip').forEach((chip, i) => {
    chip.classList.toggle('active', i === idx);
    chip.setAttribute('aria-pressed', i === idx);
  });
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
    pendingUpload = true;
    tokenClient.requestAccessToken({ prompt: '' });
    return;
  }

  _doUpload();
}

async function _doUpload() {
  showScreen('uploading');

  const folder   = CONFIG.FOLDERS[selectedFolderIdx];
  const filename = buildFilename(folder.name);

  const metadata = { name: filename, mimeType: 'image/jpeg', parents: [folder.id] };

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
    $('success-folder').textContent   = folder.name;
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
function buildFilename(folderName) {
  // Format: groceries_2024-03-15_14-30-05_a3f2.jpg
  // Google Drive does NOT error on duplicate names — it creates a second file
  // with the same name but a different unique ID. The timestamp (to the second)
  // makes collisions extremely unlikely; the 4-char hex suffix makes them
  // essentially impossible even if two photos are taken in the same second.
  const slug   = folderName.toLowerCase().replace(/\s+/g, '-');
  const ts     = formatTimestamp(new Date());
  const suffix = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${slug}_${ts}_${suffix}.jpg`;
}

function formatTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
