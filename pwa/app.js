'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = window.BILL_CONFIG || { CLIENT_ID: '', WORKER_URL: '', FOLDERS: [] };

// ─── State ────────────────────────────────────────────────────────────────────
let accessToken  = null;
let tokenExpiry  = 0;
let videoStream  = null;
let capturedBlob = null;

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

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', initAuth);

async function initAuth() {
  if (!CONFIG.CLIENT_ID || !CONFIG.WORKER_URL || !CONFIG.FOLDERS?.length) {
    showAuthUI('Copy config.example.js → config.js and fill in your credentials.');
    return;
  }

  // Handle return from Google OAuth — URL will have ?session=... or ?auth_error=...
  const params      = new URLSearchParams(window.location.search);
  const sessionParam = params.get('session');
  const stateParam   = params.get('state');
  const errorParam   = params.get('auth_error');

  if (sessionParam || errorParam) {
    history.replaceState({}, '', window.location.pathname); // clean up URL
  }

  if (errorParam) {
    showAuthUI('Sign-in failed: ' + errorParam);
    return;
  }

  if (sessionParam) {
    // Validate CSRF state
    const savedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    if (savedState && stateParam !== savedState) {
      showAuthUI('Sign-in failed: state mismatch.');
      return;
    }
    localStorage.setItem('session_id', sessionParam);
  }

  // Try to get an access token using the stored session
  const sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    showAuthUI();
    return;
  }

  // Session exists — fetch a token (fast, ~200ms). Spinner shows meanwhile.
  try {
    await refreshAccessToken(sessionId);
    renderFolderChips();
    showScreen('camera');
    startCamera();
  } catch (err) {
    if (err.message === 'session_not_found' || err.message === 'refresh_failed') {
      localStorage.removeItem('session_id');
    }
    showAuthUI(err.message === 'session_not_found' ? '' : 'Session expired — please sign in again.');
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function showAuthUI(errorMsg) {
  $('auth-loading').hidden = true;
  $('auth-signin').hidden  = false;
  if (errorMsg) showStatus(errorMsg, 'error');
  showScreen('auth');
}

async function refreshAccessToken(sessionId) {
  const res = await fetch(CONFIG.WORKER_URL + '/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ session_id: sessionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'token_error');
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
function signIn() {
  const state = randomHex(16);
  sessionStorage.setItem('oauth_state', state);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id',     CONFIG.CLIENT_ID);
  url.searchParams.set('redirect_uri',  CONFIG.WORKER_URL + '/callback');
  url.searchParams.set('scope',         'https://www.googleapis.com/auth/drive.file');
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent');
  url.searchParams.set('state',         state);

  window.location.href = url.toString();
}

// ─── Folder picker ────────────────────────────────────────────────────────────
function renderFolderChips() {
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
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    $('video').srcObject = videoStream;
  } catch (err) {
    showStatus('Camera unavailable: ' + err.message, 'error');
    showScreen('auth');
  }
}

function stopCamera() {
  if (videoStream) { videoStream.getTracks().forEach(t => t.stop()); videoStream = null; }
}

function capturePhoto() {
  const video = $('video'), canvas = $('canvas');
  if (!video.videoWidth) { showStatus('Camera not ready — try again.', 'error'); return; }
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
async function uploadToDrive() {
  if (!capturedBlob) return;

  // Silently refresh token if expired — no user action needed
  if (!accessToken || Date.now() >= tokenExpiry) {
    const sessionId = localStorage.getItem('session_id');
    if (!sessionId) { showScreen('auth'); return; }
    try {
      await refreshAccessToken(sessionId);
    } catch {
      localStorage.removeItem('session_id');
      showScreen('auth');
      showStatus('Session expired — please sign in again.', 'error');
      return;
    }
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
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
      { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);

    $('success-filename').textContent = data.name;
    $('success-folder').textContent   = folder.name;
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
function hideStatus() { clearTimeout(_statusTimer); $('status').hidden = true; }

// ─── Utilities ────────────────────────────────────────────────────────────────
function buildFilename(folderName) {
  const slug = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hex4 = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${slug(folderName)}_${formatTimestamp(new Date())}_${hex4()}.jpg`;
}

function formatTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}
